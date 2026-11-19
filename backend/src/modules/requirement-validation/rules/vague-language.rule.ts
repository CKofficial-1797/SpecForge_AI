import type { ValidationRule } from "./rule.types.js";

function findTerm(text: string, term: string): string | undefined {
  const normalizedText = text.normalize("NFKC");
  const normalizedTerm = term.normalize("NFKC").trim();
  if (!normalizedTerm) return undefined;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped.replace(/\s+/g, "\\s+")}\\b`, "iu");
  return normalizedText.match(pattern)?.[0];
}

export const vagueLanguageRule: ValidationRule = {
  ruleId: "REQ_VAGUE_TERMS",
  ruleName: "Vague terminology",
  category: "CLARITY",
  description:
    "Finds configured vague phrases that may need a measurable definition.",
  defaultSeverity: "WARNING",
  execute({ requirement }, configuration) {
    const findings = configuration.vagueTerms.flatMap((term) => {
      const match = findTerm(requirement.description, term);
      return match
        ? [
            {
              ruleId: "REQ_VAGUE_TERMS",
              category: "CLARITY" as const,
              severity: "WARNING" as const,
              title: `Vague term: “${match}”`,
              description: `The term “${match}” may have different interpretations and does not define a measurable expectation.`,
              evidence: `Found “${match}” in the requirement description.`,
              recommendation:
                "Define the expected behavior or measurable condition for this term; do not rely on an unstated interpretation.",
              affectedField: "description" as const,
            },
          ]
        : [];
    });
    return { findings };
  },
};
