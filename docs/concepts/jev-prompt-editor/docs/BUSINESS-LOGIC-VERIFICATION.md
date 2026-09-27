# Business-logic verification

## Scope

Extension of PR #32's retained Jev Studio prototype. Starting repository commit: `1c1ec7a62933b2a7eae4f5b957211a4f227582ea`. Verification is about the standalone concept, not production shell compatibility or native/provider acceptance.

The final artifact identity is recorded in `evidence/build.json`, each browser receipt and the repository `MANIFEST.json`. Generated screenshots are excluded from repository changes; `scripts/capture-logic.py` reproduces visual review views.

## Executed local checks

| Command | Result |
| --- | --- |
| `node scripts/build.cjs` | Strict TypeScript and precompiled Vue build passed; hash-only script CSP and no network access |
| `node --test tests/domain.test.cjs tests/logic.test.cjs` | **148 passed**: 64 retained domain tests + 84 new logic tests |
| `python tests/schema.test.py` | **20 passed**: schemas, v1/v2 examples and negative envelope checks |
| `python tests/browser.test.py` | **49 retained browser checks passed**, zero page errors/network requests |
| `python tests/logic.browser.py` | **100 new browser checks passed**, zero page errors/network requests |
| `python scripts/capture-logic.py` | Flow, rule, process, event, trace and narrow-screen captures; zero page errors |

Node 22.16.0, TypeScript 5.8.3 and bundled Vue 3.5.13 were used. Exact browser versions are recorded by the suites. Receipts are in `evidence/all-domain.tap`, `evidence/logic-domain.tap`, `evidence/schema.json`, `evidence/browser.json` and `evidence/logic-browser.json`.

New domain checks cover typed conditions, first-match/AND/OR behavior, missing-value errors, decision types, process target consistency, zero/exact/capped while loops, cycle bypass prevention, step/event/trace budgets, actual local transformations, external-action refusal, event phases/payloads/causality/collisions, v1/v2 reads, linked ID remapping including historical-only definitions, checkpoint restore and atomic persistence failures.

Browser checks use real UI actions for creation/edit/duplicate/archive/delete, condition validation, event publishing contracts, process fields/mappings, connection editing, pointer and keyboard movement, undo/redo, simulation/step/cancel, event-driven execution, checkpoint comparison/restore, actual JSON downloads and file imports, context-sensitive export consent, stale-trace protection and persistence failure. All six logic sections were checked for document overflow at 1600, 1280, 820 and 390 pixels; mobile creation and help were exercised.

## Browser evidence boundary

The managed browser environment does not permit direct file/localhost navigation. Both suites load the **exact generated HTML bytes** with Playwright `set_content` and use a clearly marked in-memory Storage test adapter. This verifies the shipped scripts, template behavior, layout, controls, CSP and actual download data. It does not establish real local-file persistence or bypass any managed policy.

No Safari/iOS native-host tests, screen-reader certification, real Jev inference, model-accuracy evaluation, real event transport or external process execution were performed. Pure local process mappings are actual computations; Jev answers are labeled synthetic fixtures. No live vault is written.

## Publication checks

The checksum-bound publication job must rebuild the same artifact, execute both domain suites and schema checks, verify the six existing root distribution-boundary tests, and refresh/verify the concept manifest before a guarded non-force push. The publication receipt records what actually ran on GitHub. Full root-template CI and native acceptance are separate; do not infer their outcome from these concept checks.

The previous `evidence/repository-import.json` and its initial-domain receipt describe the earlier import, not this extension. They remain historical evidence with their original artifact identity.
