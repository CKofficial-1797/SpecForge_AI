import { z } from "zod";

const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const statusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const projectIdParamsSchema = z.object({ projectId: z.uuid() });
export const requirementIdParamsSchema = z.object({ requirementId: z.uuid() });
export const versionParamsSchema = z.object({
  requirementId: z.uuid(),
  versionNumber: z.coerce.number().int().min(1),
});

export const createRequirementSchema = z
  .object({
    requirementKey: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(20000),
    priority: prioritySchema.default("MEDIUM"),
    status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  })
  .strict();

export const listRequirementsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
  })
  .strict();

export const updateRequirementSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    requirementKey: z.string().trim().min(1).max(80).optional(),
    title: z.string().trim().min(1).max(180).optional(),
    description: z.string().trim().min(1).max(20000).optional(),
    priority: prioritySchema.optional(),
    status: statusSchema.optional(),
    changeSummary: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      [
        value.requirementKey,
        value.title,
        value.description,
        value.priority,
        value.status,
      ].some((field) => field !== undefined),
    { message: "At least one requirement field must be provided" },
  );

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type ListRequirementsQuery = z.infer<typeof listRequirementsQuerySchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
