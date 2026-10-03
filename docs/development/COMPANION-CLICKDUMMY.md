# JSON to an offline clickdummy

The project compiler emits a browser composition alongside the normal plugin source. Both outputs use the same generated Vue pages, component definitions, source contracts, local effects and navigation store. The browser composition is not an iframe around the companion concept and is not a second hand-maintained mockup.

## Generate and build

From an inspected framework checkout with its qualified toolchain:

```sh
node bin/app new ../my-concept --from ./project.companion.json
# Review the input, file inventory, warnings and plan hash before applying.
node bin/app new ../my-concept --from ./project.companion.json --apply <reviewed-plan-hash>
cd ../my-concept
npm ci
npm run verify:project
npm run build:clickdummy
```

`npm run build:clickdummy` calls `node bin/app clickdummy build`. The fixed output is `clickdummy.html` in the generated project root. Open that file directly in a browser. Initial dependency installation needs the registry; the built HTML embeds its runtime, CSS, notices and complete project JSON and does not use runtime CDN imports.

```sh
node bin/app clickdummy build --dry-run --json
node bin/app clickdummy build --json
node bin/app clickdummy build --replace --json
```

Dry run launches no process and writes nothing. The real build runs trusted project code with the existing bounded process adapter. `--replace` explicitly permits replacing a previous clickdummy, but the shipped worker preserves last-good output until compilation and static offline validation succeed. No new CLI output path, arbitrary source entry, shell command or dependency version is accepted from project JSON.

The generated entry is `harness/prototype/clickdummy.ts`. Existing projects need reviewed regeneration from a kit containing this target before the command becomes available. This command does not import or apply new design JSON; use the established project import/generation plan first.

## What runs in the clickdummy

The preview can browse every declared non-modal surface, follow generated navigation and open browser-native dialogs. Closing a dialog preserves the underlying page. Each main/dialog frame owns its own Pinia instance and cleanup. A reset disposes those sessions and restores fresh fixture state.

The visible state picker exercises default, loading, empty, error and disabled rendering on authored visual definitions. It does not edit their saved definitions. Loading/disabled page content is inert; preview controls remain available. Project JSON export returns the complete embedded definition, not the current preview state.

Read operations use deterministic, schema-valid synthetic values. Unspecified business writes fail explicitly; there is no empty adapter that reports a successful save. The banner identifies fixture mode. A data-contract fixture is not realistic business data, application persistence or acceptance of a requirement.

Preview navigation uses surface-ID hashes (`#surface=...`) so a single file works without a server. Authored route records remain unchanged and are displayed separately. This is not a full dynamic-route matcher, authentication system, access-control enforcement or live source integration.

## Authored scenarios

The labelled **Authored scenario** selector exposes the current page's saved
`visualDesigns.pages[].scenarios`. It uses their exact sample values, bindings,
state and wide/narrow layout intent through the shared visual runtime. Pages
without scenarios show only Synthetic reads (no scenario), with the selector
disabled. A narrow scenario is not evidence of a supported device.

Switching scenarios resets local edits. Surface navigation and Reset preview clear
the selection; Project JSON still exports the unchanged canonical definition.
Preview state remains a separate rendered-state override. In scenario mode,
source actions and business hooks are refused, including in nested components
and dialogs; local effects and navigation remain available. Modal scenarios do
not yet have an independent selector. External adapters remain trusted consumer
implementation points, not a sandbox for arbitrary code.

See [scenario execution and limits](../testing/GENERATED-PREVIEW-SCENARIOS.md).

## Ownership and implementation

| Source | Responsibility |
| --- | --- |
| `bin/compiler/emitters/clickdummy-code.ts` | Generate the browser entry, thin preview component, context and synthetic source factory |
| `bin/compiler/emitters/clickdummy-scenarios-code.ts` | Emit surface-scoped scenario metadata without duplicating sample values |
| Existing page/component/compiler modules | Generate the shared runtime UI, bindings, effects and contracts |
| `scripts/framework/clickdummy.ts` | Validate generated-project context and invoke the fixed shipped build worker |
| `.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs` | Reuse the pinned Vue/Nuxt UI build, CSS ownership, license notices and single-file assembler |
| `scripts/companion/authoring-evidence.mjs` | Bind qualification to the exact modern companion HTML and full exported JSON |

Browser host CSS is the original shell harness simulation, not an extracted Obsidian stylesheet. It is imported only by the browser entry. Native styles retain the existing ownership pipeline. No font binaries, live vault adapter, Obsidian module or Node module may enter the browser bundle. The worker's existing CSP/static checks and browser suite verify the boundary separately.

Generated browser files follow existing ownership rules: preserve consumer edits, report conflicts and use a reviewed plan. Build output is a separate derived artifact; rebuilding does not modify the design or grant release authorization.

## Companion self-project qualification

The modern integrated authoring build is produced by:

```sh
node scripts/concepts/build-mvp.mjs
```

It writes `reports/companion-mvp/index.html`, the full v6 `companion-project.json` and a build hash receipt. The retained checked-in v5 concept remains a compatibility fixture during this transition; it is not silently relabelled as the new build.

With the qualified npm explicitly selected and browser tooling provisioned:

```sh
node scripts/companion/qualify-project.mjs --authoring-fixture
python -B tests/concepts/companion-mvp.browser.py --clickdummy
```

Qualification verifies the current HTML/JSON receipt before generation, writes into a separate temporary workspace, installs its exact lockfile, runs its own build/typecheck/tests, then builds and exercises its actual clickdummy. Evidence is retained under `reports/companion-mvp/generation` with the exact input, logs, generated JSON and output HTML. A hash-matching receipt is reproducibility evidence, not a trust or publication grant.

## Remaining MVP boundaries

The [current closure map](../testing/MVP-CLOSURE-STATUS.md) distinguishes implemented
foundations from remaining acceptance. Public v6 schema discovery, scoped
generation with dependency closure and reviewed extracted-kit setup/resume are
implemented on PR35; they are no longer merely proposed capabilities. The full
current-candidate onboarding, generated visual/interaction fidelity and manual
qualification exits remain open.

This target does not turn a generated adapter stub into a working native companion.
The complete native editor/persistence workflow, browser authoring, generated
preview and separately authorized release are different outcomes. Full native
companion acceptance remains required for the complete MVP.

## Historical integrated status — 2026-09-27

The [current review](../product/PR5-PRODUCT-REVIEW.md) and [evidence record](../testing/PR5-REVIEW-EVIDENCE.md) supersede earlier open/failed-status observations for their named artifacts. Current hosted evidence at `ec70e2c` verifies independent install, project verification, build and nine file-origin browser assertions for clickdummy SHA-256 `20d207f58c0ec902f3b2c5730445732af4eb2adbbfa564c0e2dea92cbe60b638`. This does not establish complete business or native companion acceptance.

Data-only [project/feature/improvement concept intake](CONCEPT-INTAKE.md) is now implemented. Selected-feature/page/component compiler output with dependency closure is a different capability and remains open, as do complete native editor capabilities, the full extracted-kit entry journey and release qualification. The current generated receipt retains 31 pending requirements. See the [prioritized follow-up plan](../product/PR5-IMPROVEMENT-PLAN.md).
