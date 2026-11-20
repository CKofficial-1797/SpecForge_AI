import { createHash } from "node:crypto";
import { env, isAiConfigured } from "../../config/env.js";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import { HttpOllamaClient, OllamaError } from "../ai/client/ollama.client.js";
import type { OllamaClient } from "../ai/client/ollama.types.js";
import { findUnsupportedTerms } from "../ai/validators/source-grounding.validator.js";
import {
  ACCEPTANCE_OUTPUT_MAX_BYTES,
  ACCEPTANCE_PROMPT_VERSION,
} from "./acceptance.constants.js";
import { acceptanceOutputSchema } from "./acceptance.schema.js";
import {
  ACCEPTANCE_OUTPUT_JSON_SCHEMA,
  buildAcceptanceMessages,
} from "./acceptance.prompt.js";

const defaultClient = new HttpOllamaClient();
export async function generateAcceptanceCriteria(
  requirementId: string,
  client: OllamaClient = defaultClient,
) {
  if (!isAiConfigured || !env.OLLAMA_MODEL)
    throw new ApiError(503, "AI_UNAVAILABLE", "AI provider is not configured");
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
  });
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  const version = await prisma.requirementVersion.findUnique({
    where: {
      requirementId_versionNumber: {
        requirementId,
        versionNumber: requirement.currentVersion,
      },
    },
  });
  if (!version)
    throw new ApiError(
      500,
      "REQUIREMENT_VERSION_UNAVAILABLE",
      "Requirement version is unavailable",
    );
  const openQuestions = await prisma.clarificationQuestion.findMany({
    where: {
      requirementId,
      status: { in: ["OPEN", "DISMISSED"] },
      sourceAnalysis: { requirementVersion: requirement.currentVersion },
    },
    select: { id: true },
  });
  if (openQuestions.length)
    throw new ApiError(
      409,
      "CLARIFICATIONS_UNRESOLVED",
      "Answer or review all open and dismissed clarification questions before generating acceptance criteria",
    );
  const unappliedAnswers = await prisma.clarificationQuestion.count({
    where: {
      requirementId,
      status: "ANSWERED",
      sourceAnalysis: { requirementVersion: requirement.currentVersion },
    },
  });
  if (unappliedAnswers)
    throw new ApiError(
      409,
      "REFINEMENT_APPROVAL_REQUIRED",
      "Approve a refinement that incorporates the clarification answers before generating acceptance criteria",
    );
  const context = {
    requirementId,
    version: version.versionNumber,
    title: version.title,
    description: version.description,
    priority: version.priority,
  };
  let raw: string;
  try {
    raw = await client.generate({
      model: env.OLLAMA_MODEL,
      messages: buildAcceptanceMessages(context),
      format: ACCEPTANCE_OUTPUT_JSON_SCHEMA,
    });
  } catch (error) {
    if (error instanceof OllamaError)
      throw new ApiError(error.status, error.code, error.message);
    throw new ApiError(
      502,
      "ACCEPTANCE_OUTPUT_INVALID",
      "AI acceptance criteria could not be validated",
    );
  }
  const output = validateAcceptanceOutput(
    raw,
    `${context.title} ${context.description}`,
  );
  const rows = output.criteria.map((criterion) => ({
    requirementId,
    sourceRequirementVersion: version.versionNumber,
    title: criterion.title,
    given: criterion.given,
    when: criterion.when,
    then: criterion.then,
    isResolved: criterion.unresolvedDetails.length === 0,
    notes: criterion.unresolvedDetails as unknown as Prisma.InputJsonValue,
    fingerprint: fingerprint(criterion.given, criterion.when, criterion.then),
    generationSource: "OLLAMA",
    modelName: env.OLLAMA_MODEL,
    promptVersion: ACCEPTANCE_PROMPT_VERSION,
  }));
  const fingerprints = new Set<string>();
  for (const row of rows) {
    if (fingerprints.has(row.fingerprint))
      throw new ApiError(
        502,
        "ACCEPTANCE_OUTPUT_INVALID",
        "AI returned duplicate acceptance criteria",
      );
    fingerprints.add(row.fingerprint);
  }
  const existing = await prisma.acceptanceCriterion.findFirst({
    where: {
      requirementId,
      sourceRequirementVersion: version.versionNumber,
      fingerprint: { in: rows.map((row) => row.fingerprint) },
    },
    select: { id: true },
  });
  if (existing)
    throw new ApiError(
      409,
      "ACCEPTANCE_CRITERION_DUPLICATE",
      "One or more criteria already exist for this requirement version",
    );
  try {
    await prisma.acceptanceCriterion.createMany({ data: rows });
  } catch (error) {
    if (isUniqueConflict(error))
      throw new ApiError(
        409,
        "ACCEPTANCE_CRITERION_DUPLICATE",
        "One or more criteria already exist for this requirement version",
      );
    throw error;
  }
  return listAcceptanceCriteria(requirementId);
}

export function validateAcceptanceOutput(raw: string, sourceText: string) {
  if (Buffer.byteLength(raw, "utf8") > ACCEPTANCE_OUTPUT_MAX_BYTES)
    throw new ApiError(
      502,
      "ACCEPTANCE_OUTPUT_INVALID",
      "AI acceptance criteria output is too large",
    );
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ApiError(
      502,
      "ACCEPTANCE_OUTPUT_INVALID",
      "AI acceptance criteria output is invalid",
    );
  }
  const parsed = acceptanceOutputSchema.safeParse(data);
  if (!parsed.success)
    throw new ApiError(
      502,
      "ACCEPTANCE_OUTPUT_INVALID",
      "AI acceptance criteria output did not pass validation",
    );
  const unsupported = parsed.data.criteria.some((criterion) =>
    [criterion.title, criterion.given, criterion.when, criterion.then].some(
      (claim) => findUnsupportedTerms(claim, sourceText).length > 0,
    ),
  );
  if (unsupported)
    throw new ApiError(
      502,
      "ACCEPTANCE_OUTPUT_INVALID",
      "AI acceptance criteria contain substantive content not grounded in the requirement",
    );
  return parsed.data;
}

export async function listAcceptanceCriteria(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { currentVersion: true },
  });
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  const records = await prisma.acceptanceCriterion.findMany({
    where: { requirementId },
    orderBy: [
      { sourceRequirementVersion: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  return records.map((record) => ({
    ...record,
    isHistorical:
      record.sourceRequirementVersion !== requirement.currentVersion,
    notes: Array.isArray(record.notes) ? record.notes : [],
  }));
}
export async function getAcceptanceCriterion(criterionId: string) {
  const record = await prisma.acceptanceCriterion.findUnique({
    where: { id: criterionId },
    include: {
      requirement: { select: { currentVersion: true } },
      sourceVersion: true,
    },
  });
  if (!record)
    throw new ApiError(
      404,
      "ACCEPTANCE_CRITERION_NOT_FOUND",
      "Acceptance criterion not found",
    );
  return {
    ...record,
    isHistorical:
      record.sourceRequirementVersion !== record.requirement.currentVersion,
    notes: Array.isArray(record.notes) ? record.notes : [],
  };
}
export async function approveAcceptanceCriterion(criterionId: string) {
  return transitionCriterion(criterionId, "APPROVED");
}
export async function rejectAcceptanceCriterion(criterionId: string) {
  return transitionCriterion(criterionId, "REJECTED");
}
async function transitionCriterion(
  criterionId: string,
  status: "APPROVED" | "REJECTED",
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "AcceptanceCriterion" WHERE "id" = CAST(${criterionId} AS UUID) FOR UPDATE`;
    const criterion = await tx.acceptanceCriterion.findUnique({
      where: { id: criterionId },
      include: { requirement: { select: { currentVersion: true } } },
    });
    if (!criterion)
      throw new ApiError(
        404,
        "ACCEPTANCE_CRITERION_NOT_FOUND",
        "Acceptance criterion not found",
      );
    if (criterion.status !== "DRAFT")
      throw new ApiError(
        409,
        "INVALID_CRITERION_TRANSITION",
        "Only a draft acceptance criterion can be reviewed",
      );
    if (status === "APPROVED" && !criterion.isResolved)
      throw new ApiError(
        409,
        "CRITERION_UNRESOLVED",
        "Acceptance criteria with unresolved details cannot be approved",
      );
    if (
      status === "APPROVED" &&
      criterion.sourceRequirementVersion !==
        criterion.requirement.currentVersion
    )
      throw new ApiError(
        409,
        "STALE_ACCEPTANCE_CRITERION",
        "This criterion refers to an older requirement version",
      );
    return tx.acceptanceCriterion.update({
      where: { id: criterionId },
      data: { status, reviewedAt: new Date() },
    });
  });
}
function fingerprint(given: string, when: string, then: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return createHash("sha256")
    .update([given, when, then].map(normalize).join("|"))
    .digest("hex");
}
function isUniqueConflict(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
