import { env } from "../../config/env.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import { OllamaError, HttpOllamaClient } from "../ai/client/ollama.client.js";
import type { OllamaClient } from "../ai/client/ollama.types.js";
import {
  refinementOutputSchema,
  type RefinementOutput,
} from "./refinement.schema.js";
import {
  REFINEMENT_OUTPUT_MAX_BYTES,
  REFINEMENT_PROMPT_VERSION,
} from "./refinement.constants.js";
import {
  buildRefinementMessages,
  REFINEMENT_OUTPUT_JSON_SCHEMA,
} from "./refinement.prompt.js";
import { updateRequirementInTransaction } from "../requirements/requirement.service.js";
import { requirementAnalysisSchema } from "../ai/schemas/requirement-analysis.schema.js";

export interface RefinementContext {
  requirement: {
    id: string;
    version: number;
    title: string;
    description: string;
    priority: string;
  };
  project: { name: string; description: string | null };
  related: Array<{
    id: string;
    version: number;
    key: string;
    title: string;
    description: string;
    priority: string;
  }>;
  answeredClarifications: Array<{
    questionId: string;
    question: string;
    reason: string;
    answerId: string;
    answer: string;
    revisionNumber: number;
  }>;
}
const defaultClient = new HttpOllamaClient();

export async function createRefinementDraft(
  requirementId: string,
  sourceAnalysisId: string,
  client: OllamaClient = defaultClient,
) {
  if (!env.OLLAMA_ENABLED || !env.OLLAMA_MODEL)
    throw new ApiError(503, "AI_UNAVAILABLE", "Local AI is not configured");
  const { context, unresolvedQuestionText } = await buildRefinementContext(
    requirementId,
    sourceAnalysisId,
  );
  let raw: string;
  try {
    raw = await client.generate({
      model: env.OLLAMA_MODEL,
      messages: buildRefinementMessages(context),
      format: REFINEMENT_OUTPUT_JSON_SCHEMA,
    });
  } catch (error) {
    throw mapOllamaError(error);
  }
  const output = validateRefinementOutput(raw, context);
  output.unresolvedQuestions.push(...unresolvedQuestionText);
  const json = output as unknown as Prisma.InputJsonValue;
  return prisma.refinementDraft.create({
    data: {
      requirementId,
      baseRequirementVersion: context.requirement.version,
      sourceAnalysisId,
      proposedTitle: output.proposedTitle,
      proposedDescription: output.proposedDescription,
      changeSummary: output.changeSummary,
      structuredOutput: json,
      promptVersion: REFINEMENT_PROMPT_VERSION,
    },
  });
}

export async function buildRefinementContext(
  requirementId: string,
  sourceAnalysisId: string,
): Promise<{ context: RefinementContext; unresolvedQuestionText: string[] }> {
  const target = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { project: { select: { name: true, description: true } } },
  });
  if (!target)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  const analysis = await prisma.aiAnalysis.findFirst({
    where: { id: sourceAnalysisId, requirementId },
  });
  if (!analysis)
    throw new ApiError(404, "AI_ANALYSIS_NOT_FOUND", "AI analysis not found");
  if (analysis.status !== "SUCCEEDED" || !analysis.outputData)
    throw new ApiError(
      409,
      "AI_ANALYSIS_NOT_SUCCESSFUL",
      "A successful AI analysis is required",
    );
  if (!requirementAnalysisSchema.safeParse(analysis.outputData).success)
    throw new ApiError(
      500,
      "AI_ANALYSIS_UNAVAILABLE",
      "Saved AI analysis is unavailable",
    );
  if (analysis.requirementVersion !== target.currentVersion)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "The source analysis is not for the current requirement version",
    );
  const targetVersion = await prisma.requirementVersion.findUnique({
    where: {
      requirementId_versionNumber: {
        requirementId,
        versionNumber: analysis.requirementVersion,
      },
    },
  });
  if (!targetVersion)
    throw new ApiError(
      500,
      "REQUIREMENT_VERSION_UNAVAILABLE",
      "Requirement version is unavailable",
    );
  const questions = await prisma.clarificationQuestion.findMany({
    where: { requirementId, sourceAnalysisId },
    include: { answers: { where: { isCurrent: true }, take: 1 } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const answeredClarifications = questions.flatMap((item) => {
    const answer = item.status === "ANSWERED" ? item.answers[0] : undefined;
    return answer
      ? [
          {
            questionId: item.id,
            question: item.question,
            reason: item.reason,
            answerId: answer.id,
            answer: answer.answer,
            revisionNumber: answer.revisionNumber,
          },
        ]
      : [];
  });
  if (!answeredClarifications.length)
    throw new ApiError(
      409,
      "ANSWERS_REQUIRED",
      "Answer at least one clarification before generating a refinement draft",
    );
  const unresolvedQuestionText = questions
    .filter(
      (item) =>
        item.status === "OPEN" ||
        item.status === "DISMISSED" ||
        (item.status === "ANSWERED" && !item.answers.length),
    )
    .map(
      (item) =>
        `[${item.status}] ${item.question} — ${item.reason} (clarification ${item.id})`,
    );
  const contextIds = readContextVersions(analysis.contextVersions).filter(
    (item) => item.id !== requirementId,
  );
  const relatedRequirementIds = [...new Set(contextIds.map((item) => item.id))];
  const relatedRows = relatedRequirementIds.length
    ? await prisma.requirement.findMany({
        where: {
          id: { in: relatedRequirementIds },
          projectId: target.projectId,
          status: { not: "ARCHIVED" },
        },
        select: { id: true, requirementKey: true, currentVersion: true },
      })
    : [];
  const related = await Promise.all(
    relatedRows.flatMap((row) => {
      const ref = contextIds.find((item) => item.id === row.id);
      return ref
        ? [
            prisma.requirementVersion
              .findUnique({
                where: {
                  requirementId_versionNumber: {
                    requirementId: row.id,
                    versionNumber: ref.version,
                  },
                },
              })
              .then((version) =>
                version
                  ? {
                      id: row.id,
                      version: version.versionNumber,
                      key: row.requirementKey,
                      title: version.title,
                      description: version.description,
                      priority: version.priority,
                    }
                  : null,
              ),
          ]
        : [];
    }),
  );
  const context: RefinementContext = {
    requirement: {
      id: requirementId,
      version: targetVersion.versionNumber,
      title: targetVersion.title,
      description: targetVersion.description,
      priority: targetVersion.priority,
    },
    project: target.project,
    related: related.filter(
      (value): value is NonNullable<typeof value> => value !== null,
    ),
    answeredClarifications,
  };
  if (
    JSON.stringify({ context, unresolvedQuestionText }).length >
    env.AI_CONTEXT_MAX_CHARS
  )
    throw new ApiError(
      413,
      "AI_CONTEXT_TOO_LARGE",
      "Clarification context is too large for refinement",
    );
  return { context, unresolvedQuestionText };
}

export function validateRefinementOutput(
  raw: string,
  context: RefinementContext,
): RefinementOutput {
  if (Buffer.byteLength(raw, "utf8") > REFINEMENT_OUTPUT_MAX_BYTES)
    throw new ApiError(
      502,
      "REFINEMENT_OUTPUT_INVALID",
      "AI refinement output is too large",
    );
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new ApiError(
      502,
      "REFINEMENT_OUTPUT_INVALID",
      "AI refinement output is invalid",
    );
  }
  const parsed = refinementOutputSchema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      502,
      "REFINEMENT_OUTPUT_INVALID",
      "AI refinement output did not pass validation",
    );
  if (parsed.data.unresolvedQuestions.length > 20)
    throw new ApiError(
      502,
      "REFINEMENT_OUTPUT_INVALID",
      "AI refinement output exceeds unresolved-question limits",
    );
  const answerByQuestion = new Map(
    context.answeredClarifications.map((item) => [
      item.questionId,
      item.answerId,
    ]),
  );
  const seenQuestions = new Set<string>();
  for (const item of parsed.data.appliedClarifications) {
    if (
      answerByQuestion.get(item.questionId) !== item.answerId ||
      seenQuestions.has(item.questionId)
    )
      throw new ApiError(
        502,
        "REFINEMENT_OUTPUT_INVALID",
        "AI refinement output contains an unsupported clarification reference",
      );
    seenQuestions.add(item.questionId);
  }
  if (seenQuestions.size !== answerByQuestion.size)
    throw new ApiError(
      502,
      "REFINEMENT_OUTPUT_INVALID",
      "AI refinement output did not account for every supplied clarification answer",
    );
  return parsed.data;
}

export async function listRefinementDrafts(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { currentVersion: true },
  });
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  const drafts = await prisma.refinementDraft.findMany({
    where: { requirementId },
    include: { baseVersion: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return drafts.map((draft) => ({
    ...parseDraft(draft),
    isStale: draft.baseRequirementVersion !== requirement.currentVersion,
  }));
}
export async function getRefinementDraft(draftId: string) {
  const draft = await prisma.refinementDraft.findUnique({
    where: { id: draftId },
    include: {
      requirement: { select: { currentVersion: true } },
      baseVersion: true,
    },
  });
  if (!draft)
    throw new ApiError(
      404,
      "REFINEMENT_DRAFT_NOT_FOUND",
      "Refinement draft not found",
    );
  return {
    ...parseDraft(draft),
    original: draft.baseVersion,
    currentVersion: draft.requirement.currentVersion,
    isStale: draft.baseRequirementVersion !== draft.requirement.currentVersion,
  };
}
export async function approveRefinementDraft(draftId: string) {
  return prisma.$transaction(async (tx) => {
    const ids = await tx.$queryRaw<
      Array<{ id: string; currentVersion: number }>
    >`SELECT "id", "currentVersion" FROM "Requirement" WHERE "id" = (SELECT "requirementId" FROM "RefinementDraft" WHERE "id" = CAST(${draftId} AS UUID)) FOR UPDATE`;
    if (!ids.length)
      throw new ApiError(
        404,
        "REFINEMENT_DRAFT_NOT_FOUND",
        "Refinement draft not found",
      );
    await tx.$queryRaw`SELECT "id" FROM "RefinementDraft" WHERE "id" = CAST(${draftId} AS UUID) FOR UPDATE`;
    const draft = await tx.refinementDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft)
      throw new ApiError(
        404,
        "REFINEMENT_DRAFT_NOT_FOUND",
        "Refinement draft not found",
      );
    if (draft.status !== "PENDING_REVIEW")
      throw new ApiError(
        409,
        "INVALID_DRAFT_TRANSITION",
        "Only a pending refinement draft can be approved",
      );
    if (draft.baseRequirementVersion !== ids[0]!.currentVersion)
      throw new ApiError(
        409,
        "STALE_REFINEMENT_DRAFT",
        "The requirement changed after this draft was generated",
      );
    const output = refinementOutputSchema.safeParse(draft.structuredOutput);
    if (!output.success)
      throw new ApiError(
        500,
        "REFINEMENT_DRAFT_UNAVAILABLE",
        "Refinement draft is unavailable",
      );
    if (
      output.data.assumptions.length ||
      output.data.unresolvedQuestions.length
    )
      throw new ApiError(
        409,
        "REFINEMENT_UNRESOLVED",
        "Resolve the draft's assumptions and unanswered questions before approval",
      );
    const current = await tx.requirement.findUniqueOrThrow({
      where: { id: draft.requirementId },
    });
    if (
      current.title === draft.proposedTitle &&
      current.description === draft.proposedDescription
    )
      throw new ApiError(
        409,
        "REFINEMENT_HAS_NO_CHANGES",
        "The proposal does not change the requirement",
      );
    await updateRequirementInTransaction(tx, draft.requirementId, {
      expectedVersion: draft.baseRequirementVersion,
      title: draft.proposedTitle,
      description: draft.proposedDescription,
      changeSummary: draft.changeSummary,
    });
    const reviewedAt = new Date();
    const approved = await tx.refinementDraft.update({
      where: { id: draftId },
      data: { status: "APPROVED", reviewedAt },
    });
    await tx.refinementDraft.updateMany({
      where: {
        requirementId: draft.requirementId,
        id: { not: draftId },
        status: "PENDING_REVIEW",
      },
      data: { status: "SUPERSEDED", reviewedAt },
    });
    return approved;
  });
}
export async function rejectRefinementDraft(draftId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "RefinementDraft" WHERE "id" = CAST(${draftId} AS UUID) FOR UPDATE`;
    const draft = await tx.refinementDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft)
      throw new ApiError(
        404,
        "REFINEMENT_DRAFT_NOT_FOUND",
        "Refinement draft not found",
      );
    if (draft.status !== "PENDING_REVIEW")
      throw new ApiError(
        409,
        "INVALID_DRAFT_TRANSITION",
        "Only a pending refinement draft can be rejected",
      );
    return tx.refinementDraft.update({
      where: { id: draftId },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
  });
}
function parseDraft(
  draft: { structuredOutput: Prisma.JsonValue } & Record<string, unknown>,
) {
  const output = refinementOutputSchema.safeParse(draft.structuredOutput);
  if (!output.success)
    throw new ApiError(
      500,
      "REFINEMENT_DRAFT_UNAVAILABLE",
      "Refinement draft is unavailable",
    );
  return { ...draft, structuredOutput: output.data };
}
function readContextVersions(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof item.id === "string" &&
    "version" in item &&
    typeof item.version === "number"
      ? [{ id: item.id, version: item.version }]
      : [],
  );
}
function mapOllamaError(error: unknown): ApiError {
  if (error instanceof OllamaError)
    return new ApiError(error.status, error.code, error.message);
  return new ApiError(
    502,
    "REFINEMENT_OUTPUT_INVALID",
    "AI refinement output could not be validated",
  );
}
