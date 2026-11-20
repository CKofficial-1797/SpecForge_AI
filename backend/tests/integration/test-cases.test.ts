import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import type { OllamaClient } from "../../src/modules/ai/client/ollama.types.js";
import {
  createTestCaseGenerator,
  generateTestCases,
} from "../../src/modules/test-cases/test-cases.service.js";
import * as testCaseService from "../../src/modules/test-cases/test-cases.service.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];
const originalEnabled = env.OLLAMA_ENABLED;
const originalModel = env.OLLAMA_MODEL;

async function fixture() {
  const project = await prisma.project.create({
    data: { name: `Phase 6 ${crypto.randomUUID()}` },
  });
  projectIds.push(project.id);
  const requirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      requirementKey: `TC-${crypto.randomUUID()}`,
      title: "Profile access",
      description: "An active user can sign in and see the user's profile.",
      priority: "HIGH",
      versions: {
        create: {
          versionNumber: 1,
          title: "Profile access",
          description: "An active user can sign in and see the user's profile.",
          priority: "HIGH",
          changeSummary: "Initial version",
        },
      },
    },
  });
  requirementIds.push(requirement.id);
  const criterion = await prisma.acceptanceCriterion.create({
    data: {
      requirementId: requirement.id,
      sourceRequirementVersion: 1,
      title: "Active user profile",
      given: "An active user exists",
      when: "The user signs in",
      then: "The user sees the profile",
      isResolved: true,
      notes: [] as unknown as Prisma.InputJsonValue,
      fingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
      promptVersion: "1.0.0",
      status: "APPROVED",
    },
  });
  return { requirement, criterion };
}
const testCaseOutput = (criterionId: string) =>
  JSON.stringify({
    testCases: [
      {
        acceptanceCriterionId: criterionId,
        title: "Active user sees the profile",
        description: "Active user profile",
        testType: "POSITIVE",
        preconditions: ["An active user exists"],
        testSteps: ["The user signs in"],
        testData: [],
        expectedResult: "The user sees the profile",
        priority: "HIGH",
      },
    ],
    limitations: ["No inactive-account behavior is specified."],
  });
const mockClient = (generate: OllamaClient["generate"]): OllamaClient => ({
  generate,
  health: async () => ({
    available: true,
    modelAvailable: true,
    model: "fixture-model",
  }),
});

describe("Phase 6 test case workflow", () => {
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    env.OLLAMA_ENABLED = originalEnabled;
    env.OLLAMA_MODEL = originalModel;
    if (requirementIds.length) {
      await prisma.testCaseRevision.deleteMany({
        where: { testCase: { requirementId: { in: requirementIds } } },
      });
      await prisma.testCase.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.testGenerationRun.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.acceptanceCriterion.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.validationReport.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.aiAnalysis.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.requirementVersion.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.requirement.deleteMany({
        where: { id: { in: requirementIds } },
      });
    }
    if (projectIds.length)
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.$disconnect();
  });

  it("records Ollama unavailable without creating fabricated cases; excludes unapproved criteria", async () => {
    const { requirement, criterion } = await fixture();
    env.OLLAMA_ENABLED = false;
    env.OLLAMA_MODEL = undefined;
    const unavailable = await request(app)
      .post(`/api/requirements/${requirement.id}/test-cases/generate`)
      .send();
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe("AI_UNAVAILABLE");
    expect(
      await prisma.testCase.count({ where: { requirementId: requirement.id } }),
    ).toBe(0);
    expect(
      (
        await prisma.testGenerationRun.findFirstOrThrow({
          where: { requirementId: requirement.id },
        })
      ).status,
    ).toBe("UNAVAILABLE");
    await prisma.acceptanceCriterion.update({
      where: { id: criterion.id },
      data: { status: "DRAFT" },
    });
    await expect(
      generateTestCases(
        requirement.id,
        mockClient(async () => testCaseOutput(criterion.id)),
      ),
    ).rejects.toMatchObject({ code: "APPROVED_CRITERIA_REQUIRED" });
    expect(
      await prisma.testGenerationRun.count({
        where: { requirementId: requirement.id },
      }),
    ).toBe(1);
  });

  it("generates only from approved criteria, persists exact traceability, supports revision, validation and explicit review", async () => {
    const { requirement, criterion } = await fixture();
    const unapproved = await prisma.acceptanceCriterion.create({
      data: {
        requirementId: requirement.id,
        sourceRequirementVersion: 1,
        title: "Unapproved case",
        given: "An active user exists",
        when: "The user fails sign-in",
        then: "The profile is hidden",
        isResolved: true,
        notes: [] as unknown as Prisma.InputJsonValue,
        fingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "1"),
        promptVersion: "1.0.0",
        status: "DRAFT",
      },
    });
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "fixture-model";
    const generator = vi
      .spyOn(testCaseService, "generateTestCases")
      .mockImplementation((id) =>
        createTestCaseGenerator(
          mockClient(async () => testCaseOutput(criterion.id)),
        )(id),
      );
    const response = await request(app)
      .post(`/api/requirements/${requirement.id}/test-cases/generate`)
      .send();
    expect(response.status).toBe(201);
    expect(generator).toHaveBeenCalled();
    const result = response.body.data as {
      run: {
        id: string;
        status: string;
        sourceRequirementVersion: number;
        sourceAcceptanceCriterionIds: string[];
      };
      testCases: Array<{
        id: string;
        status: string;
        acceptanceCriterionId: string;
        sourceRequirementVersion: number;
      }>;
    };
    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.run.sourceRequirementVersion).toBe(1);
    expect(result.testCases).toHaveLength(1);
    const generated = result.testCases[0]!;
    expect(generated.status).toBe("DRAFT");
    expect(generated.acceptanceCriterionId).toBe(criterion.id);
    expect(generated.sourceRequirementVersion).toBe(1);
    expect(result.run.sourceAcceptanceCriterionIds).toEqual([criterion.id]);
    expect(result.run.sourceAcceptanceCriterionIds).not.toContain(
      unapproved.id,
    );
    const apiList = await request(app).get(
      `/api/requirements/${requirement.id}/test-cases`,
    );
    expect(apiList.status).toBe(200);
    expect(apiList.body.data[0].acceptanceCriterion.id).toBe(criterion.id);
    const edited = await request(app)
      .patch(`/api/test-cases/${generated.id}`)
      .send({ priority: "CRITICAL" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.revisionNumber).toBe(2);
    expect(
      (await request(app).get(`/api/test-cases/${generated.id}/revisions`)).body
        .data,
    ).toHaveLength(1);
    const validation = await request(app)
      .post(`/api/test-cases/${generated.id}/validate`)
      .send();
    expect(validation.body.data.canApprove).toBe(true);
    const approved = await request(app)
      .post(`/api/test-cases/${generated.id}/approve`)
      .send();
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");
    expect(
      (
        await request(app)
          .post(`/api/test-cases/${generated.id}/approve`)
          .send()
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app).get(
          `/api/requirements/${requirement.id}/test-generation-runs`,
        )
      ).body.data,
    ).toHaveLength(1);
  });

  it("rejects draft cases and refuses approval after the source requirement version becomes stale", async () => {
    const { requirement, criterion } = await fixture();
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "fixture-model";
    const output = JSON.parse(testCaseOutput(criterion.id)) as {
      testCases: Array<Record<string, unknown>>;
      limitations: string[];
    };
    output.testCases.push({
      ...output.testCases[0],
      title: "Second profile scenario",
      testSteps: ["The user signs in"],
    });
    const generated = await generateTestCases(
      requirement.id,
      mockClient(async () => JSON.stringify(output)),
    );
    const [rejectedCase, staleCase] = generated.testCases;
    const before = await prisma.requirement.findUniqueOrThrow({
      where: { id: requirement.id },
    });
    const rejected = await request(app)
      .post(`/api/test-cases/${rejectedCase!.id}/reject`)
      .send();
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(
      (
        await prisma.requirement.findUniqueOrThrow({
          where: { id: requirement.id },
        })
      ).currentVersion,
    ).toBe(before.currentVersion);
    const edited = await request(app)
      .patch(`/api/requirements/${requirement.id}`)
      .send({
        expectedVersion: 1,
        description:
          "The user's profile is available after successful sign-in.",
      });
    expect(edited.status).toBe(200);
    const validation = await request(app)
      .post(`/api/test-cases/${staleCase!.id}/validate`)
      .send();
    expect(
      validation.body.data.findings.map(
        (finding: { code: string }) => finding.code,
      ),
    ).toContain("STALE_SOURCE_VERSION");
    const approval = await request(app)
      .post(`/api/test-cases/${staleCase!.id}/approve`)
      .send();
    expect(approval.status).toBe(409);
    expect(approval.body.error.code).toBe("TEST_CASE_VALIDATION_FAILED");
    const history = await request(app).get(
      `/api/requirements/${requirement.id}/test-cases`,
    );
    expect(
      history.body.data.every(
        (item: { isHistorical: boolean }) => item.isHistorical,
      ),
    ).toBe(true);
  });

  it("rejects unsupported criterion references and invalid AI output without saving test cases", async () => {
    const { requirement } = await fixture();
    const other = await fixture();
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "fixture-model";
    await expect(
      generateTestCases(
        requirement.id,
        mockClient(async () => testCaseOutput(other.criterion.id)),
      ),
    ).rejects.toMatchObject({ code: "TEST_GENERATION_OUTPUT_INVALID" });
    expect(
      await prisma.testCase.count({ where: { requirementId: requirement.id } }),
    ).toBe(0);
    expect(
      (
        await prisma.testGenerationRun.findFirstOrThrow({
          where: { requirementId: requirement.id },
        })
      ).status,
    ).toBe("FAILED");
    await expect(
      generateTestCases(
        requirement.id,
        mockClient(async () => "not json"),
      ),
    ).rejects.toMatchObject({ code: "TEST_GENERATION_OUTPUT_INVALID" });
    expect(
      await prisma.testCase.count({ where: { requirementId: requirement.id } }),
    ).toBe(0);
  });
});
