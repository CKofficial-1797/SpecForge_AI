export type TraceabilityStatus =
  "CURRENT" | "HISTORICAL" | "STALE" | "SUPERSEDED" | "INVALID";

export type CoverageStatus = "APPLICABLE" | "NOT_APPLICABLE";
export type RequirementCoverageStatus =
  | "FULLY_COVERED"
  | "PARTIALLY_COVERED"
  | "NOT_COVERED"
  | "NO_APPROVED_CRITERIA"
  | "REQUIRES_REVIEW";

export interface TraceRequirement {
  id: string;
  projectId: string;
  requirementKey: string;
  title: string;
  status: string;
  currentVersion: number;
}

export interface TraceCriterion {
  id: string;
  requirementId: string;
  sourceRequirementVersion: number;
  title: string;
  given: string;
  when: string;
  then: string;
  isResolved: boolean;
  status: string;
}

export interface TraceGenerationRun {
  id: string;
  requirementId: string;
  sourceRequirementVersion: number;
  status: string;
}

export interface TraceTestCase {
  id: string;
  requirementId: string;
  acceptanceCriterionId: string;
  sourceRequirementVersion: number;
  title: string;
  testType: string;
  priority: string;
  status: string;
  generationRun: TraceGenerationRun | null;
}

export interface CoverageValue {
  status: CoverageStatus;
  eligibleCriteria: number;
  coveredCriteria: number;
  uncoveredCriteria: number;
  percentage: number | null;
}

export interface TraceGap {
  code:
    | "NO_ACCEPTANCE_CRITERIA"
    | "NO_APPROVED_CRITERIA"
    | "CRITERION_PENDING_APPROVAL"
    | "CRITERION_REJECTED"
    | "NO_TEST_CASES"
    | "DRAFT_TEST_CASES"
    | "REJECTED_TEST_CASES"
    | "STALE_TEST_CASE"
    | "INVALID_RELATIONSHIP";
  requirementId: string;
  requirementKey: string;
  requirementTitle: string;
  requirementVersion: number;
  acceptanceCriterionId?: string;
  acceptanceCriterionTitle?: string;
  testCaseId?: string;
  message: string;
  recommendation: string;
}

export interface RequirementTraceability {
  requirement: TraceRequirement;
  versions: number[];
  coverage: CoverageValue;
  coverageStatus: RequirementCoverageStatus;
  counts: {
    acceptanceCriteria: number;
    approvedAcceptanceCriteria: number;
    pendingAcceptanceCriteria: number;
    testCases: number;
    approvedTestCases: number;
    draftTestCases: number;
    rejectedTestCases: number;
    coveredCriteria: number;
    uncoveredCriteria: number;
    staleArtifacts: number;
    invalidArtifacts: number;
  };
  historicalCoverage: Array<{
    requirementVersion: number;
    coverage: CoverageValue;
  }>;
  acceptanceCriteria: Array<
    TraceCriterion & {
      traceabilityStatus: TraceabilityStatus;
      eligibleForCoverage: boolean;
      covered: boolean;
      testCases: Array<
        TraceTestCase & { traceabilityStatus: TraceabilityStatus }
      >;
    }
  >;
  orphanedTestCases: Array<TraceTestCase & { traceabilityStatus: "INVALID" }>;
  gaps: TraceGap[];
}

export function calculateRequirementTraceability(input: {
  requirement: TraceRequirement;
  requirementVersions: number[];
  acceptanceCriteria: TraceCriterion[];
  testCases: TraceTestCase[];
}): RequirementTraceability {
  const { requirement } = input;
  const versions = new Set(input.requirementVersions);
  const criteria = input.acceptanceCriteria.map((criterion) => ({
    ...criterion,
    validRelationship:
      criterion.requirementId === requirement.id &&
      versions.has(criterion.sourceRequirementVersion),
  }));
  const criteriaById = new Map(
    criteria.map((criterion) => [criterion.id, criterion]),
  );
  const invalidCaseIds = new Set<string>();
  const cases = input.testCases.map((testCase) => {
    const criterion = criteriaById.get(testCase.acceptanceCriterionId);
    const run = testCase.generationRun;
    const validRelationship =
      !!criterion &&
      criterion.validRelationship &&
      testCase.requirementId === requirement.id &&
      criterion.requirementId === testCase.requirementId &&
      criterion.sourceRequirementVersion ===
        testCase.sourceRequirementVersion &&
      versions.has(testCase.sourceRequirementVersion) &&
      !!run &&
      run.requirementId === requirement.id &&
      run.sourceRequirementVersion === testCase.sourceRequirementVersion;
    if (!validRelationship) invalidCaseIds.add(testCase.id);
    const stale =
      testCase.sourceRequirementVersion !== requirement.currentVersion;
    const traceabilityStatus: TraceabilityStatus = !validRelationship
      ? "INVALID"
      : testCase.status === "SUPERSEDED"
        ? "SUPERSEDED"
        : stale
          ? "STALE"
          : "CURRENT";
    return { ...testCase, traceabilityStatus, validRelationship, criterion };
  });
  const enrichedCriteria = criteria.map((criterion) => {
    const stale =
      criterion.sourceRequirementVersion !== requirement.currentVersion;
    const traceabilityStatus: TraceabilityStatus = !criterion.validRelationship
      ? "INVALID"
      : criterion.status === "SUPERSEDED"
        ? "SUPERSEDED"
        : stale
          ? "HISTORICAL"
          : "CURRENT";
    const related = cases.filter(
      (testCase) => testCase.acceptanceCriterionId === criterion.id,
    );
    const validApprovedCase = related.some(
      (testCase) =>
        testCase.validRelationship &&
        testCase.traceabilityStatus === "CURRENT" &&
        testCase.status === "APPROVED" &&
        criterion.status === "APPROVED",
    );
    return {
      ...criterion,
      traceabilityStatus,
      eligibleForCoverage:
        traceabilityStatus === "CURRENT" &&
        criterion.status === "APPROVED" &&
        requirement.status !== "ARCHIVED",
      covered: validApprovedCase,
      testCases: related.map(publicTestCase),
    };
  });
  const orphanedTestCases = cases
    .filter((testCase) => invalidCaseIds.has(testCase.id))
    .map((testCase) => ({
      ...publicTestCase(testCase),
      traceabilityStatus: "INVALID" as const,
    }));
  const currentCriteria = enrichedCriteria.filter(
    (criterion) =>
      criterion.sourceRequirementVersion === requirement.currentVersion,
  );
  const eligible = currentCriteria.filter(
    (criterion) => criterion.eligibleForCoverage,
  );
  const coveredIds = new Set(
    eligible.filter((criterion) => criterion.covered).map(({ id }) => id),
  );
  const coverage = makeCoverage(eligible.length, coveredIds.size);
  const historicalCoverage = [
    ...new Set(
      enrichedCriteria
        .filter(
          (criterion) =>
            criterion.sourceRequirementVersion < requirement.currentVersion &&
            criterion.validRelationship,
        )
        .map((criterion) => criterion.sourceRequirementVersion),
    ),
  ]
    .sort((a, b) => a - b)
    .map((requirementVersion) => {
      const historicalEligible = enrichedCriteria.filter(
        (criterion) =>
          criterion.sourceRequirementVersion === requirementVersion &&
          criterion.validRelationship &&
          criterion.status === "APPROVED",
      );
      const historicalCovered = new Set(
        historicalEligible
          .filter((criterion) =>
            cases.some(
              (testCase) =>
                testCase.acceptanceCriterionId === criterion.id &&
                testCase.validRelationship &&
                testCase.sourceRequirementVersion === requirementVersion &&
                testCase.status === "APPROVED",
            ),
          )
          .map(({ id }) => id),
      );
      return {
        requirementVersion,
        coverage: makeCoverage(
          historicalEligible.length,
          historicalCovered.size,
        ),
      };
    });

  const currentCases = cases.filter(
    (testCase) =>
      testCase.sourceRequirementVersion === requirement.currentVersion,
  );
  const staleCases = cases.filter(
    (testCase) => testCase.traceabilityStatus === "STALE",
  );
  const invalidCriteria = criteria.filter(
    (criterion) => !criterion.validRelationship,
  );
  const gaps = createGaps({
    requirement,
    currentCriteria,
    currentCases,
    staleCases,
    orphanedTestCases,
  });
  const pendingAcceptanceCriteria = currentCriteria.filter(
    (criterion) => criterion.status === "DRAFT",
  ).length;
  const draftTestCases = currentCases.filter(
    (testCase) => testCase.validRelationship && testCase.status === "DRAFT",
  ).length;
  const approvedTestCases = currentCases.filter(
    (testCase) => testCase.validRelationship && testCase.status === "APPROVED",
  ).length;
  const rejectedTestCases = currentCases.filter(
    (testCase) => testCase.validRelationship && testCase.status === "REJECTED",
  ).length;
  const staleArtifacts =
    staleCases.length +
    enrichedCriteria.filter(
      (criterion) => criterion.traceabilityStatus === "HISTORICAL",
    ).length;
  const invalidArtifacts = invalidCriteria.length + orphanedTestCases.length;
  const coverageStatus: RequirementCoverageStatus =
    eligible.length === 0
      ? "NO_APPROVED_CRITERIA"
      : staleArtifacts > 0 ||
          invalidArtifacts > 0 ||
          pendingAcceptanceCriteria > 0 ||
          draftTestCases > 0
        ? "REQUIRES_REVIEW"
        : coveredIds.size === eligible.length
          ? "FULLY_COVERED"
          : coveredIds.size > 0
            ? "PARTIALLY_COVERED"
            : "NOT_COVERED";

  return {
    requirement,
    versions: [...versions].sort((a, b) => a - b),
    coverage: requirement.status === "ARCHIVED" ? makeCoverage(0, 0) : coverage,
    coverageStatus,
    counts: {
      acceptanceCriteria: currentCriteria.length,
      approvedAcceptanceCriteria: eligible.length,
      pendingAcceptanceCriteria,
      testCases: currentCases.filter((item) => item.validRelationship).length,
      approvedTestCases,
      draftTestCases,
      rejectedTestCases,
      coveredCriteria: coveredIds.size,
      uncoveredCriteria: eligible.length - coveredIds.size,
      staleArtifacts,
      invalidArtifacts,
    },
    historicalCoverage,
    acceptanceCriteria: enrichedCriteria.map((criterion) => {
      const { validRelationship: _valid, ...result } = criterion;
      void _valid;
      return result;
    }),
    orphanedTestCases,
    gaps,
  };
}

function publicTestCase<
  T extends { validRelationship: boolean; criterion?: unknown },
>(testCase: T) {
  const {
    validRelationship: _valid,
    criterion: _criterion,
    ...result
  } = testCase;
  void _valid;
  void _criterion;
  return result;
}

export function makeCoverage(
  eligibleCriteria: number,
  coveredCriteria: number,
): CoverageValue {
  const denominator = Math.max(0, eligibleCriteria);
  const numerator = Math.max(0, Math.min(coveredCriteria, denominator));
  if (denominator === 0)
    return {
      status: "NOT_APPLICABLE",
      eligibleCriteria: 0,
      coveredCriteria: 0,
      uncoveredCriteria: 0,
      percentage: null,
    };
  return {
    status: "APPLICABLE",
    eligibleCriteria: denominator,
    coveredCriteria: numerator,
    uncoveredCriteria: denominator - numerator,
    percentage: Math.round((numerator / denominator) * 1000) / 10,
  };
}

function createGaps(input: {
  requirement: TraceRequirement;
  currentCriteria: Array<
    TraceCriterion & { traceabilityStatus: TraceabilityStatus }
  >;
  currentCases: Array<
    TraceTestCase & {
      traceabilityStatus: TraceabilityStatus;
      validRelationship: boolean;
      criterion?: TraceCriterion & { validRelationship: boolean };
    }
  >;
  staleCases: Array<
    TraceTestCase & {
      traceabilityStatus: TraceabilityStatus;
      validRelationship: boolean;
      criterion?: TraceCriterion & { validRelationship: boolean };
    }
  >;
  orphanedTestCases: Array<TraceTestCase & { traceabilityStatus: "INVALID" }>;
}): TraceGap[] {
  const { requirement } = input;
  if (requirement.status === "ARCHIVED") return [];
  const gaps: TraceGap[] = [];
  if (!input.currentCriteria.length)
    gaps.push({
      code: "NO_ACCEPTANCE_CRITERIA",
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      requirementTitle: requirement.title,
      requirementVersion: requirement.currentVersion,
      message: "This requirement version has no acceptance criteria.",
      recommendation: "Generate acceptance criteria and review each one.",
    });
  else if (
    !input.currentCriteria.some((criterion) => criterion.status === "APPROVED")
  )
    gaps.push({
      code: "NO_APPROVED_CRITERIA",
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      requirementTitle: requirement.title,
      requirementVersion: requirement.currentVersion,
      message:
        "Acceptance criteria exist, but none are approved for the current version.",
      recommendation:
        "Review the current acceptance criteria and approve resolved criteria.",
    });
  for (const criterion of input.currentCriteria) {
    const related = input.currentCases.filter(
      (item) => item.acceptanceCriterionId === criterion.id,
    );
    const base = {
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      requirementTitle: requirement.title,
      requirementVersion: requirement.currentVersion,
      acceptanceCriterionId: criterion.id,
      acceptanceCriterionTitle: criterion.title,
    };
    if (criterion.traceabilityStatus === "INVALID") {
      gaps.push({
        ...base,
        code: "INVALID_RELATIONSHIP",
        message: `Acceptance criterion ${criterion.title} has an invalid source relationship.`,
        recommendation:
          "Inspect the stored requirement and source version links.",
      });
      continue;
    }
    if (criterion.status === "DRAFT")
      gaps.push({
        ...base,
        code: "CRITERION_PENDING_APPROVAL",
        message: `Acceptance criterion ${criterion.title} is awaiting approval.`,
        recommendation: "Review this criterion in the requirement workflow.",
      });
    if (criterion.status === "REJECTED")
      gaps.push({
        ...base,
        code: "CRITERION_REJECTED",
        message: `Acceptance criterion ${criterion.title} was rejected.`,
        recommendation:
          "Revise or regenerate criteria for the current requirement version.",
      });
    if (criterion.status !== "APPROVED") continue;
    if (related.some((item) => item.traceabilityStatus === "INVALID")) {
      gaps.push({
        ...base,
        code: "INVALID_RELATIONSHIP",
        message: `A test case for ${criterion.title} has an invalid source relationship.`,
        recommendation:
          "Inspect the test case's requirement, criterion, version, and generation links.",
      });
      continue;
    }
    if (
      related.some(
        (item) => item.status === "APPROVED" && item.validRelationship,
      )
    )
      continue;
    const code = related.some((item) => item.status === "DRAFT")
      ? "DRAFT_TEST_CASES"
      : related.some((item) => item.status === "REJECTED")
        ? "REJECTED_TEST_CASES"
        : "NO_TEST_CASES";
    gaps.push({
      ...base,
      code,
      message:
        code === "DRAFT_TEST_CASES"
          ? `Acceptance criterion ${criterion.title} has test cases, but none are approved.`
          : code === "REJECTED_TEST_CASES"
            ? `Acceptance criterion ${criterion.title} has only rejected test cases.`
            : `Acceptance criterion ${criterion.title} has no approved test case.`,
      recommendation:
        code === "DRAFT_TEST_CASES"
          ? "Validate and review a draft test case, or generate another case."
          : "Generate or review a test case for this criterion.",
    });
  }
  for (const testCase of input.staleCases)
    gaps.push({
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      requirementTitle: requirement.title,
      requirementVersion: requirement.currentVersion,
      acceptanceCriterionId: testCase.acceptanceCriterionId,
      acceptanceCriterionTitle: testCase.criterion?.title,
      testCaseId: testCase.id,
      code: "STALE_TEST_CASE",
      message: `Test case ${testCase.title} belongs to requirement version ${testCase.sourceRequirementVersion}.`,
      recommendation:
        "Review historical evidence and generate current-version test cases where applicable.",
    });
  for (const testCase of input.orphanedTestCases)
    gaps.push({
      requirementId: requirement.id,
      requirementKey: requirement.requirementKey,
      requirementTitle: requirement.title,
      requirementVersion: requirement.currentVersion,
      acceptanceCriterionId: testCase.acceptanceCriterionId,
      testCaseId: testCase.id,
      code: "INVALID_RELATIONSHIP",
      message: `Test case ${testCase.title} has an orphaned or inconsistent source relationship.`,
      recommendation:
        "Inspect the saved requirement, criterion, version, and generation-run links.",
    });
  return gaps;
}
