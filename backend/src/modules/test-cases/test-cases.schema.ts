import { z } from "zod";
import { TEST_GENERATION_MAX_CASES } from "./test-cases.constants.js";

const text = (max: number) => z.string().trim().min(1).max(max);
export const requirementParams = z.object({ requirementId: z.uuid() });
export const testCaseParams = z.object({ testCaseId: z.uuid() });
export const emptyBody = z.object({}).strict();
export const updateTestCaseBody = z
  .object({
    title: text(180).optional(),
    description: text(2000).optional(),
    testType: z
      .enum([
        "POSITIVE",
        "NEGATIVE",
        "BOUNDARY",
        "VALIDATION",
        "FAILURE",
        "AUTHORIZATION",
        "RECOVERY",
      ])
      .optional(),
    preconditions: z.array(text(500)).max(20).optional(),
    testSteps: z.array(text(1000)).min(1).max(30).optional(),
    testData: z
      .array(z.object({ name: text(100), value: text(500) }).strict())
      .max(20)
      .optional(),
    expectedResult: text(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const generatedTestCaseSchema = z
  .object({
    acceptanceCriterionId: z.uuid(),
    title: text(180),
    description: text(2000),
    testType: z.enum([
      "POSITIVE",
      "NEGATIVE",
      "BOUNDARY",
      "VALIDATION",
      "FAILURE",
      "AUTHORIZATION",
      "RECOVERY",
    ]),
    preconditions: z.array(text(500)).max(20),
    testSteps: z.array(text(1000)).min(1).max(30),
    testData: z
      .array(z.object({ name: text(100), value: text(500) }).strict())
      .max(20),
    expectedResult: text(2000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  })
  .strict();

export const testGenerationOutputSchema = z
  .object({
    testCases: z.array(generatedTestCaseSchema).max(TEST_GENERATION_MAX_CASES),
    limitations: z.array(text(600)).max(20),
  })
  .strict();
export type GeneratedTestCase = z.infer<typeof generatedTestCaseSchema>;
export type TestGenerationOutput = z.infer<typeof testGenerationOutputSchema>;
