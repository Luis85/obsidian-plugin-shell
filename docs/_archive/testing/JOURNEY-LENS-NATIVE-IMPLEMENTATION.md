# Journey Lens native integration — implementation record

> Historical preparation record. The [resumed integration record](PR35-RESUMED-INTEGRATION.md)
> records recovery, current base integration and later publication/qualification.

## Candidate and publication state

This is a **local, unpublished implementation candidate** for PR35. It starts at
`2ea6c19ada7245aef22be5d9a3a29c8e3a1220df` (tree
`8c669532e5ecc741a966748907753b817f021a9d`) and reconciles PR5 through
`7c26f37f77438b53191ebd392a315aacaff1b3d6` (tree
`d015ccbf2083248c21aec2399db425f0f44140f4`). The live GitHub tools in this session
provided read operations only. No branch was pushed, PR merged or issue closed.
The delivered patch must retain both branch ancestries when committed.

PR5's source archive was retained by workflow `36417118554`, artifact
`10969511229`. Its checkout `4e2960d6bdf8d3d13e6c23f553c1b97e0b9c4f15` included
main-merge-only package changes. The exact PR5 package and unchanged original
lockfile were restored before integration; its source directory trees were checked
against the GitHub tree. This implementation changes neither dependency pins nor
the lockfile. PR5's optional Airship/manual work and PR35's setup/scoped-generation,
evidence, scenario and draft protections are retained together.

## Implemented gaps and limits

| Finding | Implemented correction | Remaining acceptance |
| --- | --- | --- |
| Generated sitemap was a static page, not Journey Lens | Closed built-in editor binding, copied maintained editor, shared Vue/Flow injection and generated native/browser composition | Locked TypeScript 6, generated SFC build and actual-host execution |
| No complete authoring write workflow | Full-project validated file store, explicit open/create/import, exact-byte revision checks and saved JSON export | Native persistence/reload workflow |
| Conflicting leaves and uncertain writes | Shared file queue, independent drafts, external-change observation, blocked uncertain saves and explicit recovery | Native multi-leaf and failing storage exercises |
| Incomplete route/action/journey maintenance | Action editing, guarded removal, unresolved-reference preservation, sibling ordering and existing journey draft controls | Expanded browser/native interaction matrix |
| Draft loss or stale recovery | Downloadable revision-bound recovery, dirty navigation guards, disabled pending forms, invalid restore preserves current draft | Manual keyboard, interrupted host and pop-out-window tasks |
| Static scenarios could impersonate editor data | No static page-scenario metadata/state override on bound surfaces; actual memory-backed editor state | Generated browser workflow |
| Quick Capture browser test timed out selecting its field | Locator matches the labelled design input itself or its wrapped descendant, with exact-one assertion | Rerun the original failing hosted case |
| PR5 Airship introduction broke integration fixtures/manual | Explicit wizard opt-out/opt-in tests, current help examples, full-schema optional tooling and regenerated command reference | Locked full integration and manual CI |

See the [native guide](../../development/JOURNEY-LENS-NATIVE.md) for behavior, ownership,
path constraints and exact user-facing operations. Unrelated page/component/source
engines and the complete native Companion remain outside this implementation.

## Executed local evidence

Environment: Node 22.16.0/npm 10.9.2. The repository-qualified Node 24.21.0/npm
11.19.1/TypeScript 6.0.3 toolchain could not be installed here. **No TypeScript 5
compiler was substituted.** Runtime adapters use Node type erasure and the retained
Vue 3.5.43/Pinia modules, with explicit persistence/rendering-port doubles. They do
not typecheck SFC templates or execute Nuxt UI in a browser.

The delivery's evidence folder retains original logs, failures and command adapters:

| Final check | Observed result | Evidence file |
| --- | --- | --- |
| Original compiler compatibility, bound-editor generation/import graph/regeneration, retained Flow/notices | 28 passed, no failures/skips/TODOs | `final-compatibility-flow.tap` (22) and `final-journey-only.tap` (6) |
| Full-project store/native-port doubles, maintenance, authoring contracts | 30 passed, no failures/skips/TODOs | `final-core.tap` |
| Actual retained Vue/Pinia editor store | 21 passed, no failures/skips/TODOs | `final-store.tap` |
| Workspace controller after final import guards | 8 passed, no failures/skips/TODOs | `workspace-final-recheck.tap` |
| Framework/setup/Airship integration after fixture corrections | 47 passed, no failures/skips/TODOs | `cli-integration-fixed.tap` |
| Documentation generator unit tests | 17 passed | `manual-tests.tap` |
| Independent JSON Schema corpus | 34 cases passed | `schema-final.log` |
| Source-derived manual check and read-only audit | 59 commands; no stale output; 80 framework and four memory examples audited | `manual-final.log`, `manual-audit.log` |
| Final CLI guidance suite | **Failed overall:** 11 passed, one strict empty-stderr assertion receives Node 22's experimental warning | `guidance-final.tap` |

These commands overlap earlier runs; counts must not be added into an inflated
total. Source limits (1,041 inputs), suite ownership (304 tests / 32 suites / 32 helpers),
whitespace and syntax-only Python/workflow checks passed and are retained separately
in the delivery. Added generated native tests were
parsed, not executed. The lockfile and original compiler aggregate goldens remain
unchanged; the new editor is opt-in and has separate generation tests.

Earlier failures remain visible: incomplete maintenance fixture shapes, a first
text-regex browser import check that misidentified generator strings, stale help
and wizard expectations after base integration, and missing Airship manual
examples. Corrections were followed by the named completed runs. Earlier timed-out
or interrupted store/schema attempts are not passes. A final grouped generator run
was interrupted at the tool deadline; the separate 22-case compatibility/runtime
and six-case generation commands subsequently completed successfully. The strict CLI stderr test
was not loosened; local missing TypeScript/Vue dependency failures are not converted
into successful qualification.

## Qualification still required

Install the exact locked dependencies and run the normal TypeScript 6, analyzer,
compiler, coverage and project gates. Then build the modern Companion and run both
the expanded file-origin browser suite and the new `journey-native` workflow job.
The latter independently generates/installs the actual consumer and invokes its
native create/edit/reload and two-leaf conflict assertions, retaining source and
host evidence. A passing real-host session is required before claiming native
closure. Manual assistive-technology, localization, narrow leaves, multiple windows,
crash recovery and agreed performance/scale budgets remain separate obligations.

The known Quick Capture locator correction has not been rerun in a real browser
here. The complete native page/component/source editors, 31 previously pending
Companion requirements and publication obligations are not blanket-promoted by
this work. No personal vault, live provider, plugin activation outside isolated
tests, release or tag was touched. Green historical workflows do not qualify this
unpublished source tree.
