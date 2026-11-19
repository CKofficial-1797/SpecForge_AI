import type { ValidationRule } from "./rule.types.js";

const outcomeRelevant =
  /\b(?:submit|payment|transaction|upload|delete|remove|request|transfer|purchase|process)\w*\b/i;
const outcomeSpecified =
  /\b(?:then|after(?:ward)?|success(?:ful(?:ly)?)?|failure|fail(?:ed|s)?|error|confirmation|receipt|notify|display|return(?:s|ed)?|response|result|status|reject(?:s|ed)?)\b/i;

export const responseConditionRule: ValidationRule = {
  ruleId: "REQ_RESPONSE_CONDITION",
  ruleName: "Response or outcome",
  category: "COMPLETENESS",
  description:
    "Checks high-impact submitted actions for an observable outcome.",
  defaultSeverity: "WARNING",
  execute({ requirement }) {
    const text = requirement.description;
    if (!outcomeRelevant.test(text)) {
      return {
        findings: [],
        skipReason:
          "The requirement does not describe an action that this outcome check covers.",
      };
    }
    if (outcomeSpecified.test(text)) return { findings: [] };
    return {
      findings: [
        {
          ruleId: "REQ_RESPONSE_CONDITION",
          category: "COMPLETENESS",
          severity: "WARNING",
          title: "Expected outcome is unclear",
          description:
            "The described submission or transaction does not state what observable outcome follows.",
          evidence: `The text describes “${text.match(outcomeRelevant)?.[0]}” but no supported outcome indicator was found.`,
          recommendation:
            "State the expected result or user-visible response where it matters for this behavior.",
          affectedField: "description",
        },
      ],
    };
  },
};
