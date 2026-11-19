import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

const projectIds: string[] = [];

async function createProject(name = `Phase 2 project ${crypto.randomUUID()}`) {
  const response = await request(app).post("/api/projects").send({ name });
  if (response.status === 201) projectIds.push(response.body.data.id as string);
  return response;
}

afterAll(async () => {
  if (projectIds.length > 0) {
    const requirements = await prisma.requirement.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const requirementIds = requirements.map(({ id }) => id);
    await prisma.requirementVersion.deleteMany({
      where: { requirementId: { in: requirementIds } },
    });
    await prisma.requirement.deleteMany({
      where: { id: { in: requirementIds } },
    });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  await prisma.$disconnect();
});

describe("project API", () => {
  it("creates, retrieves, updates, filters, paginates, and archives a project", async () => {
    const created = await createProject();
    expect(created.status).toBe(201);
    const projectId = created.body.data.id as string;

    const retrieved = await request(app).get(`/api/projects/${projectId}`);
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.data.status).toBe("ACTIVE");

    const updated = await request(app)
      .patch(`/api/projects/${projectId}`)
      .send({ description: "Project description" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe("Project description");

    const page = await request(app).get(
      "/api/projects?page=1&pageSize=1&status=ACTIVE",
    );
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination.pageSize).toBe(1);
    expect(page.body.pagination.total).toBeGreaterThanOrEqual(1);

    const archived = await request(app).patch(
      `/api/projects/${projectId}/archive`,
    );
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe("ARCHIVED");

    const archivedList = await request(app).get(
      "/api/projects?status=ARCHIVED&page=1&pageSize=20",
    );
    expect(
      archivedList.body.data.some(
        (item: { id: string }) => item.id === projectId,
      ),
    ).toBe(true);
  });

  it("returns validation and not-found errors without leaking internals", async () => {
    const invalid = await request(app)
      .post("/api/projects")
      .send({ name: "   " });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const missing = await request(app).get(
      "/api/projects/00000000-0000-4000-8000-000000000001",
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("PROJECT_NOT_FOUND");
  });
});
