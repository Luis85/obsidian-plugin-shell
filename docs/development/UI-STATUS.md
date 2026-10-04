# UI implementation status

> Type: reference · Part of the [docs index](../README.md)

`node bin/app ui status [--json] [--root <project>]` is the single read-only place that shows how
far the generated UI has been implemented. It ships in generated projects because their `bin/` is
the same CLI. It never writes, runs a test, starts a browser or reads outside the project.

## What it reads

| Input | Used for |
| --- | --- |
| `design/visual-traceability.json` | Surfaces (page and component definitions) and interactions with their linked stub and acceptance-test paths. |
| `design/project.json` | Surface labels and `design.sitemap.journeys[].steps`. |
| Linked `src/generated/application/interactions/<id>.ts` and `tests/**/acceptance/<id>.test.ts` | Static implementation state (below). |
| `tests/e2e/**/*.spec.*` | Which specs mention a surface or interaction id, and which journey steps have a spec titled `[journeyId/stepId]`. |
| `reports/e2e/results.json` (Playwright JSON reporter) | Passed/failed/skipped specs, project names, themes and widths observed in labels, and ids found in passing titles. |
| `reports/ui-gallery/index.json` | Capture count, surfaces, themes and widths, and surfaces with no capture. |

A folder with neither `design/visual-traceability.json` nor `design/project.json` is not a UI
project: the command fails with `UI_PROJECT_NOT_FOUND` (exit 1). Any other outcome exits 0; it is a
report. An unreadable or missing single file is a warning diagnostic and its facts are ignored.

## States

Per interaction, derived only from source text:

- `generated`: the compiler emitted an executable UI effect and no business hook or acceptance test
  (nothing is left to implement).
- `todo`: any of `stub-throws-not-implemented`, `stub-missing`, `test-has-todo`, `test-has-skipped`,
  `test-missing`, `test-has-no-active-case`, or `hook-not-linked` (a business hook with no linked files).
- `implemented`: every linked file exists, the stub no longer contains `throw new NotImplementedError`
  (comments are ignored), and the acceptance test has no `it.todo`/skip and at least one runnable case.

A surface is `todo` while any interaction is, `implemented` once at least one is and none are pending,
otherwise `generated`. `implemented` is static evidence only: the report states
`proof: "static-source-analysis; no test was executed"` and always `behaviorAcceptance: "not-run"`.
Run the tests for proof.

Linked paths from the traceability file must be project-relative; absolute, parent-relative,
backslash and NUL paths are treated as missing. Symlinks are never followed. Files are size-bounded.

## Optional fields

Fields the traceability writer may add are read when present and ignored when absent: per-interaction
`testIds: string[]` and `evidence: object[]` (surfaced as `declared`), and a per-definition
`acceptance` object (surfaced as `declaredAcceptance`). They are passed through, not interpreted.

## JSON result

Standard envelope (`protocolVersion: 1`, `command: "ui status"`) with `data.schemaVersion: 1`:
`sources`, `totals` (surfaces, interactions, journeys, specFiles), `surfaces[]`, `interactions[]`
(state, reasons, stub and test facts, matching specs), `journeys[]` (steps, `stepsWithSpec`,
`coverage: none | partial | complete`) and `evidence` (`e2e`, `gallery`, `surfacesWithoutGalleryEntry`).
Journey titles must be literal; interpolated template titles cannot be matched statically.

## Code layout

- `bin/domain/ui-status*.ts`: pure computation, source scanners, input readers and evidence summaries.
- `bin/application/ui-status.ts`: the read port and use case.
- `bin/adapters/framework/ui-status.ts`: bounded file-system port and the operation.
- `bin/adapters/framework/ui-operation.ts`: the `ui` group dispatch. Add a subcommand with one handler entry here and one catalog row.
- `bin/presentation/terminal/ui-status-view.ts`: the human table.
- Tests: `tests/tooling/interactive-maker-ui-status-domain.checks.mjs` and `...-adapter.checks.mjs` (maker suite, so they count toward the CLI coverage gate).

No generator output changed, so generated-project snapshots and the kit inventory only change through
the new files under `bin/`.
