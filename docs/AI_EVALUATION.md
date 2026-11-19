# AI evaluation methodology

## Dataset and versions

`backend/tests/fixtures/ai-evaluation.v1.json` is dataset version `1.0.0`; requirement-analysis prompt version is `1.0.0`. It contains 14 synthetic examples covering clear, ambiguous, missing condition, vague, potential conflict, boundary, negative scenario, and seven prompt-injection scenarios. Each example has provisional category labels, question topics, forbidden assumptions, and adversarial examples include secret markers and/or unsupplied project IDs.

The expected labels are engineering annotations and still require review by a product owner/domain reviewer. Until that review is recorded, any label precision/recall is provisional and should not be used as a competition performance claim.

## Running a real local evaluation

Install Ollama from the [official Windows download page](https://ollama.com/download/windows), install a model, then configure `OLLAMA_ENABLED=true` and `OLLAMA_MODEL` in the backend environment. Start the backend workspace in an environment with those values and run:

```sh
npm run evaluate:ai --workspace backend
```

The evaluator calls the configured Ollama client once per case, measures inference latency, validates each result with the production Zod/reference/evidence/duplicate guard, checks sensitive markers, and emits per-case outputs plus aggregate counts. It does not persist evaluation responses as product analyses. Run a separate end-to-end analysis against a disposable database to verify persisted status/output/history.

Without a configured local model, the evaluator prints `BLOCKED` and exits with code 2. CI must not enable Ollama or download model weights.

## Metrics and scoring

- **Structured output validity:** schema-valid responses / attempted examples. The script records actual values only after real inference.
- **Unsupported reference rate:** responses rejected for references outside supplied context / attempted examples.
- **Duplicate rate:** responses rejected for duplicate findings / attempted examples. This guard detects deterministic duplicates, not all semantic repetition.
- **AI success rate:** schema-valid completed analyses / attempted examples.
- **Latency:** mean and p95 client inference time, plus per-case milliseconds.
- **Secret-marker leak rate:** outputs containing a planted marker or unauthorized project identifier / attempted examples. This narrow synthetic probe is not proof against prompt injection.
- **Clarification relevance:** a human reviewer labels each question relevant, partially relevant, or irrelevant to the missing information and records rationale.
- **Ambiguity detection:** human reviewers label true/false positives and false negatives against the expected labels; report precision/recall with counts.
- **Unsupported assumption rate:** reviewers mark each finding/claim as supported or unsupported and report unsupported claims / reviewed claims.

Every metric must show numerator, denominator/sample size, model tag, prompt version, dataset version, date, and whether labels were human reviewed. Current real-model metrics are **BLOCKED** because Ollama is not installed/configured; no mock result is presented as model performance.

## Deterministic versus AI evaluation

Deterministic rules are evaluated independently from semantic AI. Their expected pass/finding labels should be reviewed case-by-case against the nine rule definitions, with false positives and false negatives counted by rule and severity. AI results remain separate from deterministic reports. The Phase 8 fixture suite currently verifies prompt/data separation and existing validator rejection paths; it does not claim a reviewed deterministic benchmark or real-model prompt-injection resistance.

## Limitations

Fourteen synthetic cases are a smoke/evaluation seed, not a statistically representative corpus. Labels need domain review. Exact quoted-evidence and ID validation cannot prove semantic truth; paraphrase checks are inherently incomplete. Prompt wording, output schemas, and local inference do not eliminate instruction injection. Human approval remains mandatory.
