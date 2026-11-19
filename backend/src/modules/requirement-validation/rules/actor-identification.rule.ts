import type { ValidationRule } from "./rule.types.js";

const actor =
  /\b(?:users?|customers?|administrators?|admins?|operators?|agents?|members?|clients?|(?:the\s+)?systems?|(?:the\s+)?applications?|(?:the\s+)?services?|(?:the\s+)?apis?|(?:the\s+)?platforms?|(?:the\s+)?devices?|the operator)\b/i;
const passiveConstruction =
  /\b(?:is|are|was|were|be|been|being)\s+[a-z]+(?:ed|en)\b/i;

export const actorIdentificationRule: ValidationRule = {
  ruleId: "REQ_ACTOR_IDENTIFICATION",
  ruleName: "Actor identification",
  category: "STRUCTURE",
  description:
    "Checks whether the requirement names a likely responsible actor or system.",
  defaultSeverity: "WARNING",
  execute({ requirement }) {
    const text = `${requirement.title}. ${requirement.description}`;
    if (actor.test(text) || passiveConstruction.test(text))
      return { findings: [] };
    return {
      findings: [
        {
          ruleId: "REQ_ACTOR_IDENTIFICATION",
          category: "STRUCTURE",
          severity: "WARNING",
          title: "Responsible actor is unclear",
          description:
            "The text does not clearly identify who performs the behavior or which system is responsible.",
          evidence:
            "No recognized actor or system term was found, and no common passive construction was detected.",
          recommendation:
            "Name the user, role, external actor, or system that performs or owns the behavior.",
          affectedField: "description",
        },
      ],
    };
  },
};
