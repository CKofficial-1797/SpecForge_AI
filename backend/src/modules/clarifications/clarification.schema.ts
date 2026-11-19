import { z } from "zod";

export const requirementParams = z.object({ requirementId: z.uuid() });
export const questionParams = z.object({ questionId: z.uuid() });
export const answerParams = z.object({
  questionId: z.uuid(),
  answerId: z.uuid(),
});
export const importQuestionsBody = z.object({ analysisId: z.uuid() }).strict();
export const answerBody = z
  .object({ answer: z.string().trim().min(1).max(5000) })
  .strict();
export const clarificationListQuery = z
  .object({ status: z.enum(["OPEN", "ANSWERED", "DISMISSED"]).optional() })
  .strict();
