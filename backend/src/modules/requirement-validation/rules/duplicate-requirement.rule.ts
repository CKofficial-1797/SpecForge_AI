import type { ValidationRule } from "./rule.types.js";

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const duplicateRequirementRule: ValidationRule = {
  ruleId: "REQ_DUPLICATE",
  ruleName: "Exact normalized duplicates",
  category: "DUPLICATION",
  description:
    "Detects exact duplicates after case, whitespace, and punctuation normalization.",
  defaultSeverity: "WARNING",
  execute({ requirement, relatedRequirements }) {
    const current = normalize(
      `${requirement.title} ${requirement.description}`,
    );
    const duplicates = relatedRequirements
      .filter((item) => item.id !== requirement.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .filter(
        (item) => normalize(`${item.title} ${item.description}`) === current,
      );
    if (duplicates.length === 0) {
      return {
        findings: [],
        ...(relatedRequirements.length === 0
          ? {
              skipReason: "No other requirements are available for comparison.",
            }
          : {}),
      };
    }
    return {
      findings: duplicates.map((duplicate) => ({
        ruleId: "REQ_DUPLICATE",
        category: "DUPLICATION",
        severity: "WARNING",
        title: "Potential exact duplicate",
        description:
          "Another requirement in this project has the same title and description after deterministic normalization.",
        evidence: `Normalized title and description match requirement ${duplicate.requirementKey}.`,
        recommendation:
          "Compare both requirements and decide whether they represent separate behaviors; no content was changed.",
        affectedField: "description",
        relatedRequirements: [
          {
            requirementId: duplicate.id,
            requirementKey: duplicate.requirementKey,
            title: duplicate.title,
          },
        ],
      })),
    };
  },
};
