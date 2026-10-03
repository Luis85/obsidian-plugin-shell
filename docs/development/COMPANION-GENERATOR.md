# Companion project compiler

Related: issue #19, PR #5's full project JSON contract. This is shell tooling, not a completed native companion implementation.

## User journey

1. Download/extract the framework. Use its qualified Node/npm versions. `node bin/app setup` forwards to the existing guided setup; `node bin/app make` forwards to the existing maker. Both also retain their npm entrypoints.
2. Finish and save the design in the companion HTML prototype, then export **Project JSON**. The bundled `docs/concepts/companion/companion-project.json` is the companion's own design and is the qualification fixture.
3. **Recommended:** create the project in one reviewable command. It validates the export with the shared contract, keeps its identity unless `--id/--name/--author` override it, previews the plan and hash, and writes only with `--yes` or `--apply <planHash>` into an absent or empty folder outside the checkout:

```sh
node bin/app new ../my-plugin --from my-plugin.companion.json
node bin/app new ../my-plugin --from my-plugin.companion.json --yes
```

The companion's **Generate plugin shell** handoff copies exactly these commands, followed by `cd`, `npm ci`, `npm run check` and `npm run dev:obsidian`, plus a short coding-agent prompt. See [Companion handoff](COMPANION-HANDOFF.md) and [Framework CLI](FRAMEWORK-CLI.md#from-an-exported-companion-project). The lower-level form below remains for an explicit vault/target placement.

   Plan into a separate, empty project location. The vault must exist; the target directory may be absent. The framework checkout must not contain the target.

```sh
node bin/app generate \
  --input /path/to/project.companion.json \
  --vault /path/to/development-vault \
  --target projects/my-plugin
```

The default is read-only: stdout is a JSON file-change inventory with `planHash`, counts, warnings, conflicts, and before/after hashes. `npm run --silent companion:scaffold -- ...` is equivalent. No dependencies are needed to plan or apply. Node 22 uses an explicit native TypeScript-stripping launch; the compiler is also type-checked separately.

4. Review the paths, changes, source JSON and warnings. Apply by repeating the command with `--apply <planHash>`. The CLI reconstructs the plan; it never executes a serialized plan file. Changed input, template content, target bytes or ownership receipt invalidate the reviewed hash. A conflicting plan exits 2; invalid input/apply exits 1.
5. Open the generated project and follow its own `README.md`: `npm ci`, `npm run check` (typecheck, ESLint with zero warnings, product tests), `npm run dev:obsidian` (contained real-Obsidian sandbox with hot reload and logs; the first run needs `--allow-download`), `npm run test:watch`, and `npm run test:obsidian`. `npm run verify:project` is what the generated CI runs. Build/install/test/release remain distinct operations, never hidden generation side effects.

Starter shortcut: `node bin/app new ../my-plugin --starter quick-capture --author "Me" --yes` runs the same compiler on a reviewed starter ([Framework CLI](FRAMEWORK-CLI.md#start-a-new-plugin-from-a-starter)).

## What the generated project contains

Besides the framework copy and the generated product code, every project gets a developer and agent kit, rendered from `templates/companion/devkit/*.tmpl` by `bin/compiler/emitters/devkit-files.ts`:

| Path | Purpose |
| --- | --- |
| `README.md` | Product README: quick start, daily-loop and gate commands, code map, testing layers, logging and debugging |
| `AGENTS.md`, `CLAUDE.md` | Short agent instructions (definition of done = `npm run check`, architecture and safety rules, TDD against `design/traceability.json`); `CLAUDE.md` imports `AGENTS.md` |
| `.claude/settings.json` | Permission allowlist for safe commands, deny rules for publishing/force-push/release; a PostToolUse hook runs `vitest related` for each edited source or test file and a Stop hook runs `npm run check -- --fast` (`scripts/agent/*.mjs`) |
| `.claude/skills/*/SKILL.md` | `implement-requirement`, `debug-in-obsidian`, `add-feature`, `write-obsidian-test` |
| `.github/copilot-instructions.md`, `.cursor/rules/project.mdc` | One-line pointers to `AGENTS.md` |
| `.vscode/` | Recommended extensions, Vitest pointed at `configs/testing/vitest.project.config.mjs`, "Attach to Obsidian (dev:obsidian)" on port 9222, "Debug current Vitest file", tasks for `dev:obsidian`, `check`, `test:watch` |
| `.editorconfig` | Two-space, LF, UTF-8 |
| `.github/workflows/ci.yml`, `obsidian.yml` | Product CI: `check` + `verify:project` on every push/PR; real-Obsidian tests on `main` and on demand, with cached host download and uploaded evidence |
| `configs/testing/vitest.project.config.mjs` | Product tests with the shared build config, the `@test/obsidian` in-memory host and the throwing `obsidian` boundary; default reporters (agents get Vitest's `agent` reporter) |
| `configs/types/tsconfig.project.json`, `configs/bundling/vite.preview.config.mjs` | Project typecheck scope (`typecheck:project`) and the source preview (`dev:preview`); `configs/types/tsconfig.clickdummy.json` joins them for click-dummy output |
| `<tests>/project/plugin-host.test.ts` | Example kit test: loads `src/main.ts`, opens the workbench, toggles debug logging, unloads, and proves fixture notes are untouched |

Tool configuration lives under `configs/<concern>/`, like the framework's own. Only files a tool requires at the project root stay there: `package.json`, the lockfile, `manifest.json`, `versions.json`, a `tsconfig.json` stub for editors and `airship.config.json` (the upstream Airship CLI reads it from the project root). A project generated before this layout keeps its root copies of `vitest.project.config.mjs`, `tsconfig.project.json` and `vite.preview.config.mjs`: regeneration writes the new files but never removes a retired one, and the CLI, suite runner and agent hooks fall back to the root copy until the new one exists. Delete the root copies after regenerating.

The framework's own `README.md`, `AGENTS.md`, `TEMPLATE-GUIDE.md` and `SHELL-FIRST-OVERVIEW.md` move to `docs/framework/`, and its maintainer workflows to `docs/framework/workflows/` (inert reference; copied framework docs link to them). Every copied Markdown link to a moved file is rebased. The maintainer-only Windows runner script and the maintainer CI trigger test are not copied. All kit files are `extension` ownership: regeneration updates them while unedited, keeps your edits, and reports a conflict when both you and the template changed a file. `PROJECT-IMPLEMENTATION.md` stays `managed`.

Generated plugins also register the shell's `debug-toggle` and `debug-report` commands (the dev loop enables debug logging after each load), use `<id>-view-*` view types that the shell's view-header binding accepts, and name Vue component files with multiple words so `npm run check` is lint-clean for every starter.

The original `npm run companion:generate` and `scripts/companion-tools/generate.mjs` **remain byte-exact read-only JSON echo tools** for backward compatibility. The prototype's existing Prepare handoff is that v1 reader; use the new scaffold command above to generate implementation files.

## Generated implementation contracts

| Declared artifact | Generated implementation seam | Executable verification |
| --- | --- | --- |
| Project identity | Updated manifest, package and lock root identity; native entrypoint | Type-check and production bundle |
| Entity | TypeScript type, runtime guard, folder metadata and source schema | Valid fixture and invalid-value tests |
| DataSource operation | Application port, input/output guards, service and adapter extension | Real service/Pinia execution and failure tests |
| DataSource | One per-view Pinia store and bootstrap source registry | Pending/error, latest-read and disposal tests |
| Screen | Vue component, component composition imports and panel registry; authored detail layout when available | Mounted navigation and five-state detail tests |
| Navigation/interaction | Typed sitemap registry, store navigation, modal effect routing | Declared edge tests; non-navigational behavior stays TODO |
| Modal/settings/view | Native shell lifecycle wiring and isolated Vue/Pinia mount | Generated build; native acceptance remains separate |
| PRD requirement | Stable use-case module plus original requirement/acceptance text | Explicit `it.todo`, to replace with a failing behavioral test |
| Design system | Scoped Nuxt UI / shell CSS, token fragments and effective binding manifest | Shared browser/CLI compiler, generated build and real Nuxt UI harness |
| Test-data recipes | Standalone reviewed test-vault kit, deterministic fixtures, simulator ports | Native note reads and retained engine contract tests |
| Writable native relationships | Shared preflight service, graph/cardinality/target checks, restrict deletion | Real canonical repository mutation tests and constraint regressions |
| HTTPS JSON sources | Typed provider factory, approved origin, runtime credential injection, bounded requests | Generated factory/service execution and transport failure tests |
| Rich components without authored internals | Typed component specification and extension modules | Contract/traceability only, not a visual editor port |

Pinia holds per-view projections/drafts, not canonical persistence. Each source adapter receives the shell's services and must use the existing canonical data owner. Unspecified custom/provider adapters and use cases throw explicit `NotImplementedError` until implemented. Declared native note operations use the shell repository, not an empty implementation. A request is not reported successful because an adapter is empty. Unknown source shapes, unsupported schema keywords, dangling references, path/name collisions and incompatible flows fail generation rather than silently becoming `any`.

`codebaseFolder` selects `<folder>/generated`; `testsFolder` selects `<folder>/project`. The reusable framework remains under `src` and its original tests under `tests/runtime`. This increment relocates generated product code, not the foundation's internal modules. Paths are target-relative, validated and portable. Every generated project keeps its framework scripts, harness, docs, lockfile and release tooling; no repository, credentials or installed dependencies are copied.

## TDD and verification truth

`npm test` executes generated scaffold/interaction tests. `npm run test:tdd` selects PRD acceptance files in watch mode. Choose one requirement, replace its TODO with an observable failing assertion against the paired use case, then implement business behavior. Requirement IDs, linked nodes and components remain in `design/traceability.json`. TODOs never count as passing acceptance evidence; the traceability status is `scaffold-not-accepted`.

`npm run verify:project` builds, type-checks and runs the generated suite. It is not an alias for the unchanged full `npm run verify`. `npm run test:framework` retains the original shell suite; original entrypoint expectations must be adapted to the new product as development proceeds. Production maintainability, coverage, browser/native protocols and release evidence remain required independently. A green scaffold is not a green marketplace release.

The CI workflow generates from the actual bundled export, installs the generated project's own lockfile and runs its project verification, retaining source, plan, logs and explicit pending-acceptance status. Compiler safety tests exercise fresh generation, replay, stale inputs, consumer edits, missing/foreign files, custom roots, unsupported schemas and path attacks.

### Journey tests

Journeys authored in `design.sitemap.journeys` compile to Playwright specs, emitted by `scripts/companion/compiler/authored-journey-code.ts` (not to be confused with the Journey Lens editor tests in `journey-test-code.ts`). A project without journeys, and a journey without steps, emits nothing.

- Each journey with steps becomes `tests/e2e/journeys/<journeyId>.spec.ts` (an id that is not a plain `[A-Za-z0-9_-]` name is sanitized and suffixed with a hash of the id) plus one shared `tests/e2e/journeys/journey-support.ts`. Both are `managed` files regenerated from the design; edit the journey, not the spec.
- `test.describe('[<journeyId>] <name>')` runs in serial mode on one page, so a failed step skips the rest of the walk. Every step is its own test whose title starts with `[<journeyId>/<stepId>]`, which makes each step countable in the Playwright list/JSON reports.
- Steps the clickdummy preview can perform are real assertions: the first step opens its surface by preview address (`/#surface=<surfaceId>`, the same scheme the preview toolbar uses) and checks the surface heading; later steps click the incoming `navigate`/`open` control on the previous screen (by its exact label, by position when labels repeat) and assert the target heading and address, or the labelled dialog when the target is a modal.
- Steps that need business behavior are `test.fixme` entries with annotations `journey-step`, `reason` and, for a transition, `interaction=<design.links id>`: `conditional` transitions (a prose condition is not a predicate), unresolved planning references, steps without an incoming transition, action/group surfaces, dialogs reached by address and controls inside dialogs. They are skipped, never green. A step after one of them re-opens its source screen by address so the rest of the walk still runs.
- The specs run with the generated project's Playwright configuration (`testDir: tests/e2e`, `baseURL` of the source preview served at `/`) via `npm run test:e2e`; `npx playwright test tests/e2e/journeys` runs only journeys. Preview data is synthetic, so a passing journey proves navigation only, never business acceptance.

Compiler coverage: `tests/tooling/project-generator-journey-specs.checks.mjs` (generator suite).

### UI quality checks

Every generated project gets a managed Playwright setup that audits the generated preview, emitted by `scripts/companion/compiler/ui-quality-code.ts` (spec text in `ui-quality-spec.ts`). Nothing here is added to the plugin bundle.

- Files (all `managed`, regenerated from the design): `playwright.config.ts` (root; `testDir: tests/e2e`, reporters `list`, `json` to `reports/e2e/results.json` and `html` to `reports/e2e/html` with `open: 'never'`, `reducedMotion: 'reduce'`), `scripts/e2e/serve-clickdummy.mjs` and `tests/e2e/ui-quality.spec.ts`. The config only runs `ui-quality.spec.ts` and `journeys/**/*.spec.ts`; the framework's own harness specs under `tests/e2e/` keep `configs/testing/playwright.config.ts` and run with `npm run test:e2e:framework`.
- Target: the offline click-dummy. The Playwright `webServer` runs the serve script, which rebuilds the click-dummy with the project's own `node bin/app clickdummy build --replace` (so the local `clickdummy.html` is replaced) and serves it on `127.0.0.1:4181`. This is deterministic, needs no dev server and tests the same artifact `build:clickdummy` produces.
- `tests/e2e/ui-quality.spec.ts` is generated from the model's page surfaces (every screen that is not a dialog, action or group, in model order; `design/visual-traceability.json` describes the same definitions). For every surface it runs: axe-core WCAG 2.1 A/AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) with zero allowed violations in the light and in the dark theme (violations are printed readably and attached as JSON); a 360px reflow check (`document.scrollingElement.scrollWidth <= clientWidth`, listing the elements past the edge); and a keyboard check that every enabled button, link and form control of the workbench is reached with `Tab` and shows a visible focus indicator (outline or ring).
- Themes follow how the generated UI themes itself: Obsidian's `theme-dark` / `theme-light` body classes inside the `.obsidian-harness` token scope. The spec toggles the body class and fails if the page background did not actually change, so a theme that restyles nothing cannot pass silently.
- Run `npm ci`, provision Playwright's pinned Chromium (`npx playwright install chromium`, explicit and never automatic) or set `SHELL_CHROMIUM` to a Chromium executable, then `npm run test:ui-quality` (this spec only) or `npm run test:e2e` (this spec and the journeys). `@playwright/test` and `@axe-core/playwright` are the framework's exact pins and are already in the generated lockfile. Playwright specs are excluded from the generated Vitest run (`npm test`).
- Scope: results are evidence for the preview, not product acceptance, not a native Obsidian result and not proof of WCAG conformance (automated rules find only part of the issues). Dialogs and states other than `default` are not scanned. There are no screenshot baselines (`toHaveScreenshot` is not used); failure screenshots and traces go to `reports/e2e/artifacts` only.

Compiler coverage: `tests/tooling/project-generator-ui-quality.checks.mjs` (generator suite). The repository's own `tests/concepts/feature-showcase.browser.mjs` applies the same dark-theme, 360px and axe checks to a compiled showcase.

## Regeneration and safety

The generator uses `scripts/shared/file-plan.ts` (executing `scripts/shared/file-plan-runtime.ts`), the same lock, precondition checks and rollback engine as framework makers/setup. Explicit base64 entries support the existing compressed host CSS fixture without interpreting bytes as UTF-8; decoded bytes are hashed, validated and written by the same engine. Text behavior remains compatible.

`.companion/generation.json` records generated hashes and ownership. Unchanged output is a no-op. Unmodified generated files may update. Customized extension/framework files are preserved byte-for-byte (including a UTF-8 BOM) when their template is unchanged; a customized text file that is not valid UTF-8 is reported as a conflict rather than rewritten through lossy decoding. A new design/template that also needs to alter a customized file is a conflict. Customized managed registries, unowned destinations and removed owned files require reconciliation. No files are implicitly deleted. Retired ownership remains tracked. The receipt is local ownership metadata, not a signature or authority token.

Use the original framework checkout to regenerate the consumer project. Plans are bound to a snapshot of the template and the original JSON bytes. Cooperating commands share a vault-root lock; these are per-file guarded writes with rollback, not a filesystem-wide atomic transaction or protection against every noncooperating process race.

Imported JSON is data. It cannot provide code templates, commands, dependency versions, network credentials, expressions, SQL, file writer paths or execution approvals. Authored text is escaped when embedded in TypeScript/Vue files. Generation never reads/writes business data or activates a plugin. Source/network/database behavior starts only after a developer implements adapters and explicitly runs the product.

## Remaining native conversion work

The output is a development shell. Components without detail designs remain implementation placeholders. Authored details compile as described below; diagram coordinates do not imply pixel-perfect reproduction of the browser editor. Visual editors such as Vue Flow, domain-specific business rules, database drivers and translations still need product implementation and behavioral tests. Explicit restrict relationships, HTTPS JSON providers and seeded source recipes are generated; see [provider and relationship contracts](GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md). Native note operations, typed controls, slot-content assignments and explicit action mappings are generated under the contracts below. Preserve the delivery order: shell qualification, native companion implementation on the generated shell, native acceptance, publication last.

The output is a development shell. Components without detail designs remain implementation placeholders. Authored details compile as described below; diagram coordinates do not imply pixel-perfect reproduction of the browser editor. Rich editors such as Vue Flow, field editing, semantic relationship rules, real source persistence, payload mappings, translations and seeded source recipes still need implementation and behavioral tests. Preserve the delivery order: shell qualification, native companion implementation on the generated shell, native acceptance, publication last.

## Technical references

- Pinia testing: https://pinia.vuejs.org/cookbook/testing.html — generated tests instantiate actual Pinia rather than replacing actions with automatic mocks.
- Vitest test API: https://vitest.dev/api/test — TODOs identify unimplemented acceptance, not passing assertions.
- Node TypeScript execution: https://nodejs.org/api/typescript.html — type stripping executes erasable TypeScript; it does not replace the compiler type-check.

## Visual page and component generation (companion v5)

The compiler reads validated `design.visualDesigns`; v3/v4 inputs are migrated first (`migrateCompanionDocument`), so
the detail-schema sections below are historical. `bin/compiler/emitters/visual-*.ts` lower each page to
`presentation/components/details/<pageId>.vue` and each component to its library SFC with `defineProps`/`defineEmits`/
`defineSlots` from the typed contract. Elements become their tags, text becomes escaped interpolation or a typed
binding, slots become `<slot>`, project components are imported by export name and Nuxt UI entries become explicitly
imported `U*` components (catalog v1 ↔ `@nuxt/ui` 4.11.2, asserted). Interactions call only declared actions
(navigation port, source operation/mapping port, local runtime effects); an interaction without actions is an
`IMPLEMENTATION_REQUIRED` TODO. External-library nodes produce extension-owned `<adapter>.adapter.ts` stubs and merge
their exact package versions into `package.json` ([visual editors](../concepts/companion/VISUAL-EDITORS.md#component-library-dependencies-and-external-adapters-spec-13)).
Generated tests cover interaction transitions from the IR (`ui-effects/<id>.checks.mjs`), contracts, scenario
rendering and the adapter lifecycle; `design/visual-traceability.json` links definitions, surfaces (with their optional
[UX acceptance](COMPANION-PROJECT-SCHEMA.md#surface-ux-acceptance-optional)), files, interactions, covering test ids,
evidence placeholders and adapters. Qualification: `qualify-project` on the self-project and fixtures, `qualify-starter` for all nine starters
and `qualify-styles` ([verification](../concepts/companion/VISUAL-EDITORS-VERIFICATION.md)).

## Executable detailed-design generation (schema 1; schema 2 extensions below) — historical

Saved v3 page/component designs now compile to editable Vue SFCs. Page details replace the
placeholder page composition; component details implement the matching reusable library SFC.
Each document also has managed data specifications, traceability and generated verification.

- Regions compile as stack, wrapping row or responsive grid containers, in semantic array/parent order.
  Canvas coordinates and editing-frame sizes are deliberately not CSS layout instructions.
- Text is escaped data, inputs are labelled text controls, buttons use native button behavior,
  and declared named slots expose their fallback text. The export does not encode file/number
  input subtypes, slot-content assignments, event-to-business-output mappings or conditions.
- Reusable instances import one definition, receive typed primitive props and merge reviewed
  variant defaults with local overrides. False, zero and empty text remain valid overrides.
  Stale versions, missing variants, unknown props and wrong types stop generation.
- `designState` controls default/loading/empty/error/disabled; hidden ancestors suppress children.
  Without an explicit state, referenced source projections and local interaction status drive
  loading/error/empty. Disabled/loading controls cannot dispatch a business interaction.
- Source bindings traverse declared own-property paths such as `0.title`, never expressions.
  They expose the actual per-view Pinia projection. Typing changes a local draft only.
  Only separately declared on-open read flows start automatically. Payload and write mapping
  stays in the typed application hooks; no implicit save follows an input change.
- A declared navigation target routes through the navigation store or native modal callback.
  Other interactions dispatch stable-ID requests to `application/interactions/<edge-id>.ts`.
  Those hooks fail explicitly until implemented. Pending duplicates are ignored, errors retain
  drafts, and disposed views do not accept late completion updates.

`domain/components/contracts` contains typed prop/event/slot contracts. Member declarations
use `name:string`, `name:number`, `name:boolean`, or event-only `name:void`. Unsupported
syntax is rejected rather than copied as code or widened to `any`. Component custom-event
payloads remain implementation contracts; prose such as “emit select” is not a machine mapping.

`design/detail-traceability.json` links documents, Vue files, interaction hooks and acceptance
tests. Generated tests exercise five-state rendering, real event dispatch, declared navigation,
source/service/Pinia projections and runtime failure/disposal behavior. PRD and interaction
acceptance prose remains explicit TODOs. UI wiring passing is not acceptance of that prose.

Use the existing reviewed plan/apply workflow for regeneration. Expanded component trees are
bounded; unresolved references, ambiguous event branching and projects larger than the
ownership inventory fail before writes. Consumer-edit conflict protection remains unchanged.

Technical basis: [Vue props](https://vuejs.org/guide/components/props.html),
[Vue events](https://vuejs.org/guide/components/events.html),
[Pinia testing](https://pinia.vuejs.org/cookbook/testing.html) and
[Vitest test semantics](https://vitest.dev/api/test). Dependency pins are unchanged.
## Design-system styles

The JSON compiler now applies saved design tokens through its normal stylesheet import path. See [Design system → Nuxt UI styles](DESIGN-SYSTEM-STYLES.md) for the frontend contract, host/declared policy, safe regeneration and customization. This does not implement arbitrary component layout or turn usage prose into executable CSS.

## Declarative action and persistence increment — 2026-09-25

Detail schema 2 adds typed controls, reusable-instance slot assignments and source/emit actions with explicit data mappings. Schema 1 remains supported without interpreting prose as behavior. The prototype exposes these declarations in Page/Component forms and an advanced native-operation field in the source editor. The full project envelope remains version 3; only the detail subsystem upgrades when its new semantics are saved.

See [declarative action and native note contracts](GENERATOR-DECLARATIVE-ACTIONS.md). These contracts supersede the text-only/payload/slot limitations of the earlier increment above. The generated JSON and Markdown editors are accessible plain-text controls, not Monaco, a visual Markdown renderer, or a port of the Vue Flow workbench.

Both the actual companion export and an explicitly synthetic boundary project are independently generated, installed, built and tested by the qualification workflow. The second fixture declares all new control types, a slot assignment, a typed payload action and a native note CRUD source; it is not substituted for the companion design or counted as its completed PRD behavior. Native repository tests exercise the actual NoteRepository and Markdown codec against an in-memory storage port, not the Obsidian desktop host.

## Provider, relationship and recipe implementation

The generator now emits executable recipe tooling, typed HTTPS JSON providers, a complete-source override registry with lifecycle cleanup, and native relationship preflight. See [the integration guide](GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md). These additions do not convert requirement prose into passing acceptance evidence or replace native Obsidian qualification.

## Executable detailed-design generation

Saved v3 page/component designs now compile to editable Vue SFCs. Page details replace the
placeholder page composition; component details implement the matching reusable library SFC.
Each document also has managed data specifications, traceability and generated verification.

- Regions compile as stack, wrapping row or responsive grid containers, in semantic array/parent order.
  Canvas coordinates and editing-frame sizes are deliberately not CSS layout instructions.
- Text is escaped data. Typed inputs, selectors, tabs, lists, tables and buttons use their
  declared semantics. Named slots carry caller-owned content or fallback content; immutable
  revision dependencies have separate generated identities. Declarative local UI effects
  execute; arbitrary conditions and business-output mappings are never inferred.
- Reusable instances import one definition, receive typed primitive props and merge reviewed
  variant defaults with local overrides. False, zero and empty text remain valid overrides.
  Stale versions, missing variants, unknown props and wrong types stop generation.
- `designState` controls default/loading/empty/error/disabled; hidden ancestors suppress children.
  Without an explicit state, referenced source projections and local interaction status drive
  loading/error/empty. Disabled/loading controls cannot dispatch a business interaction.
- Source bindings traverse declared own-property paths such as `0.title`, never expressions.
  They expose the actual per-view Pinia projection. Typing changes a local draft only.
  Only separately declared on-open read flows start automatically. Payload and write mapping
  stays in the typed application hooks; no implicit save follows an input change.
- A declared navigation target routes through the navigation store or native modal callback.
  Other interactions dispatch stable-ID requests to `application/interactions/<edge-id>.ts`.
  For interactions without a declared UI effect, those hooks fail explicitly until implemented. Pending duplicates are ignored, errors retain
  drafts, and disposed views do not accept late completion updates.

`domain/components/contracts` contains typed prop/event/slot contracts. Member declarations
use `name:string`, `name:number`, `name:boolean`, or event-only `name:void`. Unsupported
syntax is rejected rather than copied as code or widened to `any`. Component custom-event
payloads remain implementation contracts; prose such as “emit select” is not a machine mapping.

`design/detail-traceability.json` links documents, Vue files, interaction hooks and acceptance
tests. Generated tests exercise five-state rendering, real event dispatch, declared navigation,
source/service/Pinia projections and runtime failure/disposal behavior. PRD and interaction
acceptance prose remains explicit TODOs. UI wiring passing is not acceptance of that prose.

Run `node bin/app ui status` for a read-only per-surface and per-interaction view of which stubs and
acceptance tests are still pending ([UI status](UI-STATUS.md)).

Use the existing reviewed plan/apply workflow for regeneration. Expanded component trees are
bounded; unresolved references, ambiguous event branching and projects larger than the
ownership inventory fail before writes. Consumer-edit conflict protection remains unchanged.

Technical basis: [Vue props](https://vuejs.org/guide/components/props.html),
[Vue events](https://vuejs.org/guide/components/events.html),
[Pinia testing](https://pinia.vuejs.org/cookbook/testing.html) and
[Vitest test semantics](https://vitest.dev/api/test). Dependency pins are unchanged.

## Complete v4 composition — historical

Superseded by the visual designs above; see [visual editors](../concepts/companion/VISUAL-EDITORS.md). The historical
[composition guide](../concepts/companion/COMPOSITION.md) described responsive layout, token references,
instance slots, revision snapshots, fixtures and supported effects. The current self-project
contains 80 working and 54 captured documents; code generation includes both. Live and captured
local font references use safe declared family names or native font variables; no fonts are downloaded.
The Nuxt UI stylesheet path and customization ownership introduced by the Design System increment
remain active alongside detailed component styles.

## Local-review reconciliation

The previously unpushed fixture/relationship patch is integrated with the current providers and composition code. See [the reconciliation and fixture workflow](GENERATOR-FIXTURES-AND-RELATIONSHIPS.md). The existing `testdata:*` commands and strict whole-graph relationship policy remain canonical.
