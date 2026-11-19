import { actionIdentificationRule } from "../rules/action-identification.rule.js";
import { actorIdentificationRule } from "../rules/actor-identification.rule.js";
import { conflictingRequirementRule } from "../rules/conflicting-requirement.rule.js";
import { duplicateRequirementRule } from "../rules/duplicate-requirement.rule.js";
import { failureConditionRule } from "../rules/failure-condition.rule.js";
import { measurableConditionRule } from "../rules/measurable-condition.rule.js";
import { requiredFieldsRule } from "../rules/required-fields.rule.js";
import { responseConditionRule } from "../rules/response-condition.rule.js";
import { vagueLanguageRule } from "../rules/vague-language.rule.js";
import type { ValidationRule } from "../rules/rule.types.js";

export const RULE_REGISTRY: readonly ValidationRule[] = [
  requiredFieldsRule,
  vagueLanguageRule,
  measurableConditionRule,
  actorIdentificationRule,
  actionIdentificationRule,
  responseConditionRule,
  failureConditionRule,
  duplicateRequirementRule,
  conflictingRequirementRule,
];
