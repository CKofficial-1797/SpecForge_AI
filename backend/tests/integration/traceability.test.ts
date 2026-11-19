import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { Prisma } from "../../src/generated/prisma/client.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];

async function fixture() {
  const project = await prisma.project.create({
    data: { name: `Trace ${crypto.randomUUID()}` },
  });
  projectIds.push(project.id);
  const requirement = await prisma.requirement.create({
    data: {
      projectId: project.id,
      requirementKey: `TRACE-${crypto.randomUUID()}`,
      title: "User access",
      description: "Users can access their account.",
      priority: "MEDIUM",
      versions: {
        create: {
          versionNumber: 1,
          title: "User access",
          description: "Users can access their account.",
          priority: "MEDIUM",
          changeSummary: "Initial",
        },
      },
    },
  });
  requirementIds.push(requirement.id);
  return { project, requirement };
}

afterAll(async () => {
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

describe("traceability API", () => {
  it("returns project summary, approval overview, matrix, and gaps without loading unscoped data", async () => {
    const { project, requirement } = await fixture();
    const summary = await request(app).get(
      `/api/projects/${project.id}/coverage-summary`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.data.coverage).toMatchObject({
      status: "NOT_APPLICABLE",
      percentage: null,
    });
    expect(summary.body.data.counts.totalRequirements).toBe(1);

    const approvals = await request(app).get(
      `/api/projects/${project.id}/approval-overview`,
    );
    expect(approvals.status).toBe(200);
    expect(approvals.body.data.pending.total).toBe(0);

    const matrix = await request(app).get(
      `/api/projects/${project.id}/traceability?page=1&pageSize=1`,
    );
    expect(matrix.status).toBe(200);
    expect(matrix.body.data).toHaveLength(1);
    expect(matrix.body.data[0].requirement.id).toBe(requirement.id);
    expect(matrix.body.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
    });

    const gaps = await request(app).get(
      `/api/projects/${project.id}/coverage-gaps`,
    );
    expect(gaps.status).toBe(200);
    expect(gaps.body.data[0].code).toBe("NO_ACCEPTANCE_CRITERIA");
  });

  it("returns a scoped requirement trace and validates identifiers", async () => {
    const { requirement } = await fixture();
    const criterion = await prisma.acceptanceCriterion.create({
      data: {
        requirementId: requirement.id,
        sourceRequirementVersion: 1,
        title: "Authorized user can access account",
        given: "The user has an active account",
        when: "The user requests the account page",
        then: "The account page is displayed",
        isResolved: true,
        notes: [] as unknown as Prisma.InputJsonValue,
        fingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        promptVersion: "1.0.0",
        status: "APPROVED",
      },
    });
    const generationRun = await prisma.testGenerationRun.create({
      data: {
        requirementId: requirement.id,
        sourceRequirementVersion: 1,
        sourceAcceptanceCriterionIds: [criterion.id],
        limitations: [],
        promptVersion: "1.0.0",
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });
    const testCase = await prisma.testCase.create({
      data: {
        requirementId: requirement.id,
        acceptanceCriterionId: criterion.id,
        generationRunId: generationRun.id,
        sourceRequirementVersion: 1,
        revisionNumber: 1,
        fingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        title: "Active user opens account",
        description: "Check the account page for an active user.",
        testType: "POSITIVE",
        preconditions: ["An active account exists"],
        testSteps: ["Open the account page"],
        testData: [],
        expectedResult: "The account page is displayed",
        priority: "MEDIUM",
        status: "APPROVED",
      },
    });
    const trace = await request(app).get(
      `/api/requirements/${requirement.id}/traceability`,
    );
    expect(trace.status).toBe(200);
    expect(trace.body.data.requirement.id).toBe(requirement.id);
    expect(trace.body.data.coverage).toMatchObject({
      eligibleCriteria: 1,
      coveredCriteria: 1,
      percentage: 100,
    });
    expect(trace.body.data.acceptanceCriteria[0].testCases[0].id).toBe(
      testCase.id,
    );
    expect(
      (
        await request(app).get(
          `/api/acceptance-criteria/${criterion.id}/traceability`,
        )
      ).body.data.criterion.covered,
    ).toBe(true);
    expect(
      (await request(app).get(`/api/test-cases/${testCase.id}/traceability`))
        .body.data.acceptanceCriterion.id,
    ).toBe(criterion.id);
    expect(
      (await request(app).get("/api/requirements/not-a-uuid/traceability"))
        .status,
    ).toBe(400);
  });
});
