# Shell-first prototype tooling

## Ownership and discovery

The installed `scripts/prototype.mjs` is an adapter, not a second shell CLI, source
compiler, JSON schema, maker registry, process runner, file planner or dependency
resolver. `npm run prototype:tools -- help` is its package entrypoint. Its `discover` operation
loads the trusted checkout/compiled kit's **actual** `executeOperation`, command parser,
capability/maker catalogs, profile lists and present package scripts. Do not guess a
command from this document when the current capability response disagrees.

Run static `inspect-repository.mjs` before trusting a new checkout. Live discovery
executes repository modules, so do it only with an approved local repository. Source
checkouts and `.framework/compiled` release kits are both supported. The launcher uses
the shell's Node type-stripping convention on older supported Node; use the qualified
`.nvmrc`/packageManager/lockfile for actual qualification.

| Task | Existing owner used by the skill |
| --- | --- |
| Inspect format and generator obligations | `project inspect --input` |
| Seed an entire plugin workspace | `new --from` or reviewed `new --starter` |
| Accept a changed existing project definition | `project import` before in-place `generate` |
| Add features, components, stores, use cases, views, entities, events | `make list`, `make describe`, then the actual maker's plan/apply |
| Inspect/export design-system styles | `styles inspect`, reviewed `styles export` |
| Saved generation plans | `plan inspect`, `plan apply`; the shell rebuilds the request |
| Synthetic vault fixtures | `vault prepare`, `data plan/apply/reset-plan/reset`, exact fixture `approval` hash |
| Locked dependencies | Explicit `install --yes`; never hidden inside `new` or `build` |
| Product build and acceptance scaffolds | `build`, `check`, `test --profile project`, `verify --profile project` |
| Other existing gates | `npm --script` whitelist filtered against actual package.json |
| Browser prototype compilation | `vite-shared.mjs`, hash-guarded Nuxt UI adaptation, `css-ownership.mjs`, `license-notices.mjs` |
| Save concept under docs | Same package scanner as ZIP, then `createFilePlan` / `applyFilePlan` |
| Browser QA | Workspace's locked `@playwright/test`; `SHELL_CHROMIUM` override; no browser download |
| Tests and CI | `tests/suites.json`, existing suite runner and framework-cli matrix |
| Skill distribution | Explicit package inventory, generator extension ownership, framework template inventory |

Native-host and release commands remain separate. The adapter refuses native profiles,
plugin installation, development/watch processes, custom executable makers and release
operations. These are not needed to create an offline clickdummy. Outside this adapter,
use the existing native workflow only with separately approved contained-vault authority.

## Concrete generation path

From a checked-out shell containing the skill:

```sh
npm run prototype:tools -- discover --repo .
npm run prototype:tools -- shell --repo . -- project inspect --input /work/companion.project.json
npm run prototype:tools -- new --repo . --out ../concept-source --input /work/companion.project.json
# Review data.planHash, all changed paths, compiler warnings and acceptance TODOs.
npm run prototype:tools -- new --repo . --out ../concept-source --input /work/companion.project.json --execute --apply REVIEWED_SHA256
```

`REVIEWED_SHA256` must be replaced with the exact current hash. Changing input, template,
identity, target or ownership invalidates it. `--execute` alone does not apply a plan.
`--yes` is refused for file plans. It is accepted only for explicit dependency install.
`--plan-out` also writes and therefore needs `--execute`. Source JSON cannot carry
execution approval. Never copy .framework receipts to manufacture ownership.

For an improvement, use the complete modified baseline export to generate an independent
scratch workspace. For explicitly approved in-place work, run `project import` preview,
apply that exact hash, then `generate` preview/apply. Keep all unaffected IDs and contracts.
The local companion import is still a reviewed whole-project replacement, not a merge.

Use existing makers instead of duplicating framework boilerplate:

```sh
npm run prototype:tools -- shell --repo ../concept-source -- make list
npm run prototype:tools -- shell --repo ../concept-source -- make describe component
# Then use exactly the returned recipe arguments and review its plan before applying.
npm run prototype:tools -- shell --repo ../concept-source --execute -- install --yes
npm run prototype:tools -- shell --repo ../concept-source --execute -- check
npm run prototype:tools -- npm --repo ../concept-source --script check:architecture --execute
npm run prototype:tools -- npm --repo ../concept-source --script check:presentation --execute
```

Process operations are previewed unless `--execute` is present. They execute trusted
project code and can write builds/reports/caches. Their cancellation/timeouts and npm
selection use `scripts/framework/process.ts`; they do not claim rollback of process effects.
Ordinary shell `--root` is not accepted through the adapter: choose the one explicit
`--repo`. Fixture mutation uses `data`'s own `approval` hash, not a generator plan hash.

## Building the actual HTML

Work inside the generated `source/` workspace, not the original framework. Write an
isolated TypeScript entry under `harness/prototype/`; start from
`assets/templates/browser-entry.ts.tmpl`, replacing all placeholders and supplying the
real root Vue SFC, typed injections and original synthetic host-token defaults. All
reusable SFCs stay under the project's presentation components; the entry only composes.
Use `src/bootstrap/mount-ui.ts` for the project's disposal/injection/portal conventions.
The scaffold template is not a complete application or acceptance result.

```sh
# Within source/; output parent already exists. The generated manifest and JSON ID must agree.
npm run prototype:build -- --repo . --entry harness/prototype/main.ts --project ../companion.project.json --out ../prototype.html --title "Approved concept" --execute
```

The worker runs with source/ as its cwd through the existing shell process adapter.
It resolves Vite from **that workspace**, checks declared/locked/installed stack pins,
uses `sharedConfig()` unchanged for qualified UI patches/scoped CSS, and adds the
existing bundled-license plugin. It writes no `dist/main.js` or native artifact triplet.
One in-memory IIFE/CSS result is required; unembedded assets, dynamic chunks, native
imports or a build not actually using Vue/Pinia/Nuxt UI fail. No dependency is downloaded.
The assembler puts the actual `ps--<id>`/`data-plugin-ui` scope on the mount root and
embeds original JSON bytes. `--replace` explicitly permits replacing HTML only after
compilation and static checks succeed. A failed build leaves last-good HTML intact.

This is not type checking. Separately run the shell's checks, source/presentation/style
and coverage gates, the actual scenario tests, and exact-artifact browser journeys.
A green native `build` does not prove the standalone HTML; a built HTML does not prove
native Obsidian behavior. Preserve that distinction in evidence.

## Packaging and saving

`pack-concept.py --check` is read-only package structure/hash inspection. It is not
companion validation or honest execution proof. The save adapter uses its exact inclusion
policy and rejects bytes changed after that inspection, then delegates writes to the
shared file planner. It only permits a **new** `docs/concepts/<manifest-slug>/` directory.
No existing concept is replaced, no ZIP is uploaded automatically, and no Git operation
or live importer is called. Inspect plan output, then repeat with `--execute --apply`.

```sh
npm run prototype:tools -- save --repo . --package /work/concept --slug approved-concept
npm run prototype:tools -- save --repo . --package /work/concept --slug approved-concept --execute --apply REVIEWED_SHA256
npm run prototype:tools -- pack --root /work/concept --output /work/approved-concept.zip --execute
```

## Distribution and maintenance

The canonical `.claude/skills/companion-prototype-design/` package and its single
allowlisted `.agents/skills/companion-prototype-design/SKILL.md` reference-only entrypoint
are copied. Codex reads the canonical workflow, never a second implementation. Personal agent settings,
other skills, credentials and account data are never discovered for distribution.
`PACKAGE-INVENTORY.json` has the complete bounded UTF-8 payload's sizes and SHA-256.
The optional inventory `entrypoints` list permits only that exact Codex path and
records its byte size and hash; an orphan, missing or tampered adapter fails closed.
Legacy packages with neither an entrypoints list nor an adapter remain readable.
The generator uses `extension` ownership, preserving user edits and reporting actual
regeneration conflicts. The release template preserves these literal bytes; it must
not substitute prompt placeholders or rewrite skill-relative Markdown. Normal shell
integrity checks cover the skill in release archives and generated-workspace receipts.
`sourceInputs` also includes the installed skill in source/evidence/line-limit inventories.

When maintaining this skill, regenerate its inventory after changing payload bytes,
then run `npm run test:prototypes`, `npm run test:prototypes:python`, framework/generator
type checks and applicable existing gates. No whole-directory analyzer exclusion or
threshold reduction is justified by this integration. Tests requiring dependencies or
a browser must report unavailable prerequisites, not silently count as passed.
