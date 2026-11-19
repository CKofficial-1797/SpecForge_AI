import { describe, expect, it } from "vitest";
import {
  calculateRequirementTraceability,
  makeCoverage,
} from "../src/modules/traceability/coverage.calculator.js";

const requirement = {
  id: "r1",
  projectId: "p1",
  requirementKey: "REQ-1",
  title: "Sign in",
  status: "ACTIVE",
  currentVersion: 2,
};
const criterion = (
  id: string,
  version = 2,
  status = "APPROVED",
  isResolved = true,
) => ({
  id,
  requirementId: "r1",
  sourceRequirementVersion: version,
  title: `Criterion ${id}`,
  given: "given",
  when: "when",
  then: "then",
  isResolved,
  status,
});
const testCase = (
  id: string,
  criterionId: string,
  version = 2,
  status = "APPROVED",
  runStatus = "SUCCEEDED",
) => ({
  id,
  requirementId: "r1",
  acceptanceCriterionId: criterionId,
  sourceRequirementVersion: version,
  title: `Case ${id}`,
  testType: "POSITIVE",
  priority: "MEDIUM",
  status,
  generationRun: {
    id: `run-${id}`,
    requirementId: "r1",
    sourceRequirementVersion: version,
    status: runStatus,
  },
});

describe("traceability coverage calculator", () => {
  it("treats a zero denominator as not applicable", () => {
    expect(makeCoverage(0, 0)).toEqual({
      status: "NOT_APPLICABLE",
      eligibleCriteria: 0,
      coveredCriteria: 0,
      uncoveredCriteria: 0,
      percentage: null,
    });
  });

  it("counts distinct covered criteria and follows the approved status", () => {
    const result = calculateRequirementTraceability({
      requirement,
      requirementVersions: [1, 2],
      acceptanceCriteria: [
        criterion("a"),
        criterion("b"),
        criterion("c", 2, "APPROVED", false),
      ],
      testCases: [
        testCase("t1", "a"),
        testCase("t2", "a"),
        testCase("t3", "b", 2, "DRAFT"),
      ],
    });
    expect(result.coverage).toEqual({
      status: "APPLICABLE",
      eligibleCriteria: 3,
      coveredCriteria: 1,
      uncoveredCriteria: 2,
      percentage: 33.3,
    });
    expect(result.counts.coveredCriteria).toBe(1);
    expect(result.gaps.map(({ code }) => code)).toContain("DRAFT_TEST_CASES");
  });

  it("keeps historical coverage separate and marks older artifacts stale", () => {
    const result = calculateRequirementTraceability({
      requirement,
      requirementVersions: [1, 2],
      acceptanceCriteria: [criterion("old", 1), criterion("current")],
      testCases: [
        testCase("old-case", "old", 1),
        testCase("current-case", "current"),
      ],
    });
    expect(result.coverage.coveredCriteria).toBe(1);
    expect(result.historicalCoverage).toEqual([
      {
        requirementVersion: 1,
        coverage: {
          status: "APPLICABLE",
          eligibleCriteria: 1,
          coveredCriteria: 1,
          uncoveredCriteria: 0,
          percentage: 100,
        },
      },
    ]);
    expect(result.counts.staleArtifacts).toBe(2);
    expect(result.gaps.some(({ code }) => code === "STALE_TEST_CASE")).toBe(
      true,
    );
  });

  it("does not call archived requirements applicable coverage", () => {
    const result = calculateRequirementTraceability({
      requirement: { ...requirement, status: "ARCHIVED" },
      requirementVersions: [1, 2],
      acceptanceCriteria: [criterion("a")],
      testCases: [testCase("t1", "a")],
    });
    expect(result.coverage).toEqual(makeCoverage(0, 0));
    expect(result.gaps).toEqual([]);
  });

  it("excludes draft, rejected, superseded, and invalid cases from coverage", () => {
    const result = calculateRequirementTraceability({
      requirement,
      requirementVersions: [1, 2],
      acceptanceCriteria: [
        criterion("draft-case"),
        criterion("rejected-case"),
        criterion("superseded-case"),
        criterion("invalid-case"),
        criterion("superseded-criterion", 2, "SUPERSEDED"),
      ],
      testCases: [
        testCase("draft", "draft-case", 2, "DRAFT"),
        testCase("rejected", "rejected-case", 2, "REJECTED"),
        testCase("superseded", "superseded-case", 2, "SUPERSEDED"),
        {
          ...testCase("invalid", "invalid-case"),
          generationRun: {
            id: "wrong-run",
            requirementId: "another-requirement",
            sourceRequirementVersion: 1,
            status: "SUCCEEDED",
          },
        },
      ],
    });
    expect(result.coverage).toMatchObject({
      eligibleCriteria: 4,
      coveredCriteria: 0,
      percentage: 0,
    });
    expect(result.coverageStatus).toBe("REQUIRES_REVIEW");
    expect(result.orphanedTestCases.map(({ id }) => id)).toContain("invalid");
    expect(
      result.acceptanceCriteria.find(({ id }) => id === "superseded-criterion")
        ?.traceabilityStatus,
    ).toBe("SUPERSEDED");
  });

  it("classifies full and uncovered requirements without conflating missing criteria", () => {
    const full = calculateRequirementTraceability({
      requirement,
      requirementVersions: [2],
      acceptanceCriteria: [criterion("covered")],
      testCases: [testCase("approved", "covered")],
    });
    const uncovered = calculateRequirementTraceability({
      requirement,
      requirementVersions: [2],
      acceptanceCriteria: [criterion("uncovered")],
      testCases: [],
    });
    const missing = calculateRequirementTraceability({
      requirement,
      requirementVersions: [2],
      acceptanceCriteria: [],
      testCases: [],
    });
    expect(full.coverageStatus).toBe("FULLY_COVERED");
    expect(uncovered.coverageStatus).toBe("NOT_COVERED");
    expect(missing.coverageStatus).toBe("NO_APPROVED_CRITERIA");
  });
});
