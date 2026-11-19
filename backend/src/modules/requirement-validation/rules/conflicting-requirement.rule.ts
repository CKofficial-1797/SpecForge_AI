import type {
  RequirementReference,
  ValidationContext,
} from "../validation.types.js";
import type { ValidationRule } from "./rule.types.js";

interface Policy {
  target: string;
  kind:
    | "AUTH_REQUIRED"
    | "AUTH_NOT_REQUIRED"
    | "SESSION_EXPIRES"
    | "SESSION_ACTIVE";
  minutes?: number;
}

function policy(text: string): Policy | undefined {
  const authRequired =
    /\b(?:requires? authentication|must authenticate|authenticated users? only|authentication is required)\b/i.test(
      text,
    );
  const authNotRequired =
    /\b(?:without authentication|without authenticating|authentication is not required|unauthenticated access is (?:allowed|permitted))\b/i.test(
      text,
    );
  if (authRequired !== authNotRequired) {
    const match =
      /\b(?:dashboard|admin(?:istration)?(?: area| panel)?|api|account|portal|system)\b/i.exec(
        text,
      );
    if (match)
      return {
        target: match[0].toLocaleLowerCase("en-US"),
        kind: authRequired ? "AUTH_REQUIRED" : "AUTH_NOT_REQUIRED",
      };
  }

  const expires =
    /\bsession\b[^.]{0,80}\bexpires?\s+after\s+(\d+)\s+(minutes?|hours?)\b/i.exec(
      text,
    );
  const stays =
    /\bsession\b[^.]{0,80}\bremains?\s+active\s+for\s+at\s+least\s+(\d+)\s+(minutes?|hours?)\b/i.exec(
      text,
    );
  if (expires || stays) {
    const match = expires ?? stays!;
    const amount = Number(match[1]);
    const minutes = /hour/i.test(match[2]) ? amount * 60 : amount;
    return {
      target: "session",
      kind: expires ? "SESSION_EXPIRES" : "SESSION_ACTIVE",
      minutes,
    };
  }
  return undefined;
}

function reference(
  context: ValidationContext,
  id: string,
): RequirementReference | undefined {
  if (id === context.requirement.id) {
    return {
      requirementId: id,
      requirementKey: context.requirement.requirementKey,
      title: context.requirement.title,
    };
  }
  const other = context.relatedRequirements.find((item) => item.id === id);
  return other
    ? {
        requirementId: id,
        requirementKey: other.requirementKey,
        title: other.title,
      }
    : undefined;
}

export const conflictingRequirementRule: ValidationRule = {
  ruleId: "REQ_CONFLICT",
  ruleName: "Potential explicit conflicts",
  category: "CONSISTENCY",
  description:
    "Compares a narrow set of explicit authentication and session-duration statements.",
  defaultSeverity: "WARNING",
  execute(context) {
    const currentPolicy = policy(
      `${context.requirement.title}. ${context.requirement.description}`,
    );
    if (!currentPolicy) {
      return {
        findings: [],
        ...(context.relatedRequirements.length === 0
          ? {
              skipReason:
                "No related requirements are available for comparison.",
            }
          : {
              skipReason: "No supported explicit policy statement was found.",
            }),
      };
    }
    const other = [...context.relatedRequirements]
      .filter((item) => item.id !== context.requirement.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .find((item) => {
        const candidate = policy(`${item.title}. ${item.description}`);
        if (!candidate || candidate.target !== currentPolicy.target)
          return false;
        if (
          currentPolicy.kind === "AUTH_REQUIRED" ||
          currentPolicy.kind === "AUTH_NOT_REQUIRED"
        ) {
          return (
            candidate.kind !== currentPolicy.kind &&
            (candidate.kind === "AUTH_REQUIRED" ||
              candidate.kind === "AUTH_NOT_REQUIRED")
          );
        }
        const isOpposite =
          currentPolicy.kind !== candidate.kind &&
          (candidate.kind === "SESSION_EXPIRES" ||
            candidate.kind === "SESSION_ACTIVE");
        return (
          isOpposite &&
          currentPolicy.minutes !== undefined &&
          candidate.minutes !== undefined &&
          (currentPolicy.kind === "SESSION_EXPIRES"
            ? currentPolicy.minutes
            : candidate.minutes) <
            (currentPolicy.kind === "SESSION_ACTIVE"
              ? currentPolicy.minutes
              : candidate.minutes)
        );
      });
    if (!other) {
      return {
        findings: [],
        skipReason:
          "No opposite statement matched the supported explicit conflict patterns.",
      };
    }
    const current = reference(context, context.requirement.id);
    const related = reference(context, other.id);
    return {
      findings: [
        {
          ruleId: "REQ_CONFLICT",
          category: "CONSISTENCY",
          severity: "WARNING",
          title: "Potential policy conflict needs human review",
          description:
            "Two explicit statements appear to express opposing policies for the same target. This narrow rule cannot establish a semantic contradiction; a person must review both statements.",
          evidence: `Current requirement: “${context.requirement.title} — ${context.requirement.description}” Related requirement ${other.requirementKey}: “${other.title} — ${other.description}”.`,
          recommendation:
            "Review both requirement owners and clarify which policy applies; the engine does not resolve or change either requirement.",
          affectedField: "description",
          relatedRequirements: [current, related].filter(
            (item): item is RequirementReference => item !== undefined,
          ),
        },
      ],
    };
  },
};
