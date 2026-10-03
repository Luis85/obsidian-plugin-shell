# Tooling directory

The developer CLI starts at `bin/app` (run `node bin/app <command>`) and its whole core lives in `bin/`.
This folder holds real scripts plus three justified non-tooling holdings: the typed contract zones in
`contracts/` and `shared/`, the starter schema data in `starters/` and the companion contract library in
`companion/` (its tooling entries are in `companion-tools/`). Each remaining item and its reason is listed in
[scripts consolidation](../docs/development/SCRIPTS-CONSOLIDATION.md).

## Implemented now

- `harness/serve-style-fixture.mjs`: fixed-allowlist loopback HTTP specimen server.
- `testing/verify-baseline.mjs`: finite baseline policy, source checks, real tests, repeated outcomes, scope-bound reports.
- `testing/check-browser-specimen.mjs`: optional preprovisioned Playwright checks, explicit served/inline evidence modes.
- Other `testing/` files: small shared plan/report/observer/process helpers used by those checks.

```sh
node scripts/testing/verify-baseline.mjs --repeat 3 --json
node scripts/testing/verify-baseline.mjs --profile release --json
```

The first can pass for this retained baseline. The second intentionally reports
blocked with exit 2: its legacy acceptance inventory is separate from current
`npm run verify`, native evidence and candidate operations. See the
[readiness ledger](../docs/development/TEMPLATE-READINESS-LEDGER.md).

Reports go to unique ignored folders under reports/. No cached report is treated as a test execution. Errors/unknown schema/empty or skipped tests fail. Node test workers use synthetic isolated temporary directories, not user vaults.

## Current implementation

`setup/`, `makers/`, `examples/`, `bundling/`, `dev/`, `quality/`, `maintenance/`
and `release/` contain the current executable workflows. Run `npm run help` for
commands and [authoring tools](../docs/development/AUTHORING-TOOLS.md) for supported
recipes. `release/cli.mjs` exposes authenticated planning and separately authorized
execution through the retained-candidate engine and GitHub adapter; read
[release execution](../docs/development/RELEASE-EXECUTION.md) before opting in.
Entity catalog/check commands exist; separate event catalog/check commands remain
an open requirement. Keep root configuration thin and shared policy here.

Node tests cover tooling and retained fixture acceptance. Vitest exercises actual
application services/components; Playwright serves the real harness. These scopes
remain distinct and do not silently promote the legacy release profile.

See [strategy](../docs/testing/TEST-STRATEGY.md) and [concept](../docs/testing/TEST-CONCEPT.md) for scope, commands, determinism, security and migration.

## Native stylesheet and token tools

`styles/check-tokens.mjs` verifies the pinned snapshot, reviewed aliases, inventories and profile order offline. `styles/export-host-css.mjs` exports verified runtime CSS to stdout; redirection is explicit. `harness/style-profile.mjs` defines the extracted versus simulated inputs. `styles/check-style-literals.mjs` (`npm run check:style-literals`, part of verify) rejects raw colour literals (hex, rgb/hsl and other colour functions, named colours) in `src/**/*.css`, Vue `<style>` blocks and simple inline template styles, listing `file:line:column`, the literal and reviewed Obsidian tokens to use; `var(--token)`, `color-mix()` over tokens, `transparent`, `currentColor` and `inherit` pass. Exact-file exceptions need a reason in `styles/style-literal-allowlist.json` and go stale-checked; `styles/generated-style-literal-allowlist.json` serves the generated-project test. These tools do not download dependencies, regenerate the source snapshot, or publish. See [the token contract](../docs/design/OBSIDIAN-TOKENS.md).

## Design-first prototype tooling

`npm run prototype:tools -- discover --repo .` reads the real shell command/maker
catalog. The skill delegates generation, fixtures and checks to the existing shell,
compiles HTML through the shared Vue/Nuxt UI pipeline, and saves reviewed concept
packages through the common file planner. Its tests use `tests/suites.json`; the
framework archive and generated developer kit ship the explicitly inventoried skill.
See [prototype tooling](../docs/development/PROTOTYPE-TOOLING.md).
