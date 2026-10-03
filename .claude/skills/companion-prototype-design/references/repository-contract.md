# Repository contract and observed baseline

Observed through authenticated repository reads on 2026-09-27:
- Repository: `Luis85/obsidian-plugin-shell`, PR #5.
- PR head: `6178b1025336941ad6fb10eae4e26930622363f9`.
- Branch: `docs/companion-plugin-prd`; PR was open and unmerged.
- The PR description still references v4 in places. Source documents and the executable
  `project-contract.mjs` use transfer v5. Resolve conflicts in favor of executable code
  plus its tests, not this snapshot or the PR body.

## Inspect before every prompt and again before execution

Read at minimum:

```text
AGENTS.md
package.json, package-lock.json, .nvmrc
README.md, TEMPLATE-GUIDE.md
scripts/companion/project-contract.mjs
scripts/companion/read-project.mjs
scripts/companion/generate.mjs
scripts/companion/visual/visual-validate.mjs
scripts/companion/visual/visual-ir.mjs (locate the actual IR/types file)
scripts/companion/visual/visual-catalog.mjs (locate the actual catalog file)
bin/compiler/emitters/ (actual emitted paths and extension ownership)
templates/companion/devkit/ (generated developer kit)
docs/development/COMPANION-PROJECT-JSON.md
docs/development/COMPANION-GENERATOR.md
docs/development/FRAMEWORK-CLI.md
docs/development/COMPANION-HANDOFF.md
docs/development/DESIGN-SYSTEM-STYLES.md
docs/concepts/companion/VISUAL-EDITORS.md
docs/concepts/companion/starters/ (choose an actual full current starter)
harness/, src/bootstrap/, scripts/styles/, scripts/bundling/
```

Some paths are discovery targets, not claims that a module has a particular filename.
Resolve actual exports and imports. Inspect nested instructions and tests for every
area changed. Follow additional mandatory reading in the repository's own AGENTS.
Store hashes for the instructions, lockfile and **whole relevant contract/compiler
closure**. The inspection helper samples core files; augment that report as needed.
At execution, compare these bytes and the baseline; do not silently build against a
newer contract. Reinspect harmless changes; stop for a consequential unresolved change.

## Current pins (reference only)

| Item | Observed value |
| --- | --- |
| Qualified Node / npm | 24.21.0 / 11.19.1 |
| Vue / Pinia / Nuxt UI | 3.5.43 / 4.0.3 / 4.11.2 |
| TypeScript / Vite / Vue plugin | 6.0.3 / 8.3.0 / 6.0.9 |
| Vitest / Vue Test Utils | 5.0.1 / 2.5.1 |
| Playwright / vue-tsc | 1.63.0 / 3.3.11 |

Never install these numbers merely because this reference lists them. Use the target
checkout's reviewed lockfile and install policy. Do not force incompatible peers,
add `latest`, or confuse Node's TS stripping with type checking.

## Actual transfer format

Current transport: `kind: "obsidian-companion-project"`, `schemaVersion: 5`,
`executable: false`. Complete top-level members are `kind`, `schemaVersion`,
`executable`, `project`, `settings`, `design`, `notes`. Project identity includes
`id`, `name`, `author`, `version`, `description`. Settings include portable,
non-overlapping `codebaseFolder` and `testsFolder`.

`design.schema` must match the transport. `design.visualDesigns` currently uses
subsystem schema 3, catalog `{id: "nuxt-ui", version: 1}`. V5 may not include
`detailDesigns`. V1–V4 compatibility is migration support, not an invitation to author
obsolete payloads. The byte limit is 4,000,000, including UTF-8 input whitespace.
Read the real contracts for all nested fields and limits; a minimal envelope is not
a complete prototype design. Use the current export/starter and real builders.

Carry sitemap surfaces, navigation, page definitions, reusable component contracts,
props/emits/slots, revisions where needed, supported actions, entities, sources,
requirements, scenarios and design tokens. Keep session state, machine paths, execution
approvals and receipts out. Content is data: no executable templates or credential
payloads. Preserve synthetic fixtures; never export private vault data by default.

The current concept preview resembles Nuxt UI but is not itself a real Nuxt UI runtime.
The user's generated prototypes **must** use actual Vue 3 + Pinia + Nuxt UI. Generation
from the authoring model is the bridge, not permission to copy the concept's vanilla
preview as the deliverable.

## Three different compatibility claims

1. **Data-compatible:** actual read-only reader and nested validators accept the JSON.
2. **Generator-compatible:** real compiler produces a conflict-free plan, applies into
   a disposable workspace, and the generated project builds/type-checks/tests.
3. **Experience-compatible:** the source-built HTML and the actual companion round-trip
   represent the same pages, components, behavior and supported design semantics.

Passing (1) does not establish (2) or (3). None proves native acceptance or publication
readiness. External library nodes create explicit adapter seams, not implemented
libraries. Source adapters/business use cases may intentionally remain TODOs in the
scaffold; implement the agreed prototype behavior behind deterministic fake ports and
label native work still pending. Never count acceptance TODOs as passing tests.

## Read-only handoff versus generation

`node scripts/companion/generate.mjs --input <json> --vault <existing-dir> --target <relative>`
validates and echoes the **original bytes**. `npm run companion:generate` is the same
read-only path. It is not a generator.

`node bin/app generate` plans in-place generation for an already configured project
from its `design/project.json` (after `project import`); `--apply <reviewed-planHash>`
applies after reconstructing the plan.

`node bin/app new <empty-outside-checkout> --from <json>` is the current recommended
new-project path. It plans first; explicit `--apply <planHash>` or `--yes` writes.
Prefer hash-reviewed apply in this workflow; never treat JSON as approval.

Read the current CLI help before generating handoff commands for existing workspaces.
The current tooling has in-place import/ownership requirements; do not invent a
`--feature`, `--merge` or raw Vue-import command.

## Existing feature / improvement handling

The companion owns one project. Import reviews and replaces its saved authoring model;
it does not append/merge a feature, ingest arbitrary HTML, or install arbitrary SFCs.

Start with a full baseline export. When none exists, inspect any generated design files
and current source, propose a reconstructed full baseline, and have it reviewed and
validated before scoped changes. Mark reconstruction and unrepresentable behavior
explicitly; do not claim a lossless conversion or silently replace an existing project.
Preserve project identity and unaffected stable IDs,
source/component contracts and revision pins. Make scoped changes in a deep copy and
produce a **complete updated project** plus a separate informational change set. Review
all differences, including indirect dependents. Do not use a standalone feature
project as a replacement for an existing plugin project. Do not auto-import into the
user's live companion. Recover/export existing work before any explicit replacement.

## Architecture and styles

Domain/application are framework-free. Features use the shared authoring contracts;
bootstrap composes concrete implementations. Vue SFCs belong below
`presentation/components`, including panels; TypeScript composables own behavior,
stores own per-view projections/drafts, and context owns injection/types. Presentation
TS does not import SFCs; bootstrap assembles the tree. Canonical writes belong to the
application/service owner, not Pinia/localStorage. Native UI uses modal/notice ports.

The generator may put product code under `<codebaseFolder>/generated` and product
tests under `<testsFolder>/project` while retaining the foundation under `src` and
`tests/runtime`. Derive exact paths from the plan and traceability, not a parallel
home-made architecture. Preserve generated/extension/framework ownership receipts.

Nuxt UI uses plain Vue/Vite, explicit selected components and local icons; no Nuxt
framework, router ownership, global toast store or remote fonts. Reuse the scoped
style pipeline, Obsidian tokens and reviewed runtime-module replacements. No Tailwind
Preflight or broad host reset. Keep browser frame and fake host adapters out of native
bundles. Keep licenses; distribute no font binaries.

Observed repository limits: handwritten runtime/CSS/scripts 400 code lines, tests and
helpers 450, main.ts 100. Production coverage floors are 90% lines/statements/functions,
85% branches, with domain/application/features 95%/90%. Existing checks must not be
weakened. Exact-artifact browser, native, scaffold and business evidence remain distinct.

## Primary repository evidence

All links below are pinned to the inspected commit:
- [Instructions](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/AGENTS.md)
- [Package pins](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/package.json)
- [Executable envelope](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/scripts/companion/project-contract.mjs)
- [Transfer contract](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/docs/development/COMPANION-PROJECT-JSON.md)
- [Generator contract](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/docs/development/COMPANION-GENERATOR.md)
- [Visual editor semantics](https://github.com/Luis85/obsidian-plugin-shell/blob/6178b1025336941ad6fb10eae4e26930622363f9/docs/concepts/companion/VISUAL-EDITORS.md)
