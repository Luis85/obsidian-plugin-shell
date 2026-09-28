# Optional Storybook — implementation and verification

Starting PR5 reference: `f140c7e89570329fc7ed40ee2d4cb885f4524fc2`, tree `300a7c038da47c8d8e7cb4dfc476ffef9d73490f`. Implementation is separate from PR35. The local source was obtained from PR5's `project-generator-evidence` workflow artifact; archive exclusions mean its full local tree is not advertised as the repository tree. Only explicitly changed paths are published.

## Implemented contract

Independent, default-off `tooling.storybook.enabled` and `tooling.storybook.generateStories`; strict project validation/migration; copied CLI/API overrides; current companion transfer preservation; pure CSF/workspace emitters using actual Vue outputs; synthetic per-story contexts; isolated optional package manifest; explicit guarded install/check/dev/build/status commands; exact active story and typecheck inventories; normal root dependency manifests unchanged; existing reviewed ownership rules and no implicit file deletion.

## Completed local evidence

Local Node 22.16.0 / npm 10.9.2 are **supplementary**, not the repository's qualified toolchain. No global TypeScript 5 was used or linked. Node's built-in type stripping was used only for module execution and generated-source syntax/metadata checks; it is not TypeScript semantic validation.

- Emission and interface suite: 7 tests passed, no skips/TODOs. Covers all four switches across both plugin/clickdummy targets; old/current migration; malformed inputs; real generated import paths; false/zero/empty defaults; synthetic required values; event/slot metadata; stable variant/scenario names; custom roots; placeholders; no root dependency changes; optional config/host source contracts; CLI discovery.
- Lifecycle suite: 6 tests passed, no skips/TODOs. Covers disabled refusal, no implicit/global discovery, consent/dry-run behavior, explicit first-install vs ci arguments, local tools/cwd/telemetry, missing/mismatched dependencies, failed executor/cancellation, linked workspace refusal, and actual reviewed file generation/regeneration with modified-file conflicts and retained custom files. Install/build process-boundary assertions use explicitly named controlled doubles; they are **not evidence that npm or Storybook ran**.
- Final combined Storybook replay: the same 13 tests passed, exit 0; these are not 13 additional unique tests.
- Compiler core/CLI/compatibility plus framework guidance regression completed 45 tests: 44 passed and one guidance assertion failed solely because local Node 22 wrote its experimental type-stripping warning to stderr. A separate full guidance replay with `NODE_OPTIONS=--disable-warning=ExperimentalWarning` passed all 12 tests, exit 0, without a source/test change. The first 33 compiler tests passed in the completed original regression. A broader rerun was interrupted after 35 passed tests; it is not recorded as a complete pass.
- Suite inventory passed: 287 test files, 30 suites, 31 helpers at that local checkpoint. Later suite changes must be rechecked.

An initial emission test run had two fixture/assertion errors (a newly required prop was not supplied at existing component usage sites, and a non-string CLI value has its own validation message). Those tests were corrected and the full emission suite passed. A combined regression attempt was interrupted by the runner after partial completed tests; that attempt is not an overall passed run, and repeated results are not added into inflated totals.

## Added qualification, not yet promoted to a pass

The actual compiled/extracted-kit journey now toggles both options, regenerates without overrides, checks root-lock preservation, refuses a retained disabled launcher and reimports after the override. The actual current companion composition test exercises all four configurations through import/export. These require the repository-local TypeScript 6 toolchain and are not claimed as locally executed.

The separate optional workflow uses the qualified Node/npm and existing exact root lock, then independently installs the generated optional workspace, replays npm ci, runs a static Storybook build and Vue/TypeScript checking, and validates real generated component/page indexing, mounting, empty state, authored narrow scenario and dark theme in Chromium with external requests blocked. Evidence is retained on failures. A workflow definition is not evidence of a completed workflow; inspect the exact candidate's run before accepting compatibility.

Package-registry DNS was unavailable locally. Actual Storybook dependency installation, semantic TypeScript 6 checks, full analyzer/coverage runs, static build and browser rendering therefore remain pending hosted verification at this checkpoint. The new tooling validator is classified in the existing companion-authoring contract zone; its data shape does not import compiler or host code. No boundary permission or threshold was relaxed. No default dependency lock, native vault, release authority or publication permission was changed. No merge, tag or release is performed by this work.
