import type { ValidationRule } from "./rule.types.js";

const action =
  /\b(?:create|creates|created|creating|submit|submits|submitted|submitting|retrieve|retrieves|retrieved|update|updates|updated|delete|deletes|deleted|authenticate|authenticates|authenticated|log\s+in|sign\s+in|validate|validates|validated|notify|notifies|notified|display|displays|displayed|calculate|calculates|calculated|store|stores|stored|save|saves|saved|send|sends|sent|receive|receives|received|reject|rejects|rejected|allow|allows|allowed|provide|provides|provided|search|searches|return|returns|returned|respond|responds|responded|upload|uploads|uploaded|download|downloads|downloaded|process|processes|processed|generate|generates|generated|transfer|transfers|transferred|record|records|recorded|expire|expires|expired|lock|locks|locked|encrypt|encrypts|encrypted|export|exports|import|imports|calculate|calculate|can\s+log\s+in)\b/i;
const passive = /\b(?:is|are|was|were|be|been|being)\s+[a-z]+(?:ed|en)\b/i;

export const actionIdentificationRule: ValidationRule = {
  ruleId: "REQ_ACTION_IDENTIFICATION",
  ruleName: "Action identification",
  category: "STRUCTURE",
  description:
    "Looks for recognizable behavior language without treating a verb list as proof of completeness.",
  defaultSeverity: "WARNING",
  execute({ requirement }) {
    const text = `${requirement.title}. ${requirement.description}`;
    if (action.test(text) || passive.test(text)) return { findings: [] };
    return {
      findings: [
        {
          ruleId: "REQ_ACTION_IDENTIFICATION",
          category: "STRUCTURE",
          severity: "WARNING",
          title: "System behavior is unclear",
          description:
            "No recognizable action or common passive behavior was detected by this heuristic.",
          evidence:
            "The requirement text contains no action from the supported vocabulary and no common passive construction.",
          recommendation:
            "Describe the observable action or behavior the actor or system must perform.",
          affectedField: "description",
        },
      ],
    };
  },
};
