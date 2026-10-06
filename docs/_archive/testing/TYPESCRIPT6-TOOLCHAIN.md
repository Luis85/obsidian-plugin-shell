# TypeScript 6 toolchain consistency — 2026-09-28

## Findings at PR #5 `65f98eb768e5111cf1f16dfcec3501a0f392a785`

The root manifest, root lockfile, dependency review policy and generated projects
already select TypeScript **6.0.3**. However, the isolated Jev concept invoked an
ambient `tsc` or arbitrary `TSC` override. Its retained build used 5.8.3, and some
previous local verification notes also recorded that environment. Root npm
no-emit commands could fall through to a global compiler when local tools were
absent. Neither is a supported new verification path.

## Changes

- All root no-emit scripts and emitted project/clickdummy scripts explicitly use
  workspace tool entrypoints. No global TypeScript or vue-tsc fallback.
- Jev requires exact agreement between the root TypeScript 6 pin, lockfile,
  reviewed dependency policy, installed package and loaded compiler API. Missing,
  older, newer, ranged and pre-release compiler selections fail before output.
- Jev has an explicit ordered tsconfig with strict checking, ESNext/Bundler,
  explicit browser types and no deprecated module-none/outFile settings. Its
  checked namespace outputs are assembled in memory in declaration order. ESM
  imports are refused; this is not a general-purpose bundler.
- Existing classified distribution tests execute the negative toolchain controls;
  generated-target tests verify compiler pins and workspace paths. A dedicated
  hosted Jev job rebuilds with real TypeScript 6, exercises wrong-type and module
  boundaries, tests the emitted domain code, and checks the rebuilt browser HTML.
- Agent guidance forbids substituting TypeScript 5 for new checks. Unavailable
  locked tools must be reported as not run rather than replaced with global 5.x.

## Evidence boundaries

Historical 5.8.3 reports retain their actual versions; they are not rewritten into
TypeScript 6 passes. The retained HTML and original build receipt are unchanged
until an actual TypeScript 6 rebuild is retrieved and reviewed. Hosted browser
checks use explicit test Storage and set_content; they do not establish native
Obsidian acceptance or real file-origin persistence.

The unchanged root lockfile additionally contains third-party-internal TypeScript
5.4.5 under eslint-plugin-obsidianmd and 7.0.2 under fallow-type-aware. Those are
upstream package dependencies, not the workspace application compiler. They were
not forcibly overridden to 6.0.3; doing so needs a separate compatibility review.
The shared dependency graph is therefore not claimed to contain only major 6.

Local compiler-selection and inventory tests use explicit SDK-shaped doubles;
real compilation requires the new hosted job. The local environment does not have
the locked TypeScript 6 installation and no TypeScript 5 compilation is used for
this change. Current hosted results are recorded separately after execution.

TypeScript's [6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
describe the changed defaults and deprecated legacy emit settings. Existing source
quality, coverage and dependency floors are unchanged; no new runtime packages,
release, tag, merge or personal-vault deployment are introduced.
