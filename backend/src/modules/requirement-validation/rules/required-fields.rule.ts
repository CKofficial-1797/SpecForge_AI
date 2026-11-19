import type { ValidationFinding } from "../validation.types.js";
import type { ValidationRule } from "./rule.types.js";

export const requiredFieldsRule: ValidationRule = {
  ruleId: "REQ_REQUIRED_FIELDS",
  ruleName: "Required information",
  category: "COMPLETENESS",
  description: "Checks that required requirement fields and its project exist.",
  defaultSeverity: "ERROR",
  execute({ requirement, projectExists }) {
    const fields = [
      ["title", requirement.title],
      ["description", requirement.description],
      ["requirementKey", requirement.requirementKey],
    ] as const;
    const findings: ValidationFinding[] = fields.flatMap(([field, value]) =>
      value.trim()
        ? []
        : [
            {
              ruleId: "REQ_REQUIRED_FIELDS",
              category: "COMPLETENESS" as const,
              severity: "ERROR" as const,
              title: `Missing ${field}`,
              description: `The requirement has no ${field}.`,
              evidence: `${field} is empty.`,
              recommendation: `Provide a non-empty ${field}.`,
              affectedField: field,
            },
          ],
    );
    if (!projectExists) {
      findings.push({
        ruleId: "REQ_REQUIRED_FIELDS",
        category: "COMPLETENESS",
        severity: "ERROR",
        title: "Project association is unavailable",
        description:
          "The requirement could not be associated with a valid project.",
        evidence: `Project ${requirement.projectId} was not found.`,
        recommendation:
          "Restore the requirement's valid project association before reviewing it.",
        affectedField: "projectId",
      });
    }
    return { findings };
  },
};
