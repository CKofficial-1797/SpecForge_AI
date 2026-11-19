import type {
  RequirementInputForValidation,
  RelatedRequirement,
  ValidationContext,
} from "../validation.types.js";

export function createValidationContext(input: {
  requirement: RequirementInputForValidation;
  relatedRequirements: RelatedRequirement[];
  projectExists: boolean;
}): ValidationContext {
  return {
    requirement: { ...input.requirement },
    relatedRequirements: [...input.relatedRequirements]
      .filter((item) => item.id !== input.requirement.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    projectExists: input.projectExists,
  };
}
