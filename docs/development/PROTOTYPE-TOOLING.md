# Design-first prototype tooling

The [companion-prototype-design skill](../../.claude/skills/companion-prototype-design/SKILL.md)
conducts an approved design interview and emits a complete fresh-session execution
prompt. Its helpers compose the existing shell rather than inventing another generator.
The [tooling integration reference](../../.claude/skills/companion-prototype-design/references/tooling-integration.md)
is the complete command, permission, distribution and build contract.

## Entry points

```sh
npm run prototype:tools -- help
npm run prototype:tools -- discover --repo .
npm run prototype:tools -- shell --repo . -- project inspect --input /work/project.json
npm run prototype:tools -- new --repo . --out ../concept-source --input /work/project.json
# Review the actual plan, then repeat with --execute --apply <its exact SHA-256>.
npm run prototype:tools -- shell --repo ../concept-source --execute -- check
```

`prototype:tools` avoids the reserved plain `prototype` object key rejected by the
shell's existing safe-JSON boundary. No JSON safety rule is relaxed for this alias.
`prototype:build` is the source workspace's explicit standalone HTML build entrypoint;
it requires repo, TypeScript harness entry, companion project, output and title arguments.
No native `dist/` build or generated business acceptance is implied by HTML compilation.

## Reused owners

The adapter calls `scripts/framework/catalog.ts`, `operations.ts` and `process.ts` (or
their compiled-kit equivalents). These own command contracts, plans/approvals, process
cancellation and toolchain selection. Vite compilation reuses
`scripts/bundling/vite-shared.mjs`, CSS ownership, hash-guarded Nuxt UI replacements and
bundled-license notices. A concept save calls the same scanner as ZIP packaging, then
`scripts/shared/file-plan.mjs` for containment, fresh preconditions, locking and rollback.

`prototype-skill.mjs` verifies the bounded package inventory. The project compiler emits
these files as extension-owned developer-kit entries; the framework archive includes
the exact source package in its template. It never scans/copies personal Claude settings
or other skills. Literal prompt templates retain their bytes and placeholders.

## Tests and qualification

```sh
npm run test:prototypes
npm run test:prototypes:python
npm run test:suites -- --check
npm run typecheck:framework
npm run typecheck:generator
npm run check:source
```

The existing framework-cli workflow runs both suites on its OS matrix with the repository
lockfile. A dependency-gated real Vite test compiles a Vue/Pinia/Nuxt UI fixture and checks
single-file output and last-good preservation; it explicitly skips on a dependency-free
host. That test is not a browser acceptance test. Do not count a skipped prerequisite as
passing. Source inventories include the skill, so source-line policies and evidence
freshness apply. The existing native, browser, generator, coverage and release gates
retain their independent meaning and thresholds.

## Claude is canonical; Codex delegates

Claude: `.claude/skills/companion-prototype-design/SKILL.md` owns the workflow,
references, templates, helpers and gates. Codex: the checked-in
[entrypoint](../../.agents/skills/companion-prototype-design/SKILL.md) only instructs
Codex to load that canonical file. Invoke `$companion-prototype-design` in Codex.

Both entrypoints travel through the same bounded inventory and extension-owned
project generation. Source/evidence inventories include the Codex file as well.
No other `.claude` or `.agents` files are discovered for distribution. Missing canonical
content blocks the adapter rather than triggering a divergent fallback workflow.
