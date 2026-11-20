# Five-slide competition presentation outline

**Evidence cutoff:** 2026-11-20. Screenshots and competition metrics are not included yet. Do not add unverified success rates or performance claims.

## Slide 1 — Problem and opportunity

**Headline:** Ambiguous requirements make downstream work guess.

- Teams receive requests such as “secure and easy to use” without defined conditions or outcomes.
- Missing decisions propagate into implementation, acceptance, and testing.
- SpecForge makes uncertainty, missing details, and source relationships reviewable early.

**Visual:** One short vague requirement beside its unanswered product questions. Use the actual demo requirement text; label it as a demonstration example.

## Slide 2 — Solution and product workflow

**Headline:** From requirement to reviewable engineering evidence.

Show the implemented workflow: requirement and immutable version → deterministic validation → optional AI analysis → clarification and human answer → refinement draft and explicit approval → version-bound acceptance criteria → test-case drafts and validation → traceability and coverage.

**Visual:** Simple left-to-right workflow with “human review” gates called out at refinement, criterion, and test-case approval. Mark downstream acceptance/test workflows as still unreliable in this verified demo build.

## Slide 3 — AI and harness engineering

**Headline:** Constrain inputs and outputs; keep decisions with people.

- Backend-only local Ollama integration, Qwen2.5 3B for the measured local run.
- Bounded database context, versioned prompts, structured output schemas, Zod validation, reference and grounding checks.
- Deterministic validation stays separate from AI findings.
- AI outputs remain drafts; no automatic approval or execution of generated instructions.
- Prompt injection defenses are layered and measured against a small synthetic set; they do not prove immunity.

**Evidence:** 14-case evaluation had 11 valid outputs and 3 rejections; marker echo was 0/14. This is a narrow synthetic evaluation, not a general quality score. Real analysis and refinement succeeded; acceptance generation was rejected by a strict grounding guard. Cloud inference remains deferred after HTTP 402 quota response.

## Slide 4 — Product demonstration and engineering quality

**Headline:** Real local inference, versioned decisions, visible limits.

- Use genuine screenshots only after manual capture; none were captured in this pass.
- Show the real version-1 analysis, clarification answer history, and approved version-2 refinement.
- Show the validation report's actual counts only with the report/version visible.
- State clearly that acceptance criteria and test cases have not been demonstrated successfully in the current demo data.
- Prior verification baseline: frontend unit tests 10; backend unit tests 63; PostgreSQL integration 22. These are previously recorded results, not rerun in Phase 9.

## Slide 5 — Impact, limitations, and future scope

**Headline:** Make requirement uncertainty actionable and traceable.

- Product value: fewer implicit assumptions, clearer handoffs, and evidence linked to exact requirement versions.
- Current prototype: local analysis, clarification history, refinement review, deterministic validation, traceability foundations.
- Limitations: acceptance and test generation remain unreliable; no authentication/authorization; no reviewer identity; SEC-010 Prisma/Effect advisory remains open; cloud verification deferred; screenshots/video not produced.
- Future work: stabilize grounded acceptance/test generation, implement a suitable identity and project-access model, resolve SEC-010 with a compatible tested update, then capture and record the competition demo.

Do not imply customer adoption, measured business impact, competition results, successful public deployment, or complete end-to-end AI generation.
