import { afterEach, describe, expect, it, vi } from "vitest";
import { executeValidation } from "./validation-engine.js";
import { createValidationContext } from "./validation-context.js";
import { RULE_REGISTRY } from "./rule-registry.js";
import type { ValidationContext } from "../validation.types.js";
import type { ValidationRule } from "../rules/rule.types.js";

const context: ValidationContext = {
  requirement: {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    requirementKey: "REQ-1",
    title: "Requirement",
    description: "The system should respond quickly.",
    priority: "MEDIUM",
    status: "ACTIVE",
    currentVersion: 1,
  },
  relatedRequirements: [],
  projectExists: true,
};
const fixedDate = new Date("2026-11-20T10:00:00.000Z");

afterEach(() => vi.restoreAllMocks());

describe("validation engine", () => {
  it("runs the registry in a stable order and validates a structured report", () => {
    const result = executeValidation(context, { analyzedAt: fixedDate });
    expect(result.ruleResults.map(({ ruleId }) => ruleId)).toEqual(
      RULE_REGISTRY.map(({ ruleId }) => ruleId),
    );
    expect(result.ruleResults).toHaveLength(9);
    expect(result.ruleSetVersion).toBe("1.0.0");
    expect(result.summary.warnings).toBe(
      result.findings.filter(({ severity }) => severity === "WARNING").length,
    );
    expect(result.summary.skippedRules).toBe(
      result.ruleResults.filter(
        ({ executionStatus }) => executionStatus === "SKIPPED",
      ).length,
    );
    expect(result).toMatchObject({
      requirementVersion: 1,
      analyzedAt: fixedDate.toISOString(),
    });
  });

  it("produces equivalent deterministic findings for the same input and configuration", () => {
    const first = executeValidation(context, { analyzedAt: fixedDate });
    const second = executeValidation(createValidationContext(context), {
      analyzedAt: fixedDate,
    });
    expect(second).toEqual(first);
  });

  it("keeps the other rule results when one rule fails and marks the failure skipped", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fails = {
      ruleId: "REQ_TEST_FAILURE",
      ruleName: "Test failure",
      category: "CLARITY",
      description: "Injected failing rule",
      defaultSeverity: "WARNING",
      execute() {
        throw new Error("private internal details");
      },
    } as unknown as ValidationRule;
    const result = executeValidation(context, {
      rules: [fails, RULE_REGISTRY[0]!],
      analyzedAt: fixedDate,
    });
    expect(
      result.ruleResults.map(({ executionStatus }) => executionStatus),
    ).toEqual(["SKIPPED", "PASSED"]);
    expect(JSON.stringify(result)).not.toContain("private internal details");
    expect(result.summary.skippedRules).toBe(1);
  });

  it("rejects an invalid rule result instead of returning an invalid report", () => {
    const invalid = {
      ruleId: "BAD RULE ID",
      ruleName: "Invalid",
      category: "CLARITY",
      description: "Injected malformed rule result",
      defaultSeverity: "WARNING",
      execute: () => ({ findings: [] }),
    } as unknown as ValidationRule;
    expect(() =>
      executeValidation(context, { rules: [invalid], analyzedAt: fixedDate }),
    ).toThrow();
  });

  it("deduplicates identical findings across rule results", () => {
    const finding = {
      ruleId: "REQ_VAGUE_TERMS",
      category: "CLARITY",
      severity: "WARNING",
      title: "One issue",
      description: "A shared test finding.",
      evidence: "The same evidence.",
      recommendation: "Review the evidence.",
    } as const;
    const makeRule = (ruleId: string): ValidationRule => ({
      ruleId,
      ruleName: ruleId,
      category: "CLARITY",
      description: "Test rule",
      defaultSeverity: "WARNING",
      execute: () => ({ findings: [finding] }),
    });
    const result = executeValidation(context, {
      rules: [makeRule("REQ_TEST_ONE"), makeRule("REQ_TEST_TWO")],
      analyzedAt: fixedDate,
    });
    expect(result.findings).toHaveLength(1);
    expect(result.summary.warnings).toBe(1);
  });
});
