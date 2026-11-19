import { z } from "zod";

export const projectTraceabilityParams = z.object({ projectId: z.uuid() });
export const requirementTraceabilityParams = z.object({
  requirementId: z.uuid(),
});
export const acceptanceTraceabilityParams = z.object({ criterionId: z.uuid() });
export const testCaseTraceabilityParams = z.object({ testCaseId: z.uuid() });
export const traceabilityPageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TraceabilityPageQuery = z.infer<typeof traceabilityPageQuery>;
