import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { HttpOllamaClient, OllamaError } from "../ai/client/ollama.client.js";
import type { OllamaClient } from "../ai/client/ollama.types.js";
import { buildTestGenerationContext } from "./test-generation-context.builder.js";
import { buildTestGenerationMessages } from "./test-generation.prompt.js";
import { TEST_GENERATION_PROMPT_VERSION } from "./test-cases.constants.js";
import { updateTestCaseBody } from "./test-cases.schema.js";
import {
  testCaseFingerprint,
  validateTestCase,
} from "./test-case.validator.js";
import { validateTestGenerationOutput } from "./test-output.validator.js";
import type { GeneratedTestCase } from "./test-cases.schema.js";

const defaultClient = new HttpOllamaClient();
const inFlight = new Map<string, Promise<unknown>>();

export function generateTestCases(
  requirementId: string,
  client: OllamaClient = defaultClient,
) {
  return createTestCaseGenerator(client)(requirementId);
}

export function createTestCaseGenerator(client: OllamaClient) {
  return (requirementId: string) => {
    const current = inFlight.get(requirementId);
    if (current) return current;
    const pending = runGeneration(requirementId, client).finally(() =>
      inFlight.delete(requirementId),
    );
    inFlight.set(requirementId, pending);
    return pending;
  };
}

async function runGeneration(requirementId: string, client: OllamaClient) {
  const { context, version, criteria } =
    await buildTestGenerationContext(requirementId);
  const run = await prisma.testGenerationRun.create({
    data: {
      requirementId,
      sourceRequirementVersion: version.versionNumber,
      sourceAcceptanceCriterionIds: criteria.map(({ id }) => id),
      modelName: env.OLLAMA_MODEL ?? null,
      promptVersion: TEST_GENERATION_PROMPT_VERSION,
      status: "PENDING",
    },
  });
  if (!env.OLLAMA_ENABLED || !env.OLLAMA_MODEL) {
    await prisma.testGenerationRun.update({
      where: { id: run.id },
      data: {
        status: "UNAVAILABLE",
        errorCode: "AI_NOT_CONFIGURED",
        completedAt: new Date(),
      },
    });
    throw new ApiError(
      503,
      "AI_UNAVAILABLE",
      "Live test case generation requires a configured local Ollama model. Existing requirements and approved criteria remain available.",
    );
  }
  const started = Date.now();
  await prisma.testGenerationRun.update({
    where: { id: run.id },
    data: { status: "RUNNING" },
  });
  try {
    const raw = await client.generate({
      model: env.OLLAMA_MODEL,
      messages: buildTestGenerationMessages(context),
    });
    const output = validateTestGenerationOutput(raw, context);
    const criteriaById = new Map(
      criteria.map((criterion) => [criterion.id, criterion]),
    );
    const newByCriterion = new Map<
      string,
      Array<
        Pick<
          GeneratedTestCase,
          "title" | "testType" | "testSteps" | "expectedResult"
        >
      >
    >();
    const rows = output.testCases.map((testCase) => {
      const criterion = criteriaById.get(testCase.acceptanceCriterionId);
      if (!criterion)
        throw new ApiError(
          502,
          "TEST_GENERATION_OUTPUT_INVALID",
          "AI output referenced an unsupported criterion",
        );
      const peers = newByCriterion.get(criterion.id) ?? [];
      const findings = validateTestCase(testCase, criterion, peers);
      if (findings.some(({ severity }) => severity === "ERROR"))
        throw new ApiError(
          502,
          "TEST_GENERATION_OUTPUT_INVALID",
          "AI generated a structurally invalid or duplicate test case",
        );
      peers.push(testCase);
      newByCriterion.set(criterion.id, peers);
      return {
        requirementId,
        acceptanceCriterionId: criterion.id,
        generationRunId: run.id,
        sourceRequirementVersion: version.versionNumber,
        fingerprint: testCaseFingerprint(testCase),
        title: testCase.title,
        description: testCase.description,
        testType: testCase.testType,
        preconditions:
          testCase.preconditions as unknown as Prisma.InputJsonValue,
        testSteps: testCase.testSteps as unknown as Prisma.InputJsonValue,
        testData: testCase.testData as unknown as Prisma.InputJsonValue,
        expectedResult: testCase.expectedResult,
        priority: testCase.priority,
        status: "DRAFT" as const,
        generationSource: "OLLAMA",
      };
    });
    const saved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Requirement" WHERE "id" = CAST(${requirementId} AS UUID) FOR UPDATE`;
      const current = await tx.requirement.findUnique({
        where: { id: requirementId },
        select: { currentVersion: true },
      });
      if (!current || current.currentVersion !== version.versionNumber)
        throw new ApiError(
          409,
          "STALE_TEST_GENERATION",
          "The requirement changed while test cases were being generated. Run generation again for the current version.",
        );
      const criterionCount = await tx.acceptanceCriterion.count({
        where: {
          id: { in: criteria.map(({ id }) => id) },
          requirementId,
          sourceRequirementVersion: version.versionNumber,
          status: "APPROVED",
          isResolved: true,
        },
      });
      if (criterionCount !== criteria.length)
        throw new ApiError(
          409,
          "STALE_TEST_GENERATION",
          "One or more approved acceptance criteria changed during generation.",
        );
      const created = [];
      for (const row of rows) {
        const duplicate = await tx.testCase.findFirst({
          where: {
            acceptanceCriterionId: row.acceptanceCriterionId,
            fingerprint: row.fingerprint,
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ApiError(
            409,
            "DUPLICATE_TEST_CASE",
            "A generated test case duplicates an existing case for this criterion",
          );
        created.push(await tx.testCase.create({ data: row }));
      }
      await tx.testGenerationRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          limitations: output.limitations as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
          durationMs: Date.now() - started,
        },
      });
      return created;
    });
    return {
      run: await prisma.testGenerationRun.findUniqueOrThrow({
        where: { id: run.id },
      }),
      testCases: saved,
    };
  } catch (error) {
    const code =
      error instanceof OllamaError
        ? error.code
        : error instanceof ApiError
          ? error.code
          : "TEST_GENERATION_FAILED";
    const status =
      error instanceof OllamaError && error.code === "AI_UNAVAILABLE"
        ? "UNAVAILABLE"
        : "FAILED";
    await prisma.testGenerationRun
      .update({
        where: { id: run.id },
        data: {
          status,
          errorCode: code.slice(0, 80),
          completedAt: new Date(),
          durationMs: Date.now() - started,
        },
      })
      .catch(() => undefined);
    if (error instanceof OllamaError)
      throw new ApiError(error.status, error.code, error.message);
    if (isUniqueConflict(error))
      throw new ApiError(
        409,
        "DUPLICATE_TEST_CASE",
        "A test case with equivalent content already exists for this criterion",
      );
    throw error;
  }
}

export async function listTestCases(requirementId: string) {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { currentVersion: true },
  });
  if (!requirement)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  return prisma.testCase
    .findMany({
      where: { requirementId },
      include: {
        acceptanceCriterion: true,
        generationRun: {
          select: {
            id: true,
            modelName: true,
            promptVersion: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        isHistorical:
          row.sourceRequirementVersion !== requirement.currentVersion,
      })),
    );
}

export async function listGenerationRuns(requirementId: string) {
  const exists = await prisma.requirement.findUnique({
    where: { id: requirementId },
    select: { id: true },
  });
  if (!exists)
    throw new ApiError(404, "REQUIREMENT_NOT_FOUND", "Requirement not found");
  return prisma.testGenerationRun.findMany({
    where: { requirementId },
    include: { _count: { select: { testCases: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function getTestCase(testCaseId: string) {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    include: {
      acceptanceCriterion: true,
      sourceVersion: true,
      generationRun: true,
      revisions: { orderBy: { revisionNumber: "desc" } },
    },
  });
  if (!testCase)
    throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
  const currentVersion = await prisma.requirement.findUniqueOrThrow({
    where: { id: testCase.requirementId },
    select: { currentVersion: true },
  });
  return {
    ...testCase,
    isHistorical:
      testCase.sourceRequirementVersion !== currentVersion.currentVersion,
  };
}

export async function validateSavedTestCase(testCaseId: string) {
  const row = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    include: {
      acceptanceCriterion: true,
      requirement: { select: { currentVersion: true } },
    },
  });
  if (!row)
    throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
  const input = {
    acceptanceCriterionId: row.acceptanceCriterionId,
    title: row.title,
    description: row.description,
    testType: row.testType,
    preconditions: row.preconditions as string[],
    testSteps: row.testSteps as string[],
    testData: row.testData as Array<{ name: string; value: string }>,
    expectedResult: row.expectedResult,
    priority: row.priority,
  };
  const peers = await prisma.testCase.findMany({
    where: {
      acceptanceCriterionId: row.acceptanceCriterionId,
      id: { not: row.id },
    },
    select: {
      title: true,
      testType: true,
      testSteps: true,
      expectedResult: true,
    },
  });
  const findings = validateTestCase(
    input as never,
    row.acceptanceCriterion,
    peers as never,
  );
  if (
    row.acceptanceCriterion.status !== "APPROVED" ||
    !row.acceptanceCriterion.isResolved
  )
    findings.push({
      code: "CRITERION_NOT_APPROVED",
      severity: "ERROR",
      message: "Source acceptance criterion must remain approved and resolved",
    });
  if (row.sourceRequirementVersion !== row.requirement.currentVersion)
    findings.push({
      code: "STALE_SOURCE_VERSION",
      severity: "ERROR",
      message: "Test case source version is no longer current",
    });
  return {
    testCaseId,
    sourceRequirementVersion: row.sourceRequirementVersion,
    findings,
    canApprove: findings.every(({ severity }) => severity !== "ERROR"),
  };
}

export async function updateDraftTestCase(testCaseId: string, body: unknown) {
  const input = updateTestCaseBody.parse(body);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "TestCase" WHERE "id" = CAST(${testCaseId} AS UUID) FOR UPDATE`;
    const row = await tx.testCase.findUnique({ where: { id: testCaseId } });
    if (!row)
      throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
    if (row.status !== "DRAFT")
      throw new ApiError(
        409,
        "INVALID_TEST_CASE_TRANSITION",
        "Only draft test cases can be edited",
      );
    const updated = { ...row, ...input };
    const criterion = await tx.acceptanceCriterion.findUnique({
      where: { id: row.acceptanceCriterionId },
    });
    if (!criterion)
      throw new ApiError(
        409,
        "SOURCE_CRITERION_UNAVAILABLE",
        "Source acceptance criterion is unavailable",
      );
    const peers = await tx.testCase.findMany({
      where: {
        acceptanceCriterionId: row.acceptanceCriterionId,
        id: { not: row.id },
      },
      select: {
        title: true,
        testType: true,
        testSteps: true,
        expectedResult: true,
      },
    });
    const fingerprint = testCaseFingerprint({
      title: updated.title,
      testType: updated.testType,
      testSteps: updated.testSteps as string[],
      expectedResult: updated.expectedResult,
    });
    const findings = validateTestCase(
      {
        ...updated,
        acceptanceCriterionId: row.acceptanceCriterionId,
        preconditions: updated.preconditions as string[],
        testSteps: updated.testSteps as string[],
        testData: updated.testData as Array<{ name: string; value: string }>,
      } as never,
      criterion,
      peers as never,
    );
    if (findings.some(({ severity }) => severity === "ERROR"))
      throw new ApiError(
        422,
        "TEST_CASE_INVALID",
        "Edited test case has deterministic validation errors",
        findings,
      );
    await tx.testCaseRevision.create({
      data: {
        testCaseId,
        revisionNumber: row.revisionNumber,
        snapshot: toSnapshot(row),
      },
    });
    return tx.testCase.update({
      where: { id: testCaseId },
      data: { ...input, revisionNumber: row.revisionNumber + 1, fingerprint },
    });
  });
}

export async function transitionTestCase(
  testCaseId: string,
  status: "APPROVED" | "REJECTED",
) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.testCase.findUnique({
      where: { id: testCaseId },
      select: { requirementId: true },
    });
    if (!link)
      throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
    await tx.$queryRaw`SELECT "id" FROM "Requirement" WHERE "id" = CAST(${link.requirementId} AS UUID) FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "TestCase" WHERE "id" = CAST(${testCaseId} AS UUID) FOR UPDATE`;
    const row = await tx.testCase.findUnique({
      where: { id: testCaseId },
      include: {
        acceptanceCriterion: true,
        requirement: { select: { currentVersion: true } },
        generationRun: { select: { status: true } },
      },
    });
    if (!row)
      throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
    if (row.status !== "DRAFT")
      throw new ApiError(
        409,
        "INVALID_TEST_CASE_TRANSITION",
        "Only draft test cases can be reviewed",
      );
    if (row.generationRun.status !== "SUCCEEDED")
      throw new ApiError(
        409,
        "GENERATION_NOT_SUCCEEDED",
        "Test case generation did not succeed",
      );
    if (status === "APPROVED") {
      const validation = await validateTestCaseInside(tx, row);
      if (!validation.canApprove)
        throw new ApiError(
          409,
          "TEST_CASE_VALIDATION_FAILED",
          "Resolve deterministic errors before approving this test case",
          validation.findings,
        );
      if (
        row.acceptanceCriterion.status !== "APPROVED" ||
        !row.acceptanceCriterion.isResolved
      )
        throw new ApiError(
          409,
          "CRITERION_NOT_APPROVED",
          "Source acceptance criterion must be approved and resolved",
        );
      if (row.sourceRequirementVersion !== row.requirement.currentVersion)
        throw new ApiError(
          409,
          "STALE_TEST_CASE",
          "Test case source version is stale and cannot be approved",
        );
    }
    return tx.testCase.update({
      where: { id: testCaseId },
      data: { status, reviewedAt: new Date() },
    });
  });
}

async function validateTestCaseInside(
  tx: Prisma.TransactionClient,
  row: Awaited<ReturnType<typeof prisma.testCase.findUnique>> & {
    acceptanceCriterion: {
      id: string;
      given: string;
      when: string;
      then: string;
      status: string;
      isResolved: boolean;
    };
    requirement: { currentVersion: number };
  },
) {
  const peers = await tx.testCase.findMany({
    where: {
      acceptanceCriterionId: row.acceptanceCriterionId,
      id: { not: row.id },
    },
    select: {
      title: true,
      testType: true,
      testSteps: true,
      expectedResult: true,
    },
  });
  const findings = validateTestCase(
    {
      acceptanceCriterionId: row.acceptanceCriterionId,
      title: row.title,
      description: row.description,
      testType: row.testType,
      preconditions: row.preconditions as string[],
      testSteps: row.testSteps as string[],
      testData: row.testData as Array<{ name: string; value: string }>,
      expectedResult: row.expectedResult,
      priority: row.priority,
    },
    row.acceptanceCriterion,
    peers as never,
  );
  if (
    row.acceptanceCriterion.status !== "APPROVED" ||
    !row.acceptanceCriterion.isResolved
  )
    findings.push({
      code: "CRITERION_NOT_APPROVED",
      severity: "ERROR",
      message: "Source acceptance criterion must remain approved and resolved",
    });
  if (row.sourceRequirementVersion !== row.requirement.currentVersion)
    findings.push({
      code: "STALE_SOURCE_VERSION",
      severity: "ERROR",
      message: "Test case source version is no longer current",
    });
  return {
    testCaseId: row.id,
    sourceRequirementVersion: row.sourceRequirementVersion,
    findings,
    canApprove: findings.every(({ severity }) => severity !== "ERROR"),
  };
}

export async function getTestCaseRevisions(testCaseId: string) {
  const exists = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { id: true },
  });
  if (!exists)
    throw new ApiError(404, "TEST_CASE_NOT_FOUND", "Test case not found");
  return prisma.testCaseRevision.findMany({
    where: { testCaseId },
    orderBy: { revisionNumber: "desc" },
  });
}

function toSnapshot(row: {
  title: string;
  description: string;
  testType: string;
  preconditions: Prisma.JsonValue;
  testSteps: Prisma.JsonValue;
  testData: Prisma.JsonValue;
  expectedResult: string;
  priority: string;
  revisionNumber: number;
}) {
  return {
    title: row.title,
    description: row.description,
    testType: row.testType,
    preconditions: row.preconditions,
    testSteps: row.testSteps,
    testData: row.testData,
    expectedResult: row.expectedResult,
    priority: row.priority,
    revisionNumber: row.revisionNumber,
  } as Prisma.InputJsonValue;
}
function isUniqueConflict(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
