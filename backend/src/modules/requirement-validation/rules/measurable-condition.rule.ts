import type { ValidationRule } from "./rule.types.js";

const measurableClaim =
  /\b(performance|latency|response(?: time)?|respond(?:s|ed)?|throughput|concurrent|capacity|scale|scalability|availability|reliability|reliable|fast|quickly|efficient|efficiently|many users|highly available)\b/i;
const metricWithUnit =
  /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|minutes?|hours?|days?|users?|requests? per second|rps|percent|%|mb|gb|kb|transactions? per second)\b/i;
const workloadContext =
  /\b(?:under|with|at|during|while|for)\s+(?:a\s+)?\d[\d,]*(?:\.\d+)?\s*(?:concurrent\s+)?(?:users?|requests?|transactions?|items?|records?|load|workload)\b/i;

export const measurableConditionRule: ValidationRule = {
  ruleId: "REQ_MEASURABILITY",
  ruleName: "Measurable conditions",
  category: "MEASURABILITY",
  description:
    "Checks performance, scale, timing, and reliability claims for measurable conditions.",
  defaultSeverity: "WARNING",
  execute({ requirement }) {
    const text = requirement.description;
    if (!measurableClaim.test(text)) {
      return {
        findings: [],
        skipReason:
          "No performance, scale, timing, or reliability claim was detected.",
      };
    }
    if (metricWithUnit.test(text) && workloadContext.test(text))
      return { findings: [] };
    const evidence =
      text.match(measurableClaim)?.[0] ?? "A performance or scale claim";
    const missing = metricWithUnit.test(text)
      ? "A workload or measurement context is not stated."
      : "A measurable value and unit are not stated.";
    return {
      findings: [
        {
          ruleId: "REQ_MEASURABILITY",
          category: "MEASURABILITY",
          severity: "WARNING",
          title: "Measurable condition may be incomplete",
          description: `${missing} This heuristic cannot determine whether the condition is semantically complete.`,
          evidence: `Detected “${evidence}” without both a metric with unit and workload context.`,
          recommendation:
            "State a measurable condition, its unit, and the relevant workload or operating context where applicable.",
          affectedField: "description",
        },
      ],
    };
  },
};
