# Source-driven Shell CLI documentation: research and decision

Research date: 2026-09-28. Repository baseline: `Luis85/obsidian-plugin-shell` PR #5, commit `f140c7e89570329fc7ed40ee2d4cb885f4524fc2`.

## Decision

Use **TypeDoc's native HTML output**, **ordinary Markdown for the user handbook**, and a **small deterministic adapter over the existing CLI catalog/help metadata** for command reference. Keep the renderer an isolated development tool. Do not migrate the CLI to a new execution framework merely to generate documentation.

This is a repository-specific engineering judgment, not a claim that TypeDoc has the best visual theme or that competing tools cannot produce excellent manuals. The deciding requirement is minimal ongoing synchronization work. Most of the maintenance saving comes from sharing command facts with runtime help, not from the choice of website generator.

## What the repository already provides

The inspected project uses TypeScript 6.0.3, Vue 3 and Vite, with explicit Node/npm qualification and exact root dependency pins. The shared framework catalog already contains command IDs, option kinds, positional bounds and operation effects. `help-text.ts` adds descriptions, examples, usage, grouping and profile defaults. Terminal help and capabilities consume those structures. Recreating the same information in frontmatter, a documentation database or annotated wrapper classes would introduce a second source of truth.

The current source also has important boundaries that a superficial help scraper would miss: shared-parser flags are not all effective on every command; saving a plan or requesting diagnostics can intentionally write output during an otherwise inspect/preview workflow; fixtures and releases have specialized approval rules; and memory is dispatched separately from the shared catalog. Legacy generation preserves a distinct transport. Documentation must preserve those differences rather than flattening everything into a generic “dry run is always read-only” statement.

Repository evidence: `scripts/framework/catalog.ts`, `help-text.ts`, `operations.ts`, `cli.ts`, `contracts.ts`; `shell.mjs`; `scripts/hindsight/cli.ts`; `scripts/framework/kit.ts`, `distribution.ts` and `kit-integrity.ts`. These were inspected directly at the baseline, not inferred from a README alone.

## User needs and evaluation criteria

New plugin authors need a safe first successful workflow: choose the correct distribution, create/configure a project, import/generate, install deliberately, and verify the result. Returning developers need concise task guides and accurate options. Automation authors need schemas, effect boundaries, exit semantics and machine-readable data. Maintainers need source-local authoring and failure signals when documentation coverage drifts.

Accordingly, the comparison prioritizes: native TypeScript understanding; plain Markdown support; a small dependency/toolchain footprint; no CLI migration; reusable generated outputs; useful navigation/search; deterministic builds; validation of links and metadata; readable offline/checked-out content; and a clear distinction between API reference and a genuine user manual. Runtime compatibility must be proven by a build, not guessed because two tools both mention Vite or TypeScript.

## Candidate comparison

| Candidate | Relevant capability | Fit and trade-off for this repository |
| --- | --- | --- |
| TypeDoc native HTML + catalog adapter | TypeScript symbols/docblocks and external Markdown in one output | Selected: one renderer, no extra site framework, shared runtime metadata remains authoritative |
| VitePress + TypeDoc Markdown + catalog adapter | Vue/Vite documentation UI, Markdown/Vue pages, local search, generated API integration | Strong alternative when branded UX or interactive Vue examples justify another renderer/theme compatibility layer |
| Astro Starlight + TypeDoc integration | Documentation-oriented Astro site with Markdown/MDX | Capable, but introduces another site ecosystem without eliminating the custom catalog adapter |
| Docusaurus + TypeDoc integration | Documentation site with explicit multi-version content support | Appropriate for a larger multi-version portal; additional site/content lifecycle is not needed to solve today's drift problem |
| JSDoc plus tutorials | API comments with authored Markdown/HTML tutorials | Useful for JavaScript-first projects; TypeDoc is the more direct choice for this TypeScript contract surface |
| oclif command metadata and documentation conventions | Descriptions, usages, examples and flags belong to command classes | Good design principle, but replacing the existing parser/execution model would be a disproportionate migration for documentation alone |
| Catalog-to-Markdown only | Very small custom generator and readable checked-out files | Used as the portable base layer; by itself it lacks TypeScript comment processing and a complete navigable website |

Sources for tool capabilities: [TypeDoc external documents](https://typedoc.org/documents/External_Documents.html), [VitePress introduction](https://vitepress.dev/guide/what-is-vitepress), [VitePress local search](https://vitepress.dev/reference/default-theme-search), [TypeDoc VitePress integration](https://typedoc-plugin-markdown.org/plugins/vitepress), [Starlight getting started](https://starlight.astro.build/getting-started/), [Docusaurus versioning](https://docusaurus.io/docs/versioning), [JSDoc tutorials](https://jsdoc.app/about-tutorials), and [oclif commands](https://oclif.io/docs/commands/).

## Why TypeDoc is sufficient now

TypeDoc accepts exported TypeScript entry points and supported documentation comments. Its external-document support accepts standalone Markdown, either at the project level through `projectDocuments` or underneath a symbol through `@document`. Relative document links are resolved into the output. We therefore do not need another plugin merely to mix an authored handbook with source reference. Standard comments and Markdown remain understandable without the renderer.

The upstream changelog lists TypeDoc 0.28.20, dated 2026-07-05, and records TypeScript 6 support starting with 0.28.18 on 2026-03-23. The implementation pins 0.28.20 with the repository's TypeScript 6.0.3 for qualification. This avoids relying on older TypeDoc releases whose advertised compiler support predates TypeScript 6. It does not certify every transitive dependency or replace actual build evidence.

Sources: [TypeDoc input configuration](https://typedoc.org/documents/Options.Input.html) and [TypeDoc changelog](https://typedoc.org/documents/Changelog.html).

An important limitation remains: TypeDoc cannot derive the user's command workflow simply from a `Command` interface. Nor can it determine whether a broad parser flag is meaningful for a particular handler. Our adapter supplies the runtime catalog as structured input; authored text explains intent, safe ordering, side effects and recovery. Calling an API dump a comprehensive user manual would miss that distinction.

## Why not choose VitePress immediately?

VitePress is the closest stack match for a future polished portal. Its Vue/Vite architecture and local in-browser search are attractive, and `typedoc-vitepress-theme` explicitly handles API-document sidebar data and compatible anchors. That makes it a credible upgrade path, not an incompatible alternative.

However, the researched VitePress site identifies a 2.0 alpha documentation track and links the 1.6.4 track. The application already uses a newer Vite toolchain. Sharing a brand name does not prove that their dependency graphs can be combined without qualification. An isolated VitePress toolchain is possible, but adds another renderer and integration package to upgrade. For a manual whose initial needs are mostly prose and command tables, that cost is not yet justified.

The selected generated Markdown/JSON can feed VitePress later. The migration would concern presentation and navigation rather than rewriting command documentation or changing CLI handlers. Reconsider it when there is a concrete need for interactive Vue examples, branded information architecture or a broader documentation portal, and then benchmark build size/performance rather than inventing comparative numbers.

Sources: [VitePress introduction/version selector](https://vitepress.dev/guide/what-is-vitepress), [local search](https://vitepress.dev/reference/default-theme-search), [TypeDoc integration](https://typedoc-plugin-markdown.org/plugins/vitepress).

## Content architecture and ownership

Use tutorial/how-to/reference/explanation as distinct jobs for documentation, following the [Diataxis model](https://diataxis.fr/). The first-run guide teaches a safe path. Task guides cover import/generation, makers, development, testing and release preparation. Generated reference answers exact syntax questions. Safety explanations document why approvals and acceptance boundaries exist. Troubleshooting turns diagnostics into recovery steps.

The ownership rule is simple: command syntax and accepted kinds belong to the runtime catalog; explanatory command metadata belongs to existing help data; compiler recovery hints belong to the diagnostic catalog; contract rationale belongs in source comments; end-user workflows belong in Markdown. Do not distribute the same option list across all five places. Complex behavior still needs a behavioral test and human review: generation prevents duplication, not incorrect intent.

## Implementation and update mechanics

The collector imports only the trusted metadata modules needed for documentation, not the terminal adapter or command handlers. A pure renderer validates unique safe IDs/anchors, one consistent command group, known effect categories, positional bounds, usage/examples and descriptions for command-specific options. It distinguishes documented options from parser-accepted common flags without documented semantics. New undocumented catalog options fail the build instead of disappearing silently.

Four deterministic outputs are produced: command-reference Markdown, diagnostic Markdown, command JSON and a manifest with relevant input/output hashes. There are no timestamps or whole-repository commit hashes in those generated files. Authored files remain outside the generated directory. The writer refuses symlinked destinations and unknown files; updates are per-file rather than a claimed whole-directory transaction. Regeneration never executes the displayed examples.

The handbook audit checks simple authored examples with the live parser and validates local file links. This detects many stale spellings/options, not all runtime preconditions. TypeDoc's link/path validation complements it at site-build time. The test suite exercises missing descriptions, inconsistent grouping, duplicate anchors, escaping, determinism, stale checks, unknown files and filesystem safety. Actual native/CLI end-to-end tests remain separate and must not be replaced by documentation checks.

Validation configuration source: [TypeDoc validation](https://typedoc.org/documents/Options.Validation.html).

## Dependencies, CI and release handling

The optional renderer package is isolated under `tooling/documentation`. It does not change the application's package manifest/lockfile, become a generated-plugin runtime dependency or require a documentation server to use the CLI. Its location also avoids installing nested `node_modules` inside recursively scanned kit template roots. Pin direct dependencies, create and review its real lockfile, then use `npm ci --ignore-scripts` for ordinary builds. A pinned top-level manifest alone is not a locked transitive dependency graph.

CI should test the metadata/writer on Linux and Windows, generate from the actual checked-out source, run the authored-example audit, render HTML, and retain Markdown/JSON/HTML artifacts. Repository permissions remain read-only; deployment and release upload require separate approval. Retain documentation with each shipped candidate instead of adding copied multi-version source trees prematurely. Docusaurus's own versioning guide warns about the added contributor/build complexity of versioned documentation.

The generated manifest proves which relevant input bytes produced the reference; it is neither a signature nor product acceptance evidence. The delivered handbook identifies its reconciliation baseline. A release must inspect the actual archive to verify which manual files it contains. A site build does not automatically amend the developer-kit archive layout.

## What remains manual, and what should not be overpromised

Writers still explain new workflows, review safety implications, maintain meaningful examples, update screenshots when genuinely needed, and reconcile externally implemented opt-ins. The generator reduces repeated transcription of mechanical facts; it cannot guarantee factual correctness of prose or prove that an unexecuted example succeeds. No empirical percentage reduction in documentation effort is claimed.

Public hosting, comprehensive website accessibility/browser acceptance, automatic PDF output, translation and a rich multi-version portal are outside this increment. The portable Markdown and source-driven extraction deliberately keep these options open. The expected maintenance benefit is architectural: one change to the command metadata flows to terminal help and generated reference, while focused authored guidance is edited only when the user's workflow changes.
