import { z } from "zod";

const projectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const projectIdParamsSchema = z.object({
  projectId: z.uuid(),
});

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const listProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: projectStatusSchema.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one project field must be provided",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
