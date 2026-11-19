import type { ValidationRule } from "./rule.types.js";

const exceptionLanguage =
  /\b(?:fail(?:s|ed|ure)?|error|invalid|unsupported|declined|reject(?:s|ed)?|timeout|timed out|retry|no results?|empty result|boundary)\b/i;

export const failureConditionRule: ValidationRule = {
  ruleId: "REQ_FAILURE_CONDITION",
  ruleName: "Failure and boundary conditions",
  category: "COMPLETENESS",
  description:
    "Looks for a small set of behaviors where failure or boundary handling is commonly important.",
  defaultSeverity: "WARNING",
  execute({ requirement }) {
    const text = requirement.description;
    const topic =
      /\b(?:file\s+upload|upload(?:s|ed)?\s+(?:a\s+)?file|payment|password\s+(?:validation|constraints?|policy)|search(?:es|ing)?\s+(?:for|the|a|an)|search\s+results?)\b/i.exec(
        text,
      );
    if (!topic) {
      return {
        findings: [],
        skipReason: "No supported failure-sensitive behavior was detected.",
      };
    }
    let missing = "rejection, failure, or retry behavior";
    let conditionSpecified = exceptionLanguage.test(text);
    if (/file|upload/i.test(topic[0])) {
      missing = "file size, supported format, or unsupported-file behavior";
      conditionSpecified ||=
        /\b(?:format|extension|file type|(?:maximum|minimum|max|min|at most|at least)\s+\d+|\d+\s*(?:kb|mb|gb))\b/i.test(
          text,
        );
    } else if (/password/i.test(topic[0])) {
      missing = "the password boundary or invalid-password behavior";
      conditionSpecified ||=
        /\b(?:at least|at most|minimum|maximum|length|characters?|complexity|constraint|policy)\b/i.test(
          text,
        );
    } else if (/search/i.test(topic[0])) {
      missing = "the behavior when no results match";
      conditionSpecified ||=
        /\b(?:no results?|zero results?|empty results?|no matches?|not found)\b/i.test(
          text,
        );
    } else if (/payment/i.test(topic[0])) {
      missing = "payment failure, decline, or retry behavior";
      conditionSpecified ||=
        /\b(?:fail(?:s|ed|ure)?|error|declined|reject(?:s|ed)?|timeout|timed out|retry|reversal)\b/i.test(
          text,
        );
    }
    if (conditionSpecified) return { findings: [] };
    return {
      findings: [
        {
          ruleId: "REQ_FAILURE_CONDITION",
          category: "COMPLETENESS",
          severity: "WARNING",
          title: "Failure or boundary behavior may be missing",
          description: `This behavior can depend on ${missing}, but the text does not state how that case is handled.`,
          evidence: `Detected “${topic[0]}” without a supported failure or boundary term.`,
          recommendation:
            "Decide whether a failure or boundary case is in scope and state the intended behavior without assuming a policy.",
          affectedField: "description",
        },
      ],
    };
  },
};
