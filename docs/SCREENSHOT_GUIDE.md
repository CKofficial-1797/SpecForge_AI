# Screenshot capture guide

## Capture status

No screenshots were saved during this Phase 9 work. The available computer-use surface could not attach to the Chrome app tab; its state capture resolved to the Codex desktop instead of SpecForge. The application was not represented with mockups, and no placeholder image files were created.

Capture screenshots manually from the actual running app after starting the documented Docker stack. Keep them outside version control unless the team later chooses to add approved assets. Use the same desktop viewport and avoid personal information, credentials, browser developer tools, and transient errors.

## Manual steps

1. Start Docker Desktop and run `docker compose up -d`; verify `http://localhost:3000/api/health/ready` and `http://localhost:8080`.
2. Confirm `GET /api/ai/health` reports the expected local model before capturing AI screens. Do not expose `.env` or Ollama credentials.
3. In Chrome or Edge, open `http://localhost:8080`, maximize the window, and set a consistent desktop zoom (100% recommended).
4. Capture only screens that render real saved records. Use the Windows Snipping Tool or the browser's built-in screenshot command, and save PNG files in a team-selected submission directory.
5. After each capture, inspect it at full size for readable text, loaded state, correct source version, and absence of secrets or unrelated personal information.
6. Do not edit screenshots to hide broken functionality or fabricate counts. If the capture contains an error, either document it as a limitation or retake after the underlying issue is corrected.

## Suggested capture list

| Filename                          | Screen                                   | Current availability                                                                                         |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `01-projects.png`                 | Projects list                            | Capture if the local demo project is visible.                                                                |
| `02-requirement-list.png`         | Project requirements                     | Capture the real `ACC-001` row.                                                                              |
| `03-requirement-detail-v1.png`    | Original requirement and version history | Available in the app.                                                                                        |
| `04-validation-report.png`        | Deterministic validation                 | Saved report exists for version 1; label its version.                                                        |
| `05-ai-analysis-v1.png`           | Saved AI analysis                        | Real local output exists for version 1.                                                                      |
| `06-clarifications.png`           | Question and answer revisions            | A genuine question and answer history exist.                                                                 |
| `07-refinement-review.png`        | Refinement draft review/history          | Approved version 2 and rejected earlier drafts exist. Show status labels accurately.                         |
| `08-acceptance-limitation.png`    | Acceptance criteria state                | Optional. Capture only if the interface shows the genuine failure state clearly; no criteria were persisted. |
| `09-traceability-empty-state.png` | Traceability / coverage                  | Capture only the actual empty or not-applicable state; do not imply positive coverage.                       |

The app has no authentication screen. Test-case generation and approval screens cannot be represented as successful because the demo has no approved criterion or generated case. Do not create corresponding “success” screenshots.
