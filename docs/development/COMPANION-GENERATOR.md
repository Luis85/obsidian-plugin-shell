# Companion project compiler

Related: issue #19, [SH-035](../tasks/shell/SH-035.md) (the compiler task originally also named SH-023 in PR #20), and PR #5's full project JSON contract. This is shell tooling, not a completed native companion implementation.

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
| Screen | Vue component, component composition imports and panel registry | Mounted navigation smoke test |
| Navigation/interaction | Typed sitemap registry, store navigation, modal effect routing | Declared edge tests; non-navigational behavior stays TODO |
| Modal/settings/view | Native shell lifecycle wiring and isolated Vue/Pinia mount | Generated build; native acceptance remains separate |
| PRD requirement | Stable use-case module plus original requirement/acceptance text | Explicit `it.todo`, to replace with a failing behavioral test |
| Design system, source recipes and rich component contracts | Portable design files, source metadata and component specification modules | Preservation/traceability, not visual or business acceptance |

Pinia holds per-view projections/drafts, not canonical persistence. Each source adapter receives the shell's services and must use the existing canonical data owner. Adapters and use cases throw explicit `NotImplementedError` until implemented. A request is not reported successful because an adapter is empty. Unknown source shapes, unsupported schema keywords, dangling references, path/name collisions and incompatible flows fail generation rather than silently becoming `any`.

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

The output is a development shell. Component files are implementation placeholders, not a faithful conversion of the browser prototype's rendered layouts or free-form props/events. Rich editors such as Vue Flow, field editing, semantic relationship rules, real source persistence, payload mappings, translations, design-token application and seeded source recipes still need implementation and behavioral tests. Preserve the reconciled delivery order: framework qualification (SH-022), separately authorized shipment of shell + CLI + generator (SH-034), native companion implementation after CX-007, native acceptance, then companion publication. See the [delivery strategy](../product/DELIVERY-STRATEGY.md). This implemented generator is the baseline to extend, not evidence that the full release-archive workflow is complete.

## Technical references

- Pinia testing: https://pinia.vuejs.org/cookbook/testing.html — generated tests instantiate actual Pinia rather than replacing actions with automatic mocks.
- Vitest test API: https://vitest.dev/api/test — TODOs identify unimplemented acceptance, not passing assertions.
- Node TypeScript execution: https://nodejs.org/api/typescript.html — type stripping executes erasable TypeScript; it does not replace the compiler type-check.
