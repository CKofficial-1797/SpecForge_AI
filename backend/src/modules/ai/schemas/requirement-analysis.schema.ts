import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const references = z.array(z.uuid()).max(8);
export const requirementAnalysisSchema = z
  .object({
    summary: text(1200),
    findings: z
      .array(
        z
          .object({
            basis: z.enum(["EXPLICIT", "MISSING", "INFERENCE", "UNCERTAINTY"]),
            category: z.enum([
              "AMBIGUITY",
              "MISSING_BUSINESS_RULE",
              "MISSING_CONDITION",
              "POTENTIAL_CONTRADICTION",
              "UNCLEAR_ACTOR",
              "UNCLEAR_OUTCOME",
            ]),
            severity: z.enum(["ERROR", "WARNING", "INFO"]),
            title: text(180),
            description: text(1200),
            evidence: text(1000),
            recommendation: text(800),
            affectedRequirementIds: references,
            confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
          })
          .strict(),
      )
      .max(20),
    clarificationQuestions: z
      .array(
        z
          .object({
            question: text(500).refine(
              (value) =>
                !/^(can you|could you) (provide|give) more details\??$/i.test(
                  value,
                ),
              "Question must be specific",
            ),
            reason: text(800),
            relatedRequirementIds: references,
          })
          .strict(),
      )
      .max(12),
    limitations: z.array(text(500)).max(12),
  })
  .strict();
export type RequirementAnalysis = z.infer<typeof requirementAnalysisSchema>;
