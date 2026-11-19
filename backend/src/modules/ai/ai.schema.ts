import { z } from "zod";
export const requirementAnalysisParamsSchema = z.object({
  requirementId: z.uuid(),
});
export const aiAnalysisParamsSchema = z.object({
  requirementId: z.uuid(),
  analysisId: z.uuid(),
});
export const aiHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
