export type FindingCategory =
  | "COMPLETENESS"
  | "CLARITY"
  | "MEASURABILITY"
  | "STRUCTURE"
  | "CONSISTENCY"
  | "DUPLICATION";
export type FindingSeverity = "ERROR" | "WARNING" | "INFO";
export type RuleExecutionStatus = "PASSED" | "ISSUES_FOUND" | "SKIPPED";

export interface RequirementInputForValidation {
  id: string;
  projectId: string;
  requirementKey: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  currentVersion: number;
}

export interface RelatedRequirement {
  id: string;
  requirementKey: string;
  title: string;
  description: string;
}

export interface RequirementReference {
  requirementId: string;
  requirementKey: string;
  title: string;
}

export interface ValidationFinding {
  ruleId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  affectedField?: "title" | "description" | "requirementKey" | "projectId";
  relatedRequirements?: RequirementReference[];
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  executionStatus: RuleExecutionStatus;
  findings: ValidationFinding[];
  explanation: string;
}

export interface ValidationReport {
  requirementId: string;
  requirementVersion: number;
  analyzedAt: string;
  ruleSetVersion: string;
  summary: {
    errors: number;
    warnings: number;
    informationalFindings: number;
    passedRules: number;
    rulesWithIssues: number;
    skippedRules: number;
  };
  ruleResults: RuleResult[];
  findings: ValidationFinding[];
  suggestedNextActions: string[];
}

export interface ValidationContext {
  requirement: RequirementInputForValidation;
  relatedRequirements: RelatedRequirement[];
  projectExists: boolean;
}

export interface ValidationConfiguration {
  vagueTerms: readonly string[];
}
