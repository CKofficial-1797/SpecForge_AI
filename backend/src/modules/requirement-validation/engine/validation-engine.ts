import {
  RULE_SET_VERSION,
  DEFAULT_VALIDATION_CONFIGURATION,
} from "../validation.constants.js";
import { validationReportSchema } from "../schemas/validation-result.schema.js";
import type { ValidationRule } from "../rules/rule.types.js";
import type {
  ValidationContext,
  ValidationFinding,
  ValidationReport,
  ValidationConfiguration,
  RuleResult,
} from "../validation.types.js";
import { RULE_REGISTRY } from "./rule-registry.js";

export interface ValidationEngineOptions {
  configuration?: ValidationConfiguration;
  rules?: readonly ValidationRule[];
  analyzedAt?: Date;
  ruleSetVersion?: string;
}

export function executeValidation(
  context: ValidationContext,
  options: ValidationEngineOptions = {},
): ValidationReport {
  const configuration =
    options.configuration ?? DEFAULT_VALIDATION_CONFIGURATION;
  const rules = options.rules ?? RULE_REGISTRY;
  const ruleResults: RuleResult[] = rules.map((rule) => {
    try {
      const execution = rule.execute(context, configuration);
      const findings = deduplicateFindings(execution.findings);
      if (execution.skipReason) {
        if (findings.length > 0) {
          throw new Error("A skipped rule returned findings");
        }
        return {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          executionStatus: "SKIPPED",
          findings: [],
          explanation: execution.skipReason,
        };
      }
      if (findings.length > 0) {
        return {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          executionStatus: "ISSUES_FOUND",
          findings,
          explanation: `${findings.length} finding${findings.length === 1 ? "" : "s"} produced by this check.`,
        };
      }
      return {
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        executionStatus: "PASSED",
        findings: [],
        explanation: "No issue was detected by this heuristic.",
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "validation_rule_failed",
          ruleId: rule.ruleId,
          errorType: error instanceof Error ? error.name : typeof error,
        }),
      );
      return {
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        executionStatus: "SKIPPED",
        findings: [],
        explanation:
          "This check could not be completed because of an internal error. Retry validation; if it persists, contact support.",
      };
    }
  });

  const findings = deduplicateFindings(
    ruleResults.flatMap((result) => result.findings),
  );
  const report = {
    requirementId: context.requirement.id,
    requirementVersion: context.requirement.currentVersion,
    analyzedAt: (options.analyzedAt ?? new Date()).toISOString(),
    ruleSetVersion: options.ruleSetVersion ?? RULE_SET_VERSION,
    summary: {
      errors: findings.filter((finding) => finding.severity === "ERROR").length,
      warnings: findings.filter((finding) => finding.severity === "WARNING")
        .length,
      informationalFindings: findings.filter(
        (finding) => finding.severity === "INFO",
      ).length,
      passedRules: ruleResults.filter(
        (result) => result.executionStatus === "PASSED",
      ).length,
      rulesWithIssues: ruleResults.filter(
        (result) => result.executionStatus === "ISSUES_FOUND",
      ).length,
      skippedRules: ruleResults.filter(
        (result) => result.executionStatus === "SKIPPED",
      ).length,
    },
    ruleResults,
    findings,
    suggestedNextActions: [
      ...new Set(findings.map((finding) => finding.recommendation)),
    ],
  } satisfies ValidationReport;
  return validationReportSchema.parse(report);
}

function deduplicateFindings(
  findings: ValidationFinding[],
): ValidationFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const referenceIds =
      finding.relatedRequirements
        ?.map((item) => item.requirementId)
        .sort()
        .join(",") ?? "";
    const key = `${finding.ruleId}|${finding.title}|${finding.evidence}|${referenceIds}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
