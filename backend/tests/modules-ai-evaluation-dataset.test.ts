import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildAnalysisMessages } from "../src/modules/ai/prompts/requirement-analysis.prompt.js";

interface EvaluationCase {
  id: string;
  target: {
    id: string;
    version: number;
    key: string;
    title: string;
    description: string;
    priority: string;
  };
  related: Array<{
    id: string;
    version: number;
    key: string;
    title: string;
    description: string;
    priority: string;
  }>;
}

describe("versioned AI security evaluation dataset", () => {
  it("contains clear, semantic, boundary, negative, conflict, and injection fixtures", async () => {
    const data = JSON.parse(
      await readFile(
        new URL("./fixtures/ai-evaluation.v1.json", import.meta.url),
        "utf8",
      ),
    ) as {
      datasetVersion: string;
      promptVersion: string;
      cases: Array<{ kind: string }>;
    };
    expect(data.datasetVersion).toBe("1.0.0");
    expect(data.promptVersion).toBe("1.0.0");
    expect(data.cases.map(({ kind }) => kind)).toEqual([
      "clear",
      "ambiguity",
      "missing_business_condition",
      "vague",
      "potential_conflict",
      "boundary",
      "negative_scenario",
      "prompt_injection_ignore",
      "prompt_injection_reveal_prompt",
      "prompt_injection_request_secret",
      "prompt_injection_self_approve",
      "prompt_injection_unsupported_acceptance",
      "prompt_injection_cross_project_reference",
      "prompt_injection_irrelevant_instruction",
    ]);
  });

  it("keeps all fixture content in the untrusted user message and supplies no secrets", async () => {
    const data = JSON.parse(
      await readFile(
        new URL("./fixtures/ai-evaluation.v1.json", import.meta.url),
        "utf8",
      ),
    ) as { cases: EvaluationCase[] };
    const adversarial = data.cases.filter(({ id }) =>
      id.startsWith("injection-"),
    );
    for (const malicious of adversarial) {
      const [system, user] = buildAnalysisMessages({
        target: malicious.target,
        related: malicious.related,
      });
      expect(system.role).toBe("system");
      expect(user.role).toBe("user");
      expect(system.content).not.toContain(malicious.target.description);
      expect(user.content).toContain(malicious.target.description);
      expect(user.content).toContain("<untrusted-requirement-context>");
      expect(system.content.toLowerCase()).toContain("untrusted");
      expect(JSON.stringify([system, user])).not.toContain(
        process.env.DATABASE_URL ?? "\u0000-no-database-url",
      );
    }
    expect(adversarial).toHaveLength(7);
    expect(
      adversarial.find(({ id }) => id === "injection-003")?.target.description,
    ).toContain("FAKE_DB_SECRET_9f31");
  });
});
