import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const acceptanceRequirementParams = z.object({
  requirementId: z.uuid(),
});
export const criterionParams = z.object({ criterionId: z.uuid() });
export const acceptanceOutputSchema = z
  .object({
    criteria: z
      .array(
        z
          .object({
            title: text(180),
            given: text(2000),
            when: text(2000),
            then: text(2000),
            unresolvedDetails: z.array(text(600)).max(10),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    limitations: z.array(text(600)).max(15),
  })
  .strict();
export const approvalBody = z.object({}).strict();
export type AcceptanceOutput = z.infer<typeof acceptanceOutputSchema>;
