# Companion project compiler

Related: issue #19, PR #5's full project JSON contract. This is shell tooling, not a completed native companion implementation.

## User journey

1. Download/extract the framework. Use its qualified Node/npm versions. `node shell.mjs setup` forwards to the existing guided setup; `node shell.mjs make` forwards to the existing maker. Both also retain their npm entrypoints.
2. Finish and save the design in the companion HTML prototype, then export **Project JSON**. The bundled `docs/concepts/companion/companion-project.json` is the companion's own design and is the qualification fixture.
3. Plan into a separate, empty project location. The vault must exist; the target directory may be absent. The framework checkout must not contain the target.

```sh
node shell.mjs generate \
  --input /path/to/project.companion.json \
  --vault /path/to/development-vault \
  --target projects/my-plugin
```

The default is read-only: stdout is a JSON file-change inventory with `planHash`, counts, warnings, conflicts, and before/after hashes. `npm run --silent companion:scaffold -- ...` is equivalent. No dependencies are needed to plan or apply. Node 22 uses an explicit native TypeScript-stripping launch; the compiler is also type-checked separately.

4. Review the paths, changes, source JSON and warnings. Apply by repeating the command with `--apply <planHash>`. The CLI reconstructs the plan; it never executes a serialized plan file. Changed input, template content, target bytes or ownership receipt invalidate the reviewed hash. A conflicting plan exits 2; invalid input/apply exits 1.
5. Open the generated project. Run `npm ci` explicitly, then `npm run verify:project`. Build/install/test/release remain distinct operations, never hidden generation side effects. Use the shell's existing isolated local-vault setup before `npm run build:local`.

The original `npm run companion:generate` and `scripts/companion/generate.mjs` **remain byte-exact read-only JSON echo tools** for backward compatibility. The prototype's existing Prepare handoff is that v1 reader; use the new scaffold command above to generate implementation files.

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

## Regeneration and safety

The generator uses `scripts/shared/file-plan.mjs`, the same lock, precondition checks and rollback engine as framework makers/setup. Explicit base64 entries support the existing compressed host CSS fixture without interpreting bytes as UTF-8; decoded bytes are hashed, validated and written by the same engine. Text behavior remains compatible.

`.companion/generation.json` records generated hashes and ownership. Unchanged output is a no-op. Unmodified generated files may update. Customized extension/framework files are preserved when their template is unchanged; a new design/template that also needs to alter a customized file is a conflict. Customized managed registries, unowned destinations and removed owned files require reconciliation. No files are implicitly deleted. Retired ownership remains tracked. The receipt is local ownership metadata, not a signature or authority token.

Use the original framework checkout to regenerate the consumer project. Plans are bound to a snapshot of the template and the original JSON bytes. Cooperating commands share a vault-root lock; these are per-file guarded writes with rollback, not a filesystem-wide atomic transaction or protection against every noncooperating process race.

Imported JSON is data. It cannot provide code templates, commands, dependency versions, network credentials, expressions, SQL, file writer paths or execution approvals. Authored text is escaped when embedded in TypeScript/Vue files. Generation never reads/writes business data or activates a plugin. Source/network/database behavior starts only after a developer implements adapters and explicitly runs the product.

## Remaining native conversion work

The output is a development shell. Components without detail designs remain implementation placeholders. Authored details compile as described below; diagram coordinates do not imply pixel-perfect reproduction of the browser editor. Visual editors such as Vue Flow, domain-specific business rules, database drivers and translations still need product implementation and behavioral tests. Explicit restrict relationships, HTTPS JSON providers and seeded source recipes are generated; see [provider and relationship contracts](GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md). Native note operations, typed controls, slot-content assignments and explicit action mappings are generated under the contracts below. Preserve the delivery order: shell qualification, native companion implementation on the generated shell, native acceptance, publication last.

## Technical references

- Pinia testing: https://pinia.vuejs.org/cookbook/testing.html — generated tests instantiate actual Pinia rather than replacing actions with automatic mocks.
- Vitest test API: https://vitest.dev/api/test — TODOs identify unimplemented acceptance, not passing assertions.
- Node TypeScript execution: https://nodejs.org/api/typescript.html — type stripping executes erasable TypeScript; it does not replace the compiler type-check.

## Executable detailed-design generation (schema 1; schema 2 extensions below)

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
