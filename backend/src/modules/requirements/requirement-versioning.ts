import type {
  RequirementPriority,
  RequirementStatus,
} from "../../generated/prisma/enums.js";

export interface VersionedRequirementFields {
  title: string;
  description: string;
  priority: RequirementPriority;
}

export interface RequirementMetadataFields {
  requirementKey: string;
  status: RequirementStatus;
}

export function changedVersionFields(
  current: VersionedRequirementFields,
  proposed: Partial<VersionedRequirementFields>,
): (keyof VersionedRequirementFields)[] {
  return (["title", "description", "priority"] as const).filter(
    (field) =>
      proposed[field] !== undefined && proposed[field] !== current[field],
  );
}

export function changedMetadataFields(
  current: RequirementMetadataFields,
  proposed: Partial<RequirementMetadataFields>,
): (keyof RequirementMetadataFields)[] {
  return (["requirementKey", "status"] as const).filter(
    (field) =>
      proposed[field] !== undefined && proposed[field] !== current[field],
  );
}
