import { describe, expect, it } from "vitest";
import {
  changedMetadataFields,
  changedVersionFields,
} from "./requirement-versioning.js";

describe("requirement change classification", () => {
  it("versions only title, description, and priority changes", () => {
    expect(
      changedVersionFields(
        { title: "Login", description: "Current", priority: "MEDIUM" },
        { title: "Login", description: "Updated", priority: "MEDIUM" },
      ),
    ).toEqual(["description"]);
  });

  it("treats key and status changes as metadata", () => {
    expect(
      changedMetadataFields(
        { requirementKey: "REQ-1", status: "DRAFT" },
        { requirementKey: "REQ-2", status: "ACTIVE" },
      ),
    ).toEqual(["requirementKey", "status"]);
    expect(
      changedVersionFields(
        { title: "Login", description: "Current", priority: "MEDIUM" },
        {},
      ),
    ).toEqual([]);
  });
});
