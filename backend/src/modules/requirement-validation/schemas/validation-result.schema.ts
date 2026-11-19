import { z } from "zod";

export const requirementReferenceSchema = z
  .object({
    requirementId: z.uuid(),
    requirementKey: z.string().min(1),
    title: z.string().min(1),
  })
  .strict();

export const validationFindingSchema = z
  .object({
    ruleId: z.string().regex(/^REQ_[A-Z_]+$/),
    category: z.enum([
      "COMPLETENESS",
      "CLARITY",
      "MEASURABILITY",
      "STRUCTURE",
      "CONSISTENCY",
      "DUPLICATION",
    ]),
    severity: z.enum(["ERROR", "WARNING", "INFO"]),
    title: z.string().min(1),
    description: z.string().min(1),
    evidence: z.string().min(1),
    recommendation: z.string().min(1),
    affectedField: z
      .enum(["title", "description", "requirementKey", "projectId"])
      .optional(),
    relatedRequirements: z.array(requirementReferenceSchema).optional(),
  })
  .strict();

export const ruleResultSchema = z
  .object({
    ruleId: z.string().regex(/^REQ_[A-Z_]+$/),
    ruleName: z.string().min(1),
    executionStatus: z.enum(["PASSED", "ISSUES_FOUND", "SKIPPED"]),
    findings: z.array(validationFindingSchema),
    explanation: z.string().min(1),
  })
  .strict();

export const validationReportSchema = z
  .object({
    requirementId: z.uuid(),
    requirementVersion: z.number().int().positive(),
    analyzedAt: z.iso.datetime(),
    ruleSetVersion: z.string().min(1),
    summary: z
      .object({
        errors: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        informationalFindings: z.number().int().nonnegative(),
        passedRules: z.number().int().nonnegative(),
        rulesWithIssues: z.number().int().nonnegative(),
        skippedRules: z.number().int().nonnegative(),
      })
      .strict(),
    ruleResults: z.array(ruleResultSchema),
    findings: z.array(validationFindingSchema),
    suggestedNextActions: z.array(z.string().min(1)),
  })
  .strict();

export type ValidationReportData = z.infer<typeof validationReportSchema>;
