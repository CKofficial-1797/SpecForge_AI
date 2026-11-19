import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];

async function createProject() {
  const response = await request(app)
    .post("/api/projects")
    .send({ name: `Validation project ${crypto.randomUUID()}` });
  if (response.status === 201) projectIds.push(response.body.data.id as string);
  return response.body.data.id as string;
}

async function createRequirement(
  projectId: string,
  input: { key: string; title: string; description: string },
) {
  const response = await request(app)
    .post(`/api/projects/${projectId}/requirements`)
    .send({
      requirementKey: input.key,
      title: input.title,
      description: input.description,
    });
  if (response.status === 201)
    requirementIds.push(response.body.data.id as string);
  return response;
}

afterAll(async () => {
  if (requirementIds.length > 0) {
    await prisma.validationReport.deleteMany({
      where: { requirementId: { in: requirementIds } },
    });
    await prisma.requirementVersion.deleteMany({
      where: { requirementId: { in: requirementIds } },
    });
    await prisma.requirement.deleteMany({
      where: { id: { in: requirementIds } },
    });
  }
  if (projectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  await prisma.$disconnect();
});

describe("deterministic validation API and persisted reports", () => {
  it("validates current content, stores immutable versioned reports, and pages history", async () => {
    const projectId = await createProject();
    const created = await createRequirement(projectId, {
      key: "REQ-VALIDATE-1",
      title: "Response speed",
      description: "The system should respond quickly.",
    });
    expect(created.status).toBe(201);
    const requirementId = created.body.data.id as string;

    const first = await request(app)
      .post(`/api/requirements/${requirementId}/validate`)
      .send({
        findings: [{ severity: "ERROR", title: "Untrusted client finding" }],
      });
    expect(first.status).toBe(201);
    expect(first.body.data.requirementVersion).toBe(1);
    expect(first.body.data.ruleSetVersion).toBe("1.0.0");
    expect(
      first.body.data.reportData.findings.map(
        (finding: { ruleId: string }) => finding.ruleId,
      ),
    ).toContain("REQ_VAGUE_TERMS");
    expect(
      first.body.data.reportData.findings.map(
        (finding: { ruleId: string }) => finding.ruleId,
      ),
    ).toContain("REQ_MEASURABILITY");
    expect(JSON.stringify(first.body.data.reportData)).not.toContain(
      "Untrusted client finding",
    );
    const firstReportId = first.body.data.id as string;
    const originalReportData = structuredClone(first.body.data.reportData);

    const repeated = await request(app).post(
      `/api/requirements/${requirementId}/validate`,
    );
    expect(repeated.status).toBe(201);
    expect(repeated.body.data.reportData.findings).toEqual(
      originalReportData.findings,
    );

    const updated = await request(app)
      .patch(`/api/requirements/${requirementId}`)
      .send({
        expectedVersion: 1,
        description:
          "The API must return a response within 200 milliseconds under 500 concurrent requests.",
        changeSummary: "Added a measurable response target",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.currentVersion).toBe(2);

    const second = await request(app).post(
      `/api/requirements/${requirementId}/validate`,
    );
    expect(second.status).toBe(201);
    expect(second.body.data.requirementVersion).toBe(2);
    expect(
      second.body.data.reportData.findings.some(
        (finding: { ruleId: string }) => finding.ruleId === "REQ_MEASURABILITY",
      ),
    ).toBe(false);

    const historical = await request(app).get(
      `/api/requirements/${requirementId}/validation-reports/${firstReportId}`,
    );
    expect(historical.status).toBe(200);
    expect(historical.body.data.reportData).toEqual(originalReportData);
    expect(historical.body.data.requirementVersion).toBe(1);

    const history = await request(app).get(
      `/api/requirements/${requirementId}/validation-reports?page=1&pageSize=2`,
    );
    expect(history.status).toBe(200);
    expect(history.body.pagination.total).toBe(3);
    expect(
      history.body.data.map(
        (item: { requirementVersion: number }) => item.requirementVersion,
      ),
    ).toEqual([2, 1]);
  });

  it("returns a current-version project summary based on saved report data", async () => {
    const projectId = await createProject();
    const withWarning = await createRequirement(projectId, {
      key: "REQ-SUMMARY-1",
      title: "Response timing",
      description: "The system should respond quickly.",
    });
    const clean = await createRequirement(projectId, {
      key: "REQ-SUMMARY-2",
      title: "Store records",
      description: "The system stores records.",
    });
    const unanalyzed = await createRequirement(projectId, {
      key: "REQ-SUMMARY-3",
      title: "Read records",
      description: "The system retrieves records.",
    });
    expect([withWarning.status, clean.status, unanalyzed.status]).toEqual([
      201, 201, 201,
    ]);

    await request(app).post(
      `/api/requirements/${withWarning.body.data.id}/validate`,
    );
    await request(app).post(`/api/requirements/${clean.body.data.id}/validate`);
    const summary = await request(app).get(
      `/api/projects/${projectId}/validation-summary`,
    );
    expect(summary.status).toBe(200);
    expect(summary.body.data).toMatchObject({
      requirementsTotal: 3,
      requirementsAnalyzed: 2,
      requirementsWithErrors: 0,
      requirementsWithWarnings: 1,
      requirementsWithoutFindings: 1,
      requirementsNotAnalyzed: 1,
    });

    const edited = await request(app)
      .patch(`/api/requirements/${withWarning.body.data.id}`)
      .send({ expectedVersion: 1, title: "Updated response timing" });
    expect(edited.status).toBe(200);
    const afterEdit = await request(app).get(
      `/api/projects/${projectId}/validation-summary`,
    );
    expect(afterEdit.body.data.requirementsAnalyzed).toBe(1);
    expect(afterEdit.body.data.requirementsNotAnalyzed).toBe(2);
  });

  it("validates identifiers and prevents retrieving another requirement's report", async () => {
    const projectA = await createProject();
    const projectB = await createProject();
    const requirementA = await createRequirement(projectA, {
      key: "REQ-A",
      title: "A",
      description: "The system stores A.",
    });
    const requirementB = await createRequirement(projectB, {
      key: "REQ-B",
      title: "B",
      description: "The system stores B.",
    });
    const reportB = await request(app).post(
      `/api/requirements/${requirementB.body.data.id}/validate`,
    );
    expect(reportB.status).toBe(201);

    const foreign = await request(app).get(
      `/api/requirements/${requirementA.body.data.id}/validation-reports/${reportB.body.data.id}`,
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe("VALIDATION_REPORT_NOT_FOUND");

    const invalidId = await request(app).post(
      "/api/requirements/not-a-uuid/validate",
    );
    expect(invalidId.status).toBe(400);
    const missing = await request(app).post(
      "/api/requirements/00000000-0000-4000-8000-000000000099/validate",
    );
    expect(missing.status).toBe(404);
    const invalidQuery = await request(app).get(
      `/api/requirements/${requirementA.body.data.id}/validation-reports?page=0`,
    );
    expect(invalidQuery.status).toBe(400);
  });

  it("returns a safe server error when report persistence fails", async () => {
    const projectId = await createProject();
    const created = await createRequirement(projectId, {
      key: `REQ_DB_FAIL_PROBE_${crypto.randomUUID()}`,
      title: "Persistence failure probe",
      description: "The system stores a validation report.",
    });
    const requirementId = created.body.data.id as string;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS phase3_report_failure_probe ON "ValidationReport"`;
      await prisma.$executeRaw`CREATE OR REPLACE FUNCTION phase3_report_failure_probe() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE requirement_key TEXT; BEGIN SELECT "requirementKey" INTO requirement_key FROM "Requirement" WHERE id = NEW."requirementId"; IF requirement_key LIKE 'REQ_DB_FAIL_PROBE_%' THEN RAISE EXCEPTION 'validation report persistence probe'; END IF; RETURN NEW; END; $$`;
      await prisma.$executeRaw`CREATE TRIGGER phase3_report_failure_probe BEFORE INSERT ON "ValidationReport" FOR EACH ROW EXECUTE FUNCTION phase3_report_failure_probe()`;

      const response = await request(app).post(
        `/api/requirements/${requirementId}/validate`,
      );
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_ERROR");
      expect(response.body.error.message).toBe("Unexpected server error");
      expect(JSON.stringify(response.body)).not.toContain(
        "validation report persistence probe",
      );
      expect(consoleError).toHaveBeenCalled();
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS phase3_report_failure_probe ON "ValidationReport"`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS phase3_report_failure_probe()`;
      consoleError.mockRestore();
    }
  });
});
