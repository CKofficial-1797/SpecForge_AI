import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import { requirementAnalysisSchema } from "../ai/schemas/requirement-analysis.schema.js";
import type { ClarificationStatus } from "../../generated/prisma/enums.js";

export async function importAnalysisQuestions(
  requirementId: string,
  analysisId: string,
) {
  const [requirement, analysis] = await Promise.all([
    prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { id: true, projectId: true },
    }),
    prisma.aiAnalysis.findFirst({ where: { id: analysisId, requirementId } }),
  ]);
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  if (!analysis)
    throw new ApiError(404, "AI_ANALYSIS_NOT_FOUND", "AI analysis not found");
  if (analysis.status !== "SUCCEEDED")
    throw new ApiError(
      409,
      "AI_ANALYSIS_NOT_SUCCESSFUL",
      "Only a successful AI analysis can provide clarification questions",
    );
  const output = requirementAnalysisSchema.safeParse(analysis.outputData);
  if (!output.success)
    throw new ApiError(
      500,
      "AI_ANALYSIS_UNAVAILABLE",
      "Saved AI analysis is unavailable",
    );
  const contextIds = readContextIds(analysis.contextVersions);
  const allRefs = output.data.clarificationQuestions.flatMap(
    (item) => item.relatedRequirementIds,
  );
  if (allRefs.some((id) => !contextIds.has(id)))
    throw new ApiError(
      422,
      "AI_UNSUPPORTED_REFERENCE",
      "Analysis contains an unsupported requirement reference",
    );
  const uniqueRefs = [...new Set(allRefs)];
  const sameProject = uniqueRefs.length
    ? await prisma.requirement.findMany({
        where: { id: { in: uniqueRefs }, projectId: requirement.projectId },
        select: { id: true },
      })
    : [];
  if (sameProject.length !== uniqueRefs.length)
    throw new ApiError(
      422,
      "AI_CROSS_PROJECT_REFERENCE",
      "Analysis contains a requirement reference outside this project",
    );
  const rows = output.data.clarificationQuestions.map((item) => ({
    requirementId,
    sourceAnalysisId: analysis.id,
    question: item.question,
    reason: item.reason,
    relatedRequirementIds:
      item.relatedRequirementIds as unknown as Prisma.InputJsonValue,
    questionFingerprint: fingerprint(item.question),
  }));
  if (rows.length)
    await prisma.clarificationQuestion.createMany({
      data: rows,
      skipDuplicates: true,
    });
  return prisma.clarificationQuestion.findMany({
    where: { requirementId, sourceAnalysisId: analysisId },
    include: { answers: { orderBy: { revisionNumber: "asc" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function listQuestions(
  requirementId: string,
  status?: ClarificationStatus,
) {
  if (
    !(await prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { id: true },
    }))
  )
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  return prisma.clarificationQuestion.findMany({
    where: { requirementId, ...(status ? { status } : {}) },
    include: {
      answers: { orderBy: { revisionNumber: "asc" } },
      sourceAnalysis: { select: { requirementVersion: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}
export async function getQuestion(questionId: string) {
  const question = await prisma.clarificationQuestion.findUnique({
    where: { id: questionId },
    include: {
      answers: { orderBy: { revisionNumber: "asc" } },
      sourceAnalysis: {
        select: { id: true, requirementVersion: true, promptVersion: true },
      },
    },
  });
  if (!question)
    throw new ApiError(
      404,
      "CLARIFICATION_NOT_FOUND",
      "Clarification question not found",
    );
  return question;
}
export async function submitAnswer(questionId: string, answer: string) {
  return prisma.$transaction(async (tx) => {
    await lockQuestion(tx, questionId);
    const question = await tx.clarificationQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question)
      throw new ApiError(
        404,
        "CLARIFICATION_NOT_FOUND",
        "Clarification question not found",
      );
    if (question.status !== "OPEN")
      throw new ApiError(
        409,
        "INVALID_CLARIFICATION_TRANSITION",
        "Only an open clarification can receive its first answer",
      );
    const saved = await tx.clarificationAnswer.create({
      data: { questionId, answer, revisionNumber: 1, isCurrent: true },
    });
    await tx.clarificationQuestion.update({
      where: { id: questionId },
      data: { status: "ANSWERED" },
    });
    return saved;
  });
}
export async function editAnswer(
  questionId: string,
  answerId: string,
  answer: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockQuestion(tx, questionId);
    const question = await tx.clarificationQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question)
      throw new ApiError(
        404,
        "CLARIFICATION_NOT_FOUND",
        "Clarification question not found",
      );
    if (question.status !== "ANSWERED")
      throw new ApiError(
        409,
        "INVALID_CLARIFICATION_TRANSITION",
        "Only an answered clarification can have its answer edited",
      );
    const current = await tx.clarificationAnswer.findFirst({
      where: { id: answerId, questionId, isCurrent: true },
    });
    if (!current)
      throw new ApiError(
        409,
        "ANSWER_REVISION_CONFLICT",
        "Only the latest answer revision can be edited",
      );
    await tx.clarificationAnswer.update({
      where: { id: current.id },
      data: { isCurrent: false },
    });
    const revised = await tx.clarificationAnswer.create({
      data: {
        questionId,
        answer,
        revisionNumber: current.revisionNumber + 1,
        isCurrent: true,
      },
    });
    await tx.clarificationQuestion.update({
      where: { id: questionId },
      data: { status: "ANSWERED" },
    });
    return revised;
  });
}
export async function dismissQuestion(questionId: string) {
  return prisma.$transaction(async (tx) => {
    await lockQuestion(tx, questionId);
    const question = await tx.clarificationQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question)
      throw new ApiError(
        404,
        "CLARIFICATION_NOT_FOUND",
        "Clarification question not found",
      );
    if (question.status !== "OPEN")
      throw new ApiError(
        409,
        "INVALID_CLARIFICATION_TRANSITION",
        "Only an open clarification can be dismissed",
      );
    return tx.clarificationQuestion.update({
      where: { id: questionId },
      data: { status: "DISMISSED" },
    });
  });
}
async function lockQuestion(tx: Prisma.TransactionClient, questionId: string) {
  const result = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "ClarificationQuestion" WHERE "id" = CAST(${questionId} AS UUID) FOR UPDATE`;
  if (!result.length)
    throw new ApiError(
      404,
      "CLARIFICATION_NOT_FOUND",
      "Clarification question not found",
    );
}
function fingerprint(value: string) {
  return createHash("sha256")
    .update(
      value
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim(),
    )
    .digest("hex");
}
function readContextIds(value: Prisma.JsonValue): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value.flatMap((item) =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof item.id === "string"
        ? [item.id]
        : [],
    ),
  );
}
