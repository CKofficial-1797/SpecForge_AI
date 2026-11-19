import { afterAll, describe, expect, it } from "vitest";
import type { OllamaClient } from "../../src/modules/ai/client/ollama.types.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { buildAnalysisContext } from "../../src/modules/ai/harness/analysis-context.builder.js";
import { analyzeRequirement } from "../../src/modules/ai/harness/analysis-orchestrator.js";
import {
  getAnalysis,
  listAnalyses,
} from "../../src/modules/ai/services/requirement-analysis.service.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];
async function createRequirement(
  projectId: string,
  key: string,
  description: string,
) {
  const created = await prisma.requirement.create({
    data: {
      projectId,
      requirementKey: key,
      title: key,
      description,
      versions: {
        create: {
          versionNumber: 1,
          title: key,
          description,
          priority: "MEDIUM",
          changeSummary: "Initial version",
        },
      },
    },
  });
  requirementIds.push(created.id);
  return created;
}
function modelOutput(requirementId: string) {
  return JSON.stringify({
    summary: "A few details need a product decision.",
    findings: [
      {
        basis: "MISSING",
        category: "MISSING_CONDITION",
        severity: "WARNING",
        title: "Failure behavior is not defined",
        description:
          "The requirement does not explain what happens when authentication fails.",
        evidence: "Users can sign in with a valid password.",
        recommendation:
          "Clarify the expected response when authentication fails.",
        affectedRequirementIds: [requirementId],
        confidence: "MEDIUM",
      },
    ],
    clarificationQuestions: [
      {
        question: "What should happen after a user enters an invalid password?",
        reason: "The requirement describes only valid credentials.",
        relatedRequirementIds: [requirementId],
      },
    ],
    limitations: ["Only the supplied requirements were considered."],
  });
}
describe("AI analysis persistence and context", () => {
  const originalEnabled = env.OLLAMA_ENABLED;
  const originalModel = env.OLLAMA_MODEL;
  afterAll(async () => {
    env.OLLAMA_ENABLED = originalEnabled;
    env.OLLAMA_MODEL = originalModel;
    if (requirementIds.length) {
      await prisma.aiAnalysis.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
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
    if (projectIds.length)
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.$disconnect();
  });

  it("uses exact current target versions and same-project non-archived context", async () => {
    const project = await prisma.project.create({
      data: { name: `AI context ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      "AI-TARGET",
      "Users can sign in with a valid password.",
    );
    const related = await createRequirement(
      project.id,
      "AI-RELATED",
      "The account must be active.",
    );
    const archived = await createRequirement(
      project.id,
      "AI-ARCHIVED",
      "Archived requirement text.",
    );
    await prisma.requirement.update({
      where: { id: archived.id },
      data: { status: "ARCHIVED" },
    });
    const context = await buildAnalysisContext(target.id);
    expect(context.target).toMatchObject({
      id: target.id,
      version: 1,
      description: target.description,
    });
    expect(context.related.map((item) => item.id)).toEqual([related.id]);
    expect(JSON.stringify(context)).not.toContain("Archived requirement text");
  });

  it("persists only validated results and retains their original requirement version", async () => {
    const project = await prisma.project.create({
      data: { name: `AI persist ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      `AI-REQ-${crypto.randomUUID()}`,
      "Users can sign in with a valid password.",
    );
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "mock-local-qwen";
    const client: OllamaClient = {
      generate: async () => modelOutput(target.id),
      health: async () => ({
        available: true,
        modelAvailable: true,
        model: "mock-local-qwen",
      }),
    };
    const result = await analyzeRequirement(target.id, client);
    expect(result.analysis.status).toBe("SUCCEEDED");
    expect(result.analysis.requirementVersion).toBe(1);
    expect(result.deterministicReport.requirementVersion).toBe(1);
    const history = await listAnalyses(target.id, 1, 10);
    expect(history.data).toHaveLength(1);
    await prisma.requirement.update({
      where: { id: target.id },
      data: { title: "Changed title", currentVersion: 2 },
    });
    await prisma.requirementVersion.create({
      data: {
        requirementId: target.id,
        versionNumber: 2,
        title: "Changed title",
        description: target.description,
        priority: "MEDIUM",
      },
    });
    expect(
      (await getAnalysis(target.id, result.analysis.id)).requirementVersion,
    ).toBe(1);
  });

  it("records invalid model output as failed and unavailable execution without a fabricated result", async () => {
    const project = await prisma.project.create({
      data: { name: `AI failure ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      `AI-FAIL-${crypto.randomUUID()}`,
      "Users can sign in with a valid password.",
    );
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "mock-local-qwen";
    const invalidClient: OllamaClient = {
      generate: async () => "not json",
      health: async () => ({
        available: true,
        modelAvailable: true,
        model: "mock-local-qwen",
      }),
    };
    await expect(
      analyzeRequirement(target.id, invalidClient),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID" });
    const failed = await prisma.aiAnalysis.findFirstOrThrow({
      where: { requirementId: target.id },
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.outputData).toBeNull();
    env.OLLAMA_ENABLED = false;
    await expect(
      analyzeRequirement(target.id, invalidClient),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    const unavailable = await prisma.aiAnalysis.findFirstOrThrow({
      where: { requirementId: target.id, status: "UNAVAILABLE" },
    });
    expect(unavailable.outputData).toBeNull();
  });
});
