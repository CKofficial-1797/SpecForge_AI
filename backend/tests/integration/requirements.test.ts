import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];

async function createParentProject() {
  const response = await request(app)
    .post("/api/projects")
    .send({ name: `Requirement test ${crypto.randomUUID()}` });
  if (response.status === 201) projectIds.push(response.body.data.id as string);
  return response.body.data.id as string;
}

async function createRequirement(projectId: string, requirementKey: string) {
  const response = await request(app)
    .post(`/api/projects/${projectId}/requirements`)
    .send({
      requirementKey,
      title: "User login",
      description: "Users can sign in with their registered credentials.",
      priority: "HIGH",
    });
  if (response.status === 201)
    requirementIds.push(response.body.data.id as string);
  return response;
}

afterAll(async () => {
  if (requirementIds.length > 0) {
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

describe("requirement API and immutable versions", () => {
  it("creates version 1, versions content edits, preserves history, and skips no-ops", async () => {
    const projectId = await createParentProject();
    const created = await createRequirement(projectId, "REQ-001");
    expect(created.status).toBe(201);
    const requirementId = created.body.data.id as string;
    expect(created.body.data.currentVersion).toBe(1);

    const versionsV1 = await request(app).get(
      `/api/requirements/${requirementId}/versions/1`,
    );
    expect(versionsV1.status).toBe(200);
    expect(versionsV1.body.data.title).toBe("User login");

    const updated = await request(app)
      .patch(`/api/requirements/${requirementId}`)
      .send({
        expectedVersion: 1,
        description: "Users can sign in with a registered email and password.",
        changeSummary: "Clarified accepted credentials",
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data.currentVersion).toBe(2);

    const noOp = await request(app)
      .patch(`/api/requirements/${requirementId}`)
      .send({ expectedVersion: 2, description: updated.body.data.description });
    expect(noOp.status).toBe(200);
    expect(noOp.body.data.currentVersion).toBe(2);

    const changedMetadata = await request(app)
      .patch(`/api/requirements/${requirementId}`)
      .send({
        expectedVersion: 2,
        requirementKey: "REQ-001A",
        status: "ACTIVE",
      });
    expect(changedMetadata.status).toBe(200);
    expect(changedMetadata.body.data.currentVersion).toBe(2);

    const history = await request(app).get(
      `/api/requirements/${requirementId}/versions?page=1&pageSize=20`,
    );
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0].description).toBe(
      "Users can sign in with their registered credentials.",
    );
    expect(history.body.data[1].changeSummary).toBe(
      "Clarified accepted credentials",
    );

    const stale = await request(app)
      .patch(`/api/requirements/${requirementId}`)
      .send({ expectedVersion: 1, title: "Stale update" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");
    expect(stale.body.error.details.currentVersion).toBe(2);

    const list = await request(app).get(
      `/api/projects/${projectId}/requirements?priority=HIGH&status=ACTIVE&page=1&pageSize=10`,
    );
    expect(list.status).toBe(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toContain(
      requirementId,
    );
  });

  it("rejects duplicate project keys and invalid parents, and serializes concurrent edits", async () => {
    const projectId = await createParentProject();
    const created = await createRequirement(projectId, "REQ-DUP");
    const requirementId = created.body.data.id as string;

    const duplicate = await createRequirement(projectId, "REQ-DUP");
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("RESOURCE_CONFLICT");

    const missingParent = await request(app)
      .post("/api/projects/00000000-0000-4000-8000-000000000001/requirements")
      .send({
        requirementKey: "REQ-ORPHAN",
        title: "Orphan",
        description: "This must not persist.",
      });
    expect(missingParent.status).toBe(404);

    const competingUpdates = await Promise.all([
      request(app)
        .patch(`/api/requirements/${requirementId}`)
        .send({ expectedVersion: 1, title: "Concurrent change A" }),
      request(app)
        .patch(`/api/requirements/${requirementId}`)
        .send({ expectedVersion: 1, title: "Concurrent change B" }),
    ]);
    expect(competingUpdates.map(({ status }) => status).sort()).toEqual([
      200, 409,
    ]);

    const finalRequirement = await request(app).get(
      `/api/requirements/${requirementId}`,
    );
    expect(finalRequirement.body.data.currentVersion).toBe(2);
    const history = await request(app).get(
      `/api/requirements/${requirementId}/versions`,
    );
    expect(history.body.data).toHaveLength(2);

    const archived = await request(app).patch(
      `/api/requirements/${requirementId}/archive`,
    );
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");

    const parentArchive = await request(app).patch(
      `/api/projects/${projectId}/archive`,
    );
    expect(parentArchive.status).toBe(200);
    const disallowedCreate = await createRequirement(
      projectId,
      "REQ-AFTER-ARCHIVE",
    );
    expect(disallowedCreate.status).toBe(409);
    expect(disallowedCreate.body.error.code).toBe("PROJECT_ARCHIVED");
  });
});
