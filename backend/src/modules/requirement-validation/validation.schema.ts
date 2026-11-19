import { z } from "zod";

export const validationRequirementParamsSchema = z.object({
  requirementId: z.uuid(),
});
export const validationReportParamsSchema = z.object({
  requirementId: z.uuid(),
  reportId: z.uuid(),
});
export const validationProjectParamsSchema = z.object({ projectId: z.uuid() });
export const validationHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
