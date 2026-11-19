import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
export const refinementParams = z.object({ requirementId: z.uuid() });
export const refinementDraftParams = z.object({ draftId: z.uuid() });
export const refinementActionParams = z.object({ draftId: z.uuid() });
export const generateRefinementBody = z
  .object({ sourceAnalysisId: z.uuid() })
  .strict();
export const refinementOutputSchema = z
  .object({
    proposedTitle: text(180),
    proposedDescription: text(20000),
    changeSummary: text(1000),
    appliedClarifications: z
      .array(
        z
          .object({
            questionId: z.uuid(),
            answerId: z.uuid(),
            changeExplanation: text(800),
          })
          .strict(),
      )
      .max(20),
    remainingAmbiguities: z.array(text(800)).max(20),
    unresolvedQuestions: z.array(text(800)).max(32),
    assumptions: z.array(text(800)).max(20),
    warnings: z.array(text(800)).max(20),
  })
  .strict();
export type RefinementOutput = z.infer<typeof refinementOutputSchema>;
