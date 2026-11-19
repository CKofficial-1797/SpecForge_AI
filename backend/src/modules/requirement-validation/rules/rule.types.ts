import type {
  FindingCategory,
  FindingSeverity,
  ValidationContext,
  ValidationFinding,
  ValidationConfiguration,
} from "../validation.types.js";

export interface ValidationRule {
  ruleId: string;
  ruleName: string;
  category: FindingCategory;
  description: string;
  defaultSeverity: FindingSeverity;
  execute(
    context: ValidationContext,
    configuration: ValidationConfiguration,
  ): { findings: ValidationFinding[]; skipReason?: string };
}
