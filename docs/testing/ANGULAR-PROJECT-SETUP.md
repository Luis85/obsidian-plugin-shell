# Angular project setup — implementation and verification

Recorded: 2026-09-29. This is implementation evidence, not release authorization.

## Candidate and provenance

The extension is stacked on PR #5 (`docs/companion-plugin-prd`) at commit
`15f74eaec78b5555bed94e4310472db841e371f7` (tree
`522854faa35c9b5af2d58cd82c137ae7f61132f1`). Runtime implementation commit:
`1e6f551d9961fa8ba931d6832e2bc2b8616e7820`, tree
`a5653a3766b8b4c34502f8d98178235a7da9c117`.

Source was recovered from that candidate's Framework CLI workflow artifact and
edited locally. Only intended changed files were uploaded on top of the original
Git tree; the consumer template was not substituted for the whole repository.
The uploaded complete runtime `bin` tree matched the locally tested tree
`dbfba06dfa0d8b9370f6bad71445a8b45f85ce6a`. The launcher blob matched
`520a2ce74b96c0ab4988d77b0756d915308a608c`. Compiler adapter blobs were also compared:

| File under `scripts/compiler/adapters/project/` | Git blob |
| --- | --- |
| `configuration.ts` | `f4eefbcf03eb423f482f3713d8226f5fb8827778` |
| `emitter.ts` | `6315848ba55174357ef82d4578f6b793b8cfae1e` |
| `serve-source.ts` | `b414b959c7e2ed47b9ce7f5af44e4ecd158fe317` |

The follow-up commit adds the three setup test files, the existing-test catalog
expectation updates, compiled-distribution discovery cases, user guide and tested
request examples. The three modified existing test files' original blob hashes
were verified against the PR #5 baseline before replacement.

## Implemented scope

`project-setup` composes existing safe plans, the prototype guide, canonical
Companion v6 operations and the Angular project generator. It checks an existing
Git-root/vault, configures paths/preferences, ingests typed Markdown with source
hashes, records project/product context, optionally prepares a prototype and
application bricks, and optionally emits an Angular Hello world starter. Human
and JSON commands use the same operations and reviewed file-write protocol.

Settings are persisted in `configs/user-settings.json` after approval. The new
settings command and subsequent sketch/studio/prototype commands share saved
paths. Data-source entries are specifications, not network connections. The shared
generator now supplies an explicit build-then-local-preview `npm start` script for
browser targets. Setup does not run that script or install dependencies.

See [the user and agent guide](../../bin/PROJECT-SETUP.md) for exact commands,
limits and recovery behavior, and [the request example](../../bin/examples/angular-setup.json).

## Executed checks

The local environment was Linux, **Node 22.16.0 / npm 10.9.2**, not the repository's
qualified Node 24.21.0 / npm 11.19.1 environment. Type stripping executes source;
it is not a TypeScript type check. No global compiler was substituted.

| Check | Result | Scope |
| --- | --- | --- |
| New setup tests | 26 passed; 0 failed; 0 skipped | Domain, real storage/plans, human/agent flows |
| Available maker regression set | 132 passed; 0 failed; 0 skipped | 20 test files; includes the same 26 new tests |
| Generated scaffold tests | Passed within both Angular optional-prototype tests | Built-in Node tests against emitted core source |
| Emitted preview server syntax | Passed within those tests | `node --check`; not a running Vite server |
| Source policy check | Passed | 1,120 inputs; code-line limits and 202-key locale parity |
| Suite manifest check | Passed | 294 test files in 35 suites, 32 helpers |
| Patch whitespace check | Passed | `git diff --check` |

Commands used for the successful local runs:

```sh
NODE_OPTIONS=--experimental-strip-types node --test --test-concurrency=1 \
  tests/tooling/interactive-maker-setup-*.checks.mjs

NODE_OPTIONS=--experimental-strip-types node --test --test-concurrency=1 \
  $(find tests/tooling -maxdepth 1 -name 'interactive-maker-*.checks.mjs' \
    ! -name 'interactive-maker-project-runtime.checks.mjs' \
    ! -name 'interactive-maker-tui-distribution.checks.mjs' | sort)

node scripts/quality/check-source.mjs
node scripts/testing/suites.mjs --check
git diff --check
```

The available regression command explicitly omits two dependency-blocked files;
this is not a replacement for `npm run test:maker` and does not change CI selection.
Existing suite globs include the new files automatically. The compiled-distribution
test retains its mandatory repository TypeScript 6.0.3 check in CI.

The 26 added tests exercise settings defaults/partial updates/false values,
unsafe paths and overlaps, corrupt/future settings, exact Markdown preservation,
recursive and explicit PRD intake, invalid/duplicate/missing records, symlink
rejection on Linux, prerequisite failures, preview/approval/cancel/stale sources,
unchanged setup replay, all new brick categories, canonical validation, optional
prototype and boilerplate branches, one-document agent output, human/agent replay
parity, separate continuation output paths and preserved Angular selection.

The human tests invoke real wizard/services with deterministic prompt drivers;
they are not evidence of a new native Obsidian session or manual terminal usability
acceptance. Existing available TUI checks are included in the 132-test set.

## Log fingerprints

These raw logs are retained in the accompanying patch/evidence handoff archive.
Counts refer to completed runs, not estimates. SHA-256:

| Log | SHA-256 |
| --- | --- |
| `maker-final-tests.log` | `12eaaaf8364c626bfcb2f37ccbe61a318eead6972b257dd63246a75241ab9b67` |
| `setup-tests.log` | `e07054ed805c5f39fac59ef1ae2ff34494db1a0369df64ff5c3707a12f2cb052` |
| `setup-source-check.log` | `bffde9c9496dd523c9ba8968187d976c213a3a56fb7adda9be28bfa7425b6a22` |
| `setup-suite-check.log` | `7c341a2da6aed9a0d3689b7f31680deef22202593a2c8bcc18850417149e82a4` |
| `setup-architecture-check.log` (blocked) | `892424fc9deca4f8b86fc00a03778e643d1be598b7d69e54684a4ccd2372bb70` |

Earlier exploratory runs exposed an old command-catalog expectation and a test
assertion against the wrong flattened plan shape; those were corrected before the
132-test run. Missing-dependency failures were not relabeled as passing tests.

## Blocked or not executed

The environment could not provision the qualified dependencies. The full maker
runtime file requires absent `happy-dom`; the compiled-kit file requires absent
repository TypeScript 6.0.3. `check:compiler-architecture` stopped at missing
`typescript` before evaluating its gate. None is reported as passing.

Not executed: qualified `npm ci`, maker TypeScript checking, complete lint/analyzer/
maintainability/coverage/verify gates, compiled-kit qualification, generated Angular
installation/AOT typecheck/build, running preview server and browser Hello world
acceptance, Windows/macOS qualification, or native Obsidian acceptance. The existing
Angular exact pins and root-only generated lock were not changed or falsely marked
resolved. Baseline hosted workflow success is not evidence for this new commit.

Before promotion, use the exact repository toolchain and lock, run all normal gates,
then build a fresh kit and exercise the actual download/extract/setup/edit/generate/
install/start journey in a disposable Git/Obsidian project. Inspect Hello world in a
browser, verify navigation and shutdown, and retain candidate-specific evidence.

## Remaining product boundaries

This is a source implementation pending qualified integration acceptance. It does
not finish the whole Companion MVP or establish release readiness. In particular:

- The default Angular starter projects a page list, not complete visual layouts,
  Angular URL routing, entity CRUD, live sources or application business behavior.
  PRDs remain verbatim, provenance-linked and explicitly unmapped.
- PRD intake remains bounded by the canonical 12-PRD limit and identity-only scalar
  frontmatter grammar. The new brick menu is not full CRUD of every model field.
- Configured path migration after setup and cross-session partial wizard resume
  are not implemented. Later authoring uses saved project state; edited generated
  source is never blindly overwritten.
- Settings centralize the paths/preferences of this workflow, not secrets, host
  `data.json`, all legacy CLI options, transient UI state or project target metadata.
  Generated `npm start` rebuilds then previews; it does not provide hot reload.

No merge, release, tag, listing, plugin activation, permissions change or personal
vault operation was performed or authorized. Keep the PR in draft until the
relevant qualification and remaining scope are reviewed.
