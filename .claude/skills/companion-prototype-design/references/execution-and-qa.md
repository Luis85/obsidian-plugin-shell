# Execution and quality gates

Apply `vue-typescript-quality.md` alongside the target repository instructions.

## Build order

1. Re-resolve the repository, approved brief and baseline. Check drift before work.
   Read local instructions and build policies; use the pinned toolchain.
2. Write acceptance/fixture tests first. Create the complete current-format project JSON
   using the actual model/seed. Model every supported page and component; avoid hollow
   envelopes that validate but cannot recreate the agreed experience.
3. Use the real reader and generator to validate/plan. Apply the freshly reviewed hash
   only into an authorized disposable workspace outside the framework checkout. Do not
   call `--yes` as a shortcut around a known conflict. Never alter a live user vault.
4. Build on the generated foundation; keep generated files reproducible from JSON and
   bespoke logic in actual extension-owned seams. Add an isolated browser harness using
   deterministic in-memory adapters. Keep the harness entry/adapters in TypeScript;
   UI SFCs remain under the real presentation/components root, not a parallel UI tree.
   Pure domain/application code remains host-free.
5. Reuse the project's selected Nuxt UI components, local icons, scoped styles and guard
   patches. Add a reviewed Vite browser configuration with one IIFE output, inlined
   dynamic imports/assets, no splitting, no external runtime modules and no sourcemap
   dependency. Include the whole pipeline under source, not absolute paths to the shell.
   Inspect the installed Vite version's API; do not blindly paste a legacy Rollup config.
6. Use the single-file assembler if it fits; its JS/CSS inputs are the actual compiled
   output. It fails on ESM syntax and obvious off-file resources. Copy the helper's
   imports into the package. Keep build output reproducible with explicit replace only.
7. Run all applicable checks below. Fix issues and rebuild; invalidate earlier HTML/hash
   evidence whenever a source/config/model change can affect behavior.
8. Package or persist only as authorized. Link the artifacts immediately at delivery.

## Required gates and evidence

| Gate | What must be demonstrated |
| --- | --- |
| Install | Clean extraction installs using its lockfile and declared toolchain; no hidden local dependencies |
| Types and lint | Vue/TS checks, no warnings/unsafe casts as escape hatches; preserve target checks |
| Domain/application | Real deterministic behavior, rules, failures, no partial success on failed writes |
| Pinia/composables | Real actions; draft/canonical separation; pending/error/late-result handling; disposal |
| Components | Actual props/events/slots, accessible labels/focus, real Nuxt UI rendering, state variants |
| HTML provenance | Built from supplied sources, matching source/model/HTML hashes, no independently hand-coded demo |
| Offline | Open file:// with network disabled and request logging; no secondary files; blocked storage fallback |
| Journeys | All agreed primary/negative/regression scenarios on the exact HTML, not dev-server source |
| Visual | Wide/narrow, light/dark, dialogs/menus, keyboard, scrolling, meaningful focus; compare approved direction |
| JSON reader | Actual repository reader accepts and byte-echoes the file; nested validation passes |
| Companion | Import into disposable companion state, inspect surfaces/components, export, compare canonical semantics |
| Generator | Real plan/apply into fresh scratch, build/typecheck/test emitted project; reconcile extension source |
| Baseline | Identity/stable IDs/unaffected definitions preserved; reviewed diff; no implicit feature import/merge |
| Safety | No production writes, credentials, font files, unrelated data, fake approvals or hidden host dependencies |

Use the actual generated project's `npm run check` and `npm run verify:project` when
available. Preserve framework checks appropriate to changed areas and the repository's
coverage/maintainability floors. A focused prototype test suite does not replace them.
Do not weaken checks to get green. Explicit TODOs are unimplemented acceptance, not
passing cases. Run behavior assertions through services/stores rather than stubs that
always succeed. `createTestingPinia` stubs actions by default; use real Pinia or
`stubActions: false` where behavior is under test.

The generic browser helper needs installed `@playwright/test` and its browser; it never
downloads them. It checks four width/theme combinations, offline requests, console
errors and storage-denial fallback. It loads `tests/prototype.journeys.mjs`, whose
`runJourneys({page, expect})` must return **names of actually executed assertions**.
Author a comprehensive test module; returning names without assertions is not evidence.
Additional standalone Playwright/component/unit tests remain necessary.

The helper does not import the actual companion UI, compare screenshots, inspect native
Obsidian, or prove whole-product accessibility. Implement those relevant checks separately.
A browser unavailable in the environment is `blocked`, never “passed by static inspection.”
No honest native evidence means the native boundary remains explicitly unqualified.

## Reproducibility and reporting

Record exact command, portable working directory, tool versions, stdout/stderr or log
path, exit status, test counts (with skipped/TODO separated), revision and input/HTML
hashes. Preserve failing evidence as well as fixes. Include a second clean build or a
semantic/hash reproducibility check as appropriate; explain nondeterminism rather than
claiming byte equality without testing it.

Any unavailable required gate makes the package `incomplete`. Deliver useful source and
artifacts with the limitation, but do not call it verified/import-ready/native-ready.
A later executor should know exactly which command and dependency is missing.

## Primary testing and format references (consulted 2026-09-27)

- Vue testing: https://vuejs.org/guide/scaling-up/testing.html
- Pinia real-action testing: https://pinia.vuejs.org/cookbook/testing.html
- Agent Skills format: https://agentskills.io/specification
- Nuxt UI integration is constrained by the repository's pinned runtime and style
  guards; generic website installation snippets do not supersede them.
