# Compiler architecture

## Dependency direction

The inward-only core lives in `bin/compiler/`. `bin/compiler/domain/` defines source locations, diagnostics, artifacts, project-starter data, scoped-generation closure and independent semantic checks. `bin/compiler/application/` orchestrates the parse/migrate/validate/resolve/lower/emit pipeline using explicit ports. These layers import only inward (application → application/domain, domain → domain) and never access filesystem, network, processes, clocks, random IDs, Vue or Obsidian. The Fallow zones `compiler-domain` and `compiler-application` enforce the same direction, ESLint forbids `node:*`/host imports there, and the maker core coverage floors (95/95/95/90) apply to both folders through `tests/tooling/interactive-maker-compiler-core.checks.mjs`. The former `scripts/compiler/{domain,application}` paths were removed rather than shimmed.

The host adapters are moving beside the core. `bin/compiler/adapters/` holds the Companion frontend, target lowering, dependency readiness, artifact origins, template loading, the click-dummy and fixture emitters, reporting and the `compiler` shell command (`cli.ts`); the Fallow zone `compiler-host` covers them, and `tests/tooling/interactive-maker-compiler-cli.checks.mjs` brings the command adapter, reporting, dependency readiness and template loading under the maker coverage floors. `scripts/compiler/adapters/` still contains the plugin emitter, workspace planning, generation selection and `project/`; `scripts/compiler/index.ts` is the Node composition root. Project planning, the generator CLI, legacy project-file rendering and the fixture entry are owned by the adapters (`project-plan.ts`, `generator-cli.ts`, `project-files.ts`, `bin/compiler/adapters/fixture-code.ts`). The former `scripts/companion/compiler/{plan,cli,project-files,fixture-code}.ts` facades and the moved `scripts/compiler/adapters/*` paths were removed rather than shimmed; `tests/tooling/compiler-dependency-direction.checks.mjs` keeps companion code from depending on executable compiler modules and keeps every source off the removed paths.

The normalized model still uses the existing validated Companion model and visual IR. Some legacy fields remain bounded generic rows; this extraction does not introduce a second project schema or claim that every legacy helper has been rewritten.

## Four operations, four effect boundaries

| Operation | Inputs | Output | Effects |
| --- | --- | --- | --- |
| Load snapshot | Trusted template root | Frozen file/text inventory and fingerprint | Bounded regular-file reads; links/fonts refused |
| Compile | JSON text, optional snapshot, injected ports | Diagnostics, model, artifact data, fingerprint | No I/O |
| Plan | Artifacts, workspace snapshot/receipt | Hash-bound changes, preserves and conflicts | Target inspection only |
| Apply | Reviewed freshly checked plan | Write/rollback report | Existing guarded writer only |

The plugin emitter was extracted rather than reimplemented. Pure emitters consume `TemplateSnapshot.text()` and return data; they do not reopen templates. Artifact collection distinguishes framework replacement and visual replacement of UI placeholders from accidental duplicate writes. Final validation rejects unsafe paths, case aliases and file/descendant collisions.

The browser output shares generated Vue components, navigation, contracts, scoped styles and the visual runtime. Its separate composition root injects deterministic read fixtures. Writes and missing business handlers fail explicitly, and external-library adapters remain implementation points. No compiler claim substitutes for native or business acceptance.

## Enforced rules

`npm run check:compiler-architecture` resolves syntax-tree imports across `bin/compiler`, `scripts/compiler`, `scripts/companion`, `scripts/contracts` and the companion test kit, and checks inward core dependencies plus the transitive pure-emitter graph. Every listed pure entrypoint must exist in that inventory; a missing one fails the check instead of being skipped. `npm run check:architecture` runs this **in addition to** the existing Fallow gate. Generated source inside string literals is not treated as a compiler import. Negative tests cover forbidden imports, dynamic imports, direct effects and transitive filesystem access.

Two inherited runtime modules expose validators alongside deferred timer-driven operations: `runtime/json-http.ts` and the fixture adapter. Their function-local timers are narrowly documented in the checker; module-level timers remain forbidden. Rendering tests additionally replace runtime fetch/timers with throwing functions to prove compilation does not execute providers. Date construction with explicit input is deterministic parsing, not clock access; zero-argument Date and Date.now remain forbidden.

## Lifecycle and failure semantics

The core validates bounded input before emission, aggregates independent safe reference diagnostics and suppresses dependent cascades. Artifacts are not returned when compilation fails or is cancelled. Cancellation is cooperative at phase boundaries and template-read checkpoints, not preemption of synchronous JavaScript. Apply retains the existing writer's transaction/recovery behavior; no cancellation shortcut abandons half a write.

Events and optional debug causes are caller-provided observation channels. Regular results never serialize exception stacks or the complete input. Schema failures, unsupported output kinds, template defects, conflicts and toolchain failures are distinct from successful generation. The supported limit remains 4 MB input, 5,000 artifacts and 120 MB template bytes.
