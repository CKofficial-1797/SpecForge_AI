import { describe, expect, it } from "vitest";
import { DEFAULT_VALIDATION_CONFIGURATION } from "../validation.constants.js";
import type { ValidationContext } from "../validation.types.js";
import { actionIdentificationRule } from "./action-identification.rule.js";
import { actorIdentificationRule } from "./actor-identification.rule.js";
import { conflictingRequirementRule } from "./conflicting-requirement.rule.js";
import { duplicateRequirementRule } from "./duplicate-requirement.rule.js";
import { failureConditionRule } from "./failure-condition.rule.js";
import { measurableConditionRule } from "./measurable-condition.rule.js";
import { requiredFieldsRule } from "./required-fields.rule.js";
import { responseConditionRule } from "./response-condition.rule.js";
import { vagueLanguageRule } from "./vague-language.rule.js";

const uuid = "00000000-0000-4000-8000-000000000001";
const otherUuid = "00000000-0000-4000-8000-000000000002";

function context(
  description: string,
  relatedRequirements: ValidationContext["relatedRequirements"] = [],
  title = "Requirement",
): ValidationContext {
  return {
    requirement: {
      id: uuid,
      projectId: "00000000-0000-4000-8000-000000000003",
      requirementKey: "REQ-1",
      title,
      description,
      priority: "MEDIUM",
      status: "ACTIVE",
      currentVersion: 1,
    },
    relatedRequirements,
    projectExists: true,
  };
}

const execute = (rule: typeof vagueLanguageRule, input: ValidationContext) =>
  rule.execute(input, DEFAULT_VALIDATION_CONFIGURATION);

describe("independent requirement validation rules", () => {
  it("checks required information and valid project association", () => {
    const incomplete = context("Present description");
    incomplete.requirement.title = " ";
    incomplete.requirement.requirementKey = "";
    incomplete.projectExists = false;
    const result = execute(requiredFieldsRule, incomplete);
    expect(result.findings.map(({ affectedField }) => affectedField)).toEqual([
      "title",
      "requirementKey",
      "projectId",
    ]);
    expect(
      execute(requiredFieldsRule, context("A complete description")).findings,
    ).toHaveLength(0);
  });

  it("detects configured vague terms with word boundaries and Unicode normalization", () => {
    expect(
      execute(vagueLanguageRule, context("The system should respond quickly."))
        .findings[0]?.evidence,
    ).toContain("quickly");
    expect(
      execute(vagueLanguageRule, context("This is quicksilver behavior."))
        .findings,
    ).toHaveLength(0);
    expect(
      execute(vagueLanguageRule, context("An EFFICIENT response is required."))
        .findings,
    ).toHaveLength(1);
    expect(execute(vagueLanguageRule, context("")).findings).toHaveLength(0);
    expect(
      vagueLanguageRule.execute(context("The service is speedy."), {
        vagueTerms: ["speedy"],
      }).findings,
    ).toHaveLength(1);
  });

  it("checks measurable claims conservatively, including workload and units", () => {
    expect(
      execute(measurableConditionRule, context("The system should be fast."))
        .findings,
    ).toHaveLength(1);
    expect(
      execute(
        measurableConditionRule,
        context(
          "The API must return a response within 200 milliseconds under 500 concurrent requests.",
        ),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(
        measurableConditionRule,
        context("The API responds within 200 ms."),
      ).findings[0]?.description,
    ).toContain("workload");
    expect(
      execute(
        measurableConditionRule,
        context("Users can change their profile name."),
      ).skipReason,
    ).toBeDefined();
  });

  it("accepts a named actor, warns when absent, and does not reject common passive voice", () => {
    expect(
      execute(actorIdentificationRule, context("Registered users can log in."))
        .findings,
    ).toHaveLength(0);
    expect(
      execute(actorIdentificationRule, context("Can log in using an email."))
        .findings,
    ).toHaveLength(1);
    expect(
      execute(
        actorIdentificationRule,
        context("Credentials are stored securely."),
      ).findings,
    ).toHaveLength(0);
  });

  it("identifies actions heuristically and recognizes action wording case-insensitively", () => {
    expect(
      execute(
        actionIdentificationRule,
        context("Registered users can authenticate with email and password."),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(actionIdentificationRule, context("The value is blue.")).findings,
    ).toHaveLength(1);
    expect(
      execute(
        actionIdentificationRule,
        context("Files are stored after upload."),
      ).findings,
    ).toHaveLength(0);
  });

  it("checks relevant submissions for an outcome without applying it to every requirement", () => {
    expect(
      execute(responseConditionRule, context("Users can submit a payment."))
        .findings,
    ).toHaveLength(1);
    expect(
      execute(
        responseConditionRule,
        context("Users can submit a payment and receive a confirmation."),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(
        responseConditionRule,
        context("The application displays a dashboard."),
      ).skipReason,
    ).toBeDefined();
  });

  it("only warns about missing failure or boundary conditions for supported topics", () => {
    expect(
      execute(
        failureConditionRule,
        context("The service accepts a file upload."),
      ).findings,
    ).toHaveLength(1);
    expect(
      execute(
        failureConditionRule,
        context(
          "The service accepts a file upload and rejects unsupported formats.",
        ),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(failureConditionRule, context("Users can update their profile."))
        .skipReason,
    ).toBeDefined();
    expect(
      execute(
        failureConditionRule,
        context("The search returns no results when there are no matches."),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(
        failureConditionRule,
        context("The system validates password constraints."),
      ).findings,
    ).toHaveLength(1);
    expect(
      execute(
        failureConditionRule,
        context("The system validates passwords with at least 12 characters."),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(
        failureConditionRule,
        context(
          "The service accepts a file upload with a maximum size of 10 MB.",
        ),
      ).findings,
    ).toHaveLength(0);
  });

  it("detects only exact normalized duplicates, not approximate matches", () => {
    const other = {
      id: otherUuid,
      requirementKey: "REQ-2",
      title: "Create a profile",
      description: "Users can create a profile.",
    };
    expect(
      execute(
        duplicateRequirementRule,
        context("Users can create a profile!", [other], "Create a profile"),
      ).findings[0]?.relatedRequirements?.[0]?.requirementId,
    ).toBe(otherUuid);
    expect(
      execute(
        duplicateRequirementRule,
        context("Users can create the profile.", [other]),
      ).findings,
    ).toHaveLength(0);
    expect(
      execute(duplicateRequirementRule, context("No duplicate", [])).skipReason,
    ).toBeDefined();
  });

  it("flags only supported opposing explicit policies and references both requirements", () => {
    const other = {
      id: otherUuid,
      requirementKey: "REQ-2",
      title: "Dashboard access",
      description: "All dashboard access requires authentication.",
    };
    const result = execute(
      conflictingRequirementRule,
      context("Users can access the dashboard without authentication.", [
        other,
      ]),
    );
    expect(result.findings).toHaveLength(1);
    expect(
      result.findings[0]?.relatedRequirements?.map(
        (item) => item.requirementId,
      ),
    ).toEqual([uuid, otherUuid]);
    expect(
      execute(
        conflictingRequirementRule,
        context("The system should be secure.", [other]),
      ).skipReason,
    ).toBeDefined();

    const session = {
      id: otherUuid,
      requirementKey: "REQ-3",
      title: "Session active duration",
      description: "The session remains active for at least 60 minutes.",
    };
    expect(
      execute(
        conflictingRequirementRule,
        context("The session expires after 15 minutes.", [session]),
      ).findings,
    ).toHaveLength(1);
  });
});
