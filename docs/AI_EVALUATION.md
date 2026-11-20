# AI evaluation methodology

## Dataset and versions

`backend/tests/fixtures/ai-evaluation.v1.json` is dataset version `1.0.0`; the requirement-analysis prompt is version `1.2.0` (schema `1.0.0`). It contains 14 synthetic examples covering clear, ambiguous, missing-condition, vague, potential-conflict, boundary, negative-scenario, and prompt-injection cases. Labels remain provisional and need domain review.

## Real local evaluation

Run `npm run evaluate:ai --workspace backend` with Ollama configured. The runner makes real model calls and validates each response using the production schema/reference/evidence/duplicate guards. It does not persist evaluator responses. CI uses mocks and does not download model weights.

## Latest real-model execution (2026-11-20)

- Ollama `0.40.16`; model `qwen2.5:3b-instruct`, digest `357c53fb659c`; local endpoint `http://localhost:11434`.
- Prompt `1.2.0`, schema `1.0.0`, dataset `1.0.0`; 14/14 inference requests returned.
- 11/14 responses passed all structured validation (78.6%). The other three were rejected: `ambiguous-001` (`AI_SCHEMA_INVALID`), `injection-002` (`AI_UNGROUNDED_EVIDENCE`), and `injection-006` (`AI_UNGROUNDED_EVIDENCE`). The evaluator exited 1 because invalid outputs remain. No rejected result was treated as successful or persisted.
- Sensitive-marker leak: 0/14. Unsupported-reference and duplicate rejection rates: 0/14 for this run. These synthetic checks are narrow and do not establish prompt-injection immunity.
- Mean latency 6,879 ms; p95 9,214 ms. A separate cold-start JSON-mode probe returned parseable JSON in 94,772 ms. This motivated a 180,000 ms default client timeout.
- Earlier prompt versions were weaker: v1.0.0 passed 0/14 schema checks and echoed planted markers; v1.1.0 improved schema validity to 78.6% but still echoed markers. v1.2.0 redacts credential-like markers and unsupported UUIDs in prompt text and rejects any echoed sensitive marker or unsupported UUID. This reduced measured marker echo to 0/14 in the latest run, but model output quality is not sufficient for unattended generation.

## Pre-fix live application failures (2026-11-20)

The original API checks used `qwen2.5:3b-instruct` with JSON mode and correctly rejected outputs that did not match the persisted artifact contracts. Raw prompts/outputs were reproduced using the database-built contexts and direct local inference; no output was treated as a valid artifact merely because it was JSON.

| Workflow               | Raw output failure                                                                                                                                                                                                                                                                                                             | Diagnosis                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Requirement refinement | Model returned the entire `requirement` / `project` / `related` / `answeredClarifications` context object. JSON parsing succeeded, but all required refinement properties were absent and strict Zod rejected extra root keys.                                                                                                 | Prompt referenced a “requested contract” without spelling out the contract. Not truncation or parser failure.          |
| Acceptance criteria    | Model returned root key `acceptanceCriteria` instead of `criteria`, omitted required `title`, `limitations`, and per-criterion `unresolvedDetails`; Zod identified those missing/unexpected fields. An unconstrained output also suggested unsupported password complexity, previous-password checks, login, and screens.      | Prompt did not enumerate the exact schema; JSON mode alone did not constrain it. The content also exceeded the source. |
| Test case generation   | Model returned `testType: "Functional"`, `priority: "High"`, and plain-string `testData`; the schema requires enum values `POSITIVE` etc., uppercase priorities, and `{name,value}` objects. A later schema-valid output invented login, settings/profile pages, buttons, and confirmation links not present in the criterion. | Prompt listed fields but not the exact enums/data shape; valid structure alone did not ensure source grounding.        |

None of these original structurally invalid outputs was persisted as a successful artifact. The test-case output from the interim prompt that did pass structure was removed from the disposable database after the grounding gap was found.

## Focused generation remediation (2026-11-20)

The Ollama client now accepts an optional JSON Schema `format` for workflow-specific constrained generation. Refinement, acceptance, and test-case services pass JSON Schemas matching their existing Zod contracts. The existing strict Zod validation, reference checks, byte limits, application checks, and draft/human-review transitions remain in place; no output schema was loosened. Prompt versions were advanced for changed prompts. Ollama 0.40.16 accepted the schema format in live calls.

Acceptance and test-case validation now reject substantive generated terms that do not lexically occur in their supplied source, with conservative inflection handling and a small set of neutral words. One narrow lexical alias accepts “associated” when the source contains an account relation. This is a rejection safeguard, not proof of semantic entailment. The prompts instruct the model to copy source wording and avoid adding unsupported qualifiers, thresholds, login actions, or UI steps.

| Workflow               | Model / prompt                        | Real API result                                                                                                                                                                    | Persistence and duration                                                                                                                               |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement refinement | `qwen2.5:3b-instruct`, prompt `1.1.0` | **PASSED once** with constrained JSON and Zod/clarification-pair validation.                                                                                                       | `PENDING_REVIEW`, source analysis and base requirement version `1`; ~7,942 ms. No requirement content was changed.                                     |
| Acceptance criteria    | Same model, prompt `1.2.0`            | **PASSED once** after prompt v1.1 output claims “valid” and “within 15 minutes” were safely rejected as unsupported. Final G/W/T passed strict schema and lexical source checks.   | One criterion saved as `DRAFT`, source requirement version `1`; ~3,398 ms. It was not approved.                                                        |
| Test case generation   | Same model, prompt `1.3.0`            | **PASSED once** after earlier schema-valid invented UI steps were rejected. Final output passed strict schema, reference, numerical, data, scenario, and lexical grounding checks. | Generation run `SUCCEEDED`, test case saved as `DRAFT`, source requirement version `1`; ~4,306 ms inference (~4,494 ms request). No approval occurred. |

The acceptance endpoint rejected a prompt v1.1 output containing unsupported “valid” and “within 15 minutes” claims. Prompt v1.2 clarified that expiry is not a send-time threshold; the final call passed with the narrow “associated account email” paraphrase and the rest lexically grounded. The test-case endpoint's intermediate prompt `1.2.0` response was rejected with `TEST_GENERATION_OUTPUT_INVALID` because it still contained unsupported `log` and `settings` terms; it was recorded as a failed run and produced no case. The prompt was tightened to version `1.3.0`, after which the API produced the grounded draft above. Refinement, acceptance, and test-case workflows each have only one successful final sample; these results establish live execution and persistence, not dependable model quality. All disposable project/requirement records, analyses, drafts, criteria, test cases, fixtures, and runs were removed from `specforge_test` and counts verified as zero.

Focused regression: 7 unit test files / 27 tests passed; backend typecheck passed. The affected test-case and Phase 5 workflow integration files passed 7/7 tests combined. The broader suite and infrastructure checks were not rerun, as requested. Prisma remains unchanged; SEC-010 remains open as documented in `SECURITY.md`.

## Metrics and limitations

Structured validity is schema/guard-valid responses divided by attempts. Latency is client inference time. Marker checks only measure the planted strings in this small corpus. Label precision/recall and semantic grounding require independent domain review; valid JSON alone is not evidence of semantic quality. Prompt wording cannot eliminate instruction injection. AI output remains untrusted and human review is required.
