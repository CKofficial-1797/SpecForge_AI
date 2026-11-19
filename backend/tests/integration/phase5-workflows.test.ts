import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import type { OllamaClient } from "../../src/modules/ai/client/ollama.types.js";
import { createRefinementDraft } from "../../src/modules/refinement/refinement.service.js";
import { generateAcceptanceCriteria } from "../../src/modules/acceptance-criteria/acceptance.service.js";

const projectIds: string[] = [];
const requirementIds: string[] = [];
const analysisIds: string[] = [];
const originalEnabled = env.OLLAMA_ENABLED;
const originalModel = env.OLLAMA_MODEL;

async function createRequirement(projectId: string, description: string) {
  const key = `PH5-${crypto.randomUUID()}`;
  const req = await prisma.requirement.create({
    data: {
      projectId,
      requirementKey: key,
      title: "Account sign in",
      description,
      priority: "MEDIUM",
      versions: {
        create: {
          versionNumber: 1,
          title: "Account sign in",
          description,
          priority: "MEDIUM",
          changeSummary: "Initial version",
        },
      },
    },
  });
  requirementIds.push(req.id);
  return req;
}
async function createAnalysis(
  requirementId: string,
  refs: string[],
  questions: Array<{
    question: string;
    reason: string;
    relatedRequirementIds: string[];
  }>,
) {
  const record = await prisma.aiAnalysis.create({
    data: {
      requirementId,
      requirementVersion: 1,
      modelName: "mock-qwen",
      promptVersion: "1.0.0",
      schemaVersion: "1.0.0",
      ruleSetVersion: "1.0.0",
      status: "SUCCEEDED",
      contextVersions: [
        { id: requirementId, version: 1 },
        ...refs.map((id) => ({ id, version: 1 })),
      ] as unknown as Prisma.InputJsonValue,
      outputData: {
        summary: "Please clarify account behavior.",
        findings: [],
        clarificationQuestions: questions,
        limitations: [],
      } as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  analysisIds.push(record.id);
  return record;
}
const mockClient = (generate: OllamaClient["generate"]): OllamaClient => ({
  generate,
  health: async () => ({
    available: true,
    modelAvailable: true,
    model: "mock-qwen",
  }),
});

describe("Phase 5 clarification, refinement, and criteria workflow", () => {
  afterAll(async () => {
    env.OLLAMA_ENABLED = originalEnabled;
    env.OLLAMA_MODEL = originalModel;
    if (requirementIds.length) {
      await prisma.acceptanceCriterion.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.refinementDraft.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.clarificationAnswer.deleteMany({
        where: { question: { requirementId: { in: requirementIds } } },
      });
      await prisma.clarificationQuestion.deleteMany({
        where: { requirementId: { in: requirementIds } },
      });
      await prisma.aiAnalysis.deleteMany({
        where: { id: { in: analysisIds } },
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

  it("imports validated questions, deduplicates repeated imports, preserves answer revisions, and enforces transitions", async () => {
    const project = await prisma.project.create({
      data: { name: `Phase 5 clarifications ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      "Users can sign in with valid credentials.",
    );
    const related = await createRequirement(
      project.id,
      "Inactive accounts cannot access the service.",
    );
    const analysis = await createAnalysis(
      target.id,
      [related.id],
      [
        {
          question: "Should inactive accounts be allowed to sign in?",
          reason: "Inactive account behavior may differ.",
          relatedRequirementIds: [target.id, related.id],
        },
        {
          question: "What should happen after an invalid password?",
          reason: "Failure behavior is not stated.",
          relatedRequirementIds: [target.id],
        },
        {
          question: "Should the account be locked after failed attempts?",
          reason: "Retry limits are unspecified.",
          relatedRequirementIds: [target.id],
        },
      ],
    );
    const imported = await request(app)
      .post(`/api/requirements/${target.id}/clarifications/import`)
      .send({ analysisId: analysis.id });
    expect(imported.status).toBe(200);
    expect(imported.body.data).toHaveLength(3);
    const repeated = await request(app)
      .post(`/api/requirements/${target.id}/clarifications/import`)
      .send({ analysisId: analysis.id });
    expect(repeated.body.data).toHaveLength(3);
    const importedQuestions = imported.body.data as Array<{
      id: string;
      question: string;
    }>;
    const inactive = importedQuestions.find((item) =>
      item.question.startsWith("Should inactive"),
    )!;
    const invalid = importedQuestions.find((item) =>
      item.question.startsWith("What should happen"),
    )!;
    const lockout = importedQuestions.find((item) =>
      item.question.startsWith("Should the account"),
    )!;
    const answer = await request(app)
      .post(`/api/clarifications/${inactive!.id}/answers`)
      .send({ answer: "No. Inactive accounts remain blocked." });
    expect(answer.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/clarifications/${inactive!.id}/answers`)
          .send({ answer: "A second first answer" })
      ).status,
    ).toBe(409);
    const revision = await request(app)
      .patch(
        `/api/clarifications/${inactive!.id}/answers/${answer.body.data.id}`,
      )
      .send({
        answer: "No. Inactive accounts remain blocked until reactivated.",
      });
    expect(revision.status).toBe(200);
    expect(revision.body.data.revisionNumber).toBe(2);
    expect(
      (
        await request(app)
          .patch(
            `/api/clarifications/${inactive!.id}/answers/${answer.body.data.id}`,
          )
          .send({ answer: "Stale edit" })
      ).status,
    ).toBe(409);
    const history = await request(app).get(
      `/api/clarifications/${inactive!.id}`,
    );
    expect(
      history.body.data.answers.map(
        (item: { revisionNumber: number }) => item.revisionNumber,
      ),
    ).toEqual([1, 2]);
    expect(
      (
        await request(app)
          .patch(`/api/clarifications/${inactive!.id}/dismiss`)
          .send()
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .patch(`/api/clarifications/${lockout!.id}/dismiss`)
          .send()
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/clarifications/${lockout!.id}/answers`)
          .send({ answer: "Cannot answer after dismiss." })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/clarifications/${invalid!.id}/answers`)
          .send({ answer: "   " })
      ).status,
    ).toBe(400);
    const foreignProject = await prisma.project.create({
      data: { name: `Phase 5 foreign project ${crypto.randomUUID()}` },
    });
    projectIds.push(foreignProject.id);
    const foreignRequirement = await createRequirement(
      foreignProject.id,
      "Foreign requirement data.",
    );
    const crossAnalysis = await createAnalysis(
      target.id,
      [foreignRequirement.id],
      [
        {
          question: "Cross-project?",
          reason: "No.",
          relatedRequirementIds: [foreignRequirement.id],
        },
      ],
    );
    expect(
      (
        await request(app)
          .post(`/api/requirements/${target.id}/clarifications/import`)
          .send({ analysisId: crossAnalysis.id })
      ).body.error.code,
    ).toBe("AI_CROSS_PROJECT_REFERENCE");
  });

  it("creates reviewable drafts, approves through versioning, and rejects stale proposals", async () => {
    const project = await prisma.project.create({
      data: { name: `Phase 5 refinement ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      "Users sign in with valid credentials.",
    );
    const analysis = await createAnalysis(
      target.id,
      [],
      [
        {
          question: "Should inactive accounts sign in?",
          reason: "The current text does not state this.",
          relatedRequirementIds: [target.id],
        },
      ],
    );
    const imported = await request(app)
      .post(`/api/requirements/${target.id}/clarifications/import`)
      .send({ analysisId: analysis.id });
    const question = imported.body.data[0] as { id: string };
    const answer = await request(app)
      .post(`/api/clarifications/${question.id}/answers`)
      .send({ answer: "No. Inactive accounts cannot sign in." });
    env.OLLAMA_ENABLED = true;
    env.OLLAMA_MODEL = "mock-qwen";
    await expect(
      generateAcceptanceCriteria(
        target.id,
        mockClient(async () =>
          JSON.stringify({ criteria: [], limitations: [] }),
        ),
      ),
    ).rejects.toMatchObject({ code: "REFINEMENT_APPROVAL_REQUIRED" });
    const refinement = JSON.stringify({
      proposedTitle: "Active account sign in",
      proposedDescription:
        "Active users can sign in with valid credentials. Inactive accounts cannot sign in.",
      changeSummary: "State inactive-account sign-in behavior",
      appliedClarifications: [
        {
          questionId: question.id,
          answerId: answer.body.data.id,
          changeExplanation: "Added the explicit inactive-account restriction.",
        },
      ],
      remainingAmbiguities: [],
      unresolvedQuestions: [],
      assumptions: [],
      warnings: [],
    });
    const draft = await createRefinementDraft(
      target.id,
      analysis.id,
      mockClient(async () => refinement),
    );
    expect(draft.status).toBe("PENDING_REVIEW");
    expect(draft.baseRequirementVersion).toBe(1);
    const rejected = await request(app)
      .post(`/api/refinement-drafts/${draft.id}/reject`)
      .send();
    expect(rejected.status).toBe(200);
    expect(
      (await prisma.requirement.findUniqueOrThrow({ where: { id: target.id } }))
        .currentVersion,
    ).toBe(1);
    const approvedDraft = await createRefinementDraft(
      target.id,
      analysis.id,
      mockClient(async () => refinement),
    );
    await prisma.$executeRaw`CREATE OR REPLACE FUNCTION phase5_approval_failure_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."status" = 'APPROVED' THEN RAISE EXCEPTION 'phase5 transaction rollback probe'; END IF; RETURN NEW; END; $$`;
    await prisma.$executeRaw`CREATE TRIGGER phase5_approval_failure_probe BEFORE UPDATE ON "RefinementDraft" FOR EACH ROW EXECUTE FUNCTION phase5_approval_failure_probe()`;
    try {
      expect(
        (
          await request(app)
            .post(`/api/refinement-drafts/${approvedDraft.id}/approve`)
            .send()
        ).status,
      ).toBe(500);
      expect(
        (
          await prisma.requirement.findUniqueOrThrow({
            where: { id: target.id },
          })
        ).currentVersion,
      ).toBe(1);
      expect(
        (
          await prisma.refinementDraft.findUniqueOrThrow({
            where: { id: approvedDraft.id },
          })
        ).status,
      ).toBe("PENDING_REVIEW");
    } finally {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS phase5_approval_failure_probe ON "RefinementDraft"`;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS phase5_approval_failure_probe()`;
    }
    const approved = await request(app)
      .post(`/api/refinement-drafts/${approvedDraft.id}/approve`)
      .send();
    expect(approved.status).toBe(200);
    expect(
      (await prisma.requirement.findUniqueOrThrow({ where: { id: target.id } }))
        .currentVersion,
    ).toBe(2);
    expect(
      (
        await prisma.requirementVersion.findUniqueOrThrow({
          where: {
            requirementId_versionNumber: {
              requirementId: target.id,
              versionNumber: 1,
            },
          },
        })
      ).description,
    ).toBe("Users sign in with valid credentials.");
    expect(
      (
        await request(app)
          .post(`/api/refinement-drafts/${approvedDraft.id}/approve`)
          .send()
      ).status,
    ).toBe(409);

    const staleTarget = await createRequirement(
      project.id,
      "Users can view their profile.",
    );
    const staleAnalysis = await createAnalysis(
      staleTarget.id,
      [],
      [
        {
          question: "Which profile fields can a user view?",
          reason: "The fields are not named.",
          relatedRequirementIds: [staleTarget.id],
        },
      ],
    );
    const staleQuestion = (
      await request(app)
        .post(`/api/requirements/${staleTarget.id}/clarifications/import`)
        .send({ analysisId: staleAnalysis.id })
    ).body.data[0] as { id: string };
    const staleAnswer = await request(app)
      .post(`/api/clarifications/${staleQuestion.id}/answers`)
      .send({ answer: "Users can view their name and email." });
    const staleOutput = JSON.stringify({
      proposedTitle: "View profile details",
      proposedDescription:
        "Users can view their name and email in their profile.",
      changeSummary: "Name the profile fields",
      appliedClarifications: [
        {
          questionId: staleQuestion.id,
          answerId: staleAnswer.body.data.id,
          changeExplanation: "Added the requested fields.",
        },
      ],
      remainingAmbiguities: [],
      unresolvedQuestions: [],
      assumptions: [],
      warnings: [],
    });
    const staleDraft = await createRefinementDraft(
      staleTarget.id,
      staleAnalysis.id,
      mockClient(async () => staleOutput),
    );
    const changed = await request(app)
      .patch(`/api/requirements/${staleTarget.id}`)
      .send({ expectedVersion: 1, title: "Profile details" });
    expect(changed.status).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/refinement-drafts/${staleDraft.id}/approve`)
          .send()
      ).body.error.code,
    ).toBe("STALE_REFINEMENT_DRAFT");
  });

  it("generates version-bound Given/When/Then drafts and reviews criteria individually", async () => {
    const project = await prisma.project.create({
      data: { name: `Phase 5 criteria ${crypto.randomUUID()}` },
    });
    projectIds.push(project.id);
    const target = await createRequirement(
      project.id,
      "Active users can view their profile name and email.",
    );
    const analysis = await createAnalysis(
      target.id,
      [],
      [
        {
          question: "Which fields are visible?",
          reason: "Display fields need detail.",
          relatedRequirementIds: [target.id],
        },
      ],
    );
    const question = (
      await request(app)
        .post(`/api/requirements/${target.id}/clarifications/import`)
        .send({ analysisId: analysis.id })
    ).body.data[0] as { id: string };
    await request(app)
      .post(`/api/clarifications/${question.id}/answers`)
      .send({ answer: "Only the name and email fields are visible." });
    const answerRows = await prisma.clarificationAnswer.findMany({
      where: { questionId: question.id, isCurrent: true },
    });
    const draftJson = JSON.stringify({
      proposedTitle: "View profile identity",
      proposedDescription:
        "Active users can view their name and email in the profile.",
      changeSummary: "Specify visible profile fields",
      appliedClarifications: [
        {
          questionId: question.id,
          answerId: answerRows[0]!.id,
          changeExplanation: "Named the visible fields.",
        },
      ],
      remainingAmbiguities: [],
      unresolvedQuestions: [],
      assumptions: [],
      warnings: [],
    });
    const draft = await createRefinementDraft(
      target.id,
      analysis.id,
      mockClient(async () => draftJson),
    );
    await request(app)
      .post(`/api/refinement-drafts/${draft.id}/approve`)
      .send();
    const criteriaJson = JSON.stringify({
      criteria: [
        {
          title: "Show profile identity",
          given: "An active user is signed in.",
          when: "The user opens their profile.",
          then: "The profile shows the user's name and email.",
          unresolvedDetails: [],
        },
        {
          title: "Profile update response",
          given: "An active user is signed in.",
          when: "The user opens their profile.",
          then: "The system responds appropriately.",
          unresolvedDetails: ["The response time is not specified."],
        },
      ],
      limitations: ["No response-time target was supplied."],
    });
    const generated = await generateAcceptanceCriteria(
      target.id,
      mockClient(async () => criteriaJson),
    );
    expect(generated).toHaveLength(2);
    expect(
      generated.every(
        (item) =>
          item.status === "DRAFT" && item.sourceRequirementVersion === 2,
      ),
    ).toBe(true);
    await expect(
      generateAcceptanceCriteria(
        target.id,
        mockClient(async () => criteriaJson),
      ),
    ).rejects.toMatchObject({ code: "ACCEPTANCE_CRITERION_DUPLICATE" });
    const unresolved = generated.find((item) => !item.isResolved)!;
    expect(
      (
        await request(app)
          .post(`/api/acceptance-criteria/${unresolved.id}/approve`)
          .send()
      ).body.error.code,
    ).toBe("CRITERION_UNRESOLVED");
    const ready = generated.find((item) => item.isResolved)!;
    expect(
      (
        await request(app)
          .post(`/api/acceptance-criteria/${ready.id}/approve`)
          .send()
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/acceptance-criteria/${ready.id}/approve`)
          .send()
      ).status,
    ).toBe(409);
    await request(app).patch(`/api/requirements/${target.id}`).send({
      expectedVersion: 2,
      description:
        "Active users can view their name and email in the profile interface.",
    });
    const history = await request(app).get(
      `/api/requirements/${target.id}/acceptance-criteria`,
    );
    expect(
      history.body.data.every(
        (item: { sourceRequirementVersion: number; isHistorical: boolean }) =>
          item.sourceRequirementVersion === 2 && item.isHistorical,
      ),
    ).toBe(true);
    expect(
      history.body.data.find((item: { id: string }) => item.id === ready.id)
        .status,
    ).toBe("APPROVED");
  });
});
