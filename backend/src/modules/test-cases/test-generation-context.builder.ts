import { prisma } from "../../config/database.js";
import { ApiError } from "../../utils/api-error.js";
import type { TestGenerationContext } from "./test-generation.prompt.js";
import {
  TEST_GENERATION_MAX_CONTEXT_BYTES,
  TEST_GENERATION_MAX_CRITERIA,
} from "./test-cases.constants.js";

export async function buildTestGenerationContext(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
  });
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  if (requirement.status === "ARCHIVED")
    throw new ApiError(
      409,
      "REQUIREMENT_ARCHIVED",
      "Test cases cannot be generated for an archived requirement",
    );
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
  const criteria = await prisma.acceptanceCriterion.findMany({
    where: {
      requirementId,
      sourceRequirementVersion: version.versionNumber,
      status: "APPROVED",
      isResolved: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!criteria.length)
    throw new ApiError(
      409,
      "APPROVED_CRITERIA_REQUIRED",
      "Approve at least one resolved acceptance criterion for the current requirement version before generating test cases",
    );
  if (criteria.length > TEST_GENERATION_MAX_CRITERIA)
    throw new ApiError(
      413,
      "TEST_GENERATION_CONTEXT_TOO_LARGE",
      `At most ${TEST_GENERATION_MAX_CRITERIA} approved criteria can be analyzed in one generation run`,
    );
  const context: TestGenerationContext = {
    requirement: {
      id: requirement.id,
      version: version.versionNumber,
    },
    approvedAcceptanceCriteria: criteria.map(
      ({ id, title, given, when, then }) => ({
        id,
        title,
        given,
        when,
        then,
      }),
    ),
  };
  if (
    Buffer.byteLength(JSON.stringify(context), "utf8") >
    TEST_GENERATION_MAX_CONTEXT_BYTES
  )
    throw new ApiError(
      413,
      "TEST_GENERATION_CONTEXT_TOO_LARGE",
      "Approved criterion context exceeds the safe generation limit",
    );
  return { context, requirement, version, criteria };
}
