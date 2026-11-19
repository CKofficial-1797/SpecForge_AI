import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../config/database.js", () => ({
  prisma: { project: { create } },
}));

import { createProject } from "./project.service.js";

describe("project service", () => {
  beforeEach(() => create.mockReset());

  it("persists the validated project name and nullable description", async () => {
    const project = { id: "project-1", name: "Payments", description: null };
    create.mockResolvedValue(project);

    await expect(createProject({ name: "Payments" })).resolves.toEqual(project);
    expect(create).toHaveBeenCalledWith({
      data: { name: "Payments", description: null },
    });
  });
});
