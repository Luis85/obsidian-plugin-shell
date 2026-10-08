# Tooling directory

This directory holds repository commands for setup, building, verification,
qualification and delivery. Tooling can import source projects; source projects
never import `tooling/` or root `tests/`. Tests of these commands live in
`tooling/tests/`, classified in `tests/suites.json`.

The CLI's development source lives in `src/cli/`; its reusable terminal UI and
shared contracts live in `src/tui/` and `src/shared/`. Run
`npm run app:dev -- <command>` during CLI development. Build with
`npm run build:cli`, then run the generated standalone product with
`node bin/app <command>`. Keep that complete `bin/` folder together and never
edit its generated files. The source-project manifest and dependency rules are
explained in [repository layout](../docs/development/REPOSITORY-LAYOUT.md).

## Implemented now

- `harness/serve-style-fixture.mjs`: fixed-allowlist loopback HTTP specimen server.
- `testing/verify-baseline.mjs`: finite baseline policy, source checks, real tests, repeated outcomes, scope-bound reports.
- `testing/check-browser-specimen.mjs`: optional preprovisioned Playwright checks, explicit served/inline evidence modes.
- Other `testing/` files: small shared plan/report/observer/process helpers used by those checks.

```sh
node tooling/testing/verify-baseline.mjs --repeat 3 --json
node tooling/testing/verify-baseline.mjs --profile release --json
```

The first can pass for this retained baseline. The second intentionally reports
blocked with exit 2: its legacy acceptance inventory is separate from current
`npm run verify`, native evidence and candidate operations. See the
[readiness ledger](../docs/_archive/development/TEMPLATE-READINESS-LEDGER.md).

Reports go to unique ignored folders under reports/. No cached report is treated as a test execution. Errors/unknown schema/empty or skipped tests fail. Node test workers use synthetic isolated temporary directories, not user vaults.

## Current implementation

`setup/`, `makers/`, `examples/`, `bundling/`, `dev/`, `quality/`, `maintenance/`
and `release/` contain the current executable workflows. Run `npm run help` for
commands and [authoring tools](../docs/development/AUTHORING-TOOLS.md) for supported
recipes. `release/cli.mjs` exposes authenticated planning and separately authorized
execution through the retained-candidate engine and GitHub adapter; read
[release execution](../docs/development/RELEASE-EXECUTION.md) before opting in.
The delivery pipeline adds `src/cli/tooling/release/changelog.mjs` (`release:changelog`: `check`
validates Keep a Changelog 1.1.0, `notes --version X.Y.Z` prints one section),
`release/branch.mjs verify --version X.Y.Z` (read-only release-branch metadata gate),
`release/cut.mjs` (`release:cut`: a plan by default; `--execute` commits
`release: X.Y.Z` on `release/X.Y.Z`, `--remote` pushes, opens the draft release pull
request and dispatches `release.yml`) and `release/publish.mjs` (`release:publish`: a
read-only plan by default; `--execute` merges the green release pull request, tags the
tested head `X.Y.Z`, publishes the candidate assets with the changelog section and
deletes the branch). Each script's header comment documents its flags, refusals and
exit codes. Exit 2 can mean an uncertain remote write: inspect the remote state
and retained operation record before resuming; never retry blindly. None of them
promotes the blocked legacy release profile.
`delivery/` holds the dependency-free Definition of Ready and Definition of Done
checks over an increment handoff (`docs/increments/<slug>.md`): `increment.mjs`
(`increment:new`), `ready.mjs` (`dor`) and `done.mjs` (`dod`; `--write` generates the
Completion record, CHANGELOG entries, docs index rows and `status: done`). Rules,
severities and exemptions live in `configs/delivery/`. The shared delivery modules in `src/cli/tooling/delivery/` provide the handoff
parser, path globs, strict config loader, pure rule sets, generators, reports and
repository adapter; `tooling/delivery/` owns the repository command entries. Exit codes: 0 ready/done/exempt, 1 not,
2 usage, configuration or base error.
Entity catalog/check commands (`entities:catalog`, `entities:check`) and event
catalog/check commands (`events:catalog`, `events:check`) exist. Keep root
configuration thin and shared policy here.

Node tests cover tooling and retained fixture acceptance. Vitest exercises actual
application services/components; Playwright serves the real harness. These scopes
remain distinct and do not silently promote the legacy release profile.

See [strategy](../docs/testing/TEST-STRATEGY.md) and [concept](../docs/testing/TEST-CONCEPT.md) for scope, commands, determinism, security and migration.

## Native stylesheet and token tools

`styles/check-tokens.mjs` verifies the pinned snapshot, reviewed aliases, inventories and profile order offline. `styles/export-host-css.mjs` exports verified runtime CSS to stdout; redirection is explicit. `harness/style-profile.mjs` defines the extracted versus simulated inputs. `styles/check-style-literals.mjs` (`npm run check:style-literals`, part of verify) rejects raw colour literals (hex, rgb/hsl and other colour functions, named colours) in handwritten CSS, Vue `<style>` blocks and simple inline template styles under `src/` (excluding `src/companion/` and `src/plugin/harness/`), listing `file:line:column`, the literal and reviewed Obsidian tokens to use; `var(--token)`, `color-mix()` over tokens, `transparent`, `currentColor` and `inherit` pass. Exact-file exceptions need a reason in `styles/style-literal-allowlist.json` and go stale-checked; `styles/generated-style-literal-allowlist.json` serves the generated-project test. These tools do not download dependencies, regenerate the source snapshot, or publish. See [the token contract](../docs/design/OBSIDIAN-TOKENS.md).

## Design-first prototype tooling

`npm run prototype:tools -- discover --repo .` reads the real shell command/maker
catalog. The skill delegates generation, fixtures and checks to the existing shell,
compiles HTML through the shared Vue/Nuxt UI pipeline, and saves reviewed concept
packages through the common file planner. Its tests use `tests/suites.json`; the
framework archive and generated developer kit ship the explicitly inventoried skill.
See [prototype tooling](../docs/development/PROTOTYPE-TOOLING.md).
