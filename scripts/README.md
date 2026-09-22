# Tooling directory

## Implemented now

- `harness/serve-style-fixture.mjs`: fixed-allowlist loopback HTTP specimen server.
- `testing/verify-baseline.mjs`: finite baseline policy, source checks, real tests, repeated outcomes, scope-bound reports.
- `testing/check-browser-specimen.mjs`: optional preprovisioned Playwright checks, explicit served/inline evidence modes.
- Other `testing/` files: small shared plan/report/observer/process helpers used by those checks.

```sh
node scripts/testing/verify-baseline.mjs --repeat 3 --json
node scripts/testing/verify-baseline.mjs --profile release --json
```

The first can pass for this baseline. The second intentionally reports blocked with exit 2; there is no native-candidate release validator yet. This is not an implementation of the future full `npm run verify` or publication workflow.

Reports go to unique ignored folders under reports/. No cached report is treated as a test execution. Errors/unknown schema/empty or skipped tests fail. Node test workers use synthetic isolated temporary directories, not user vaults.

## Planned

Setup/bootstrap, makers/templates, plugin build, deployment, event/entity catalog and release tooling still follow the [setup/maker contract](../docs/development/SETUP-AND-MAKERS.md). Keep actual executable tooling here and root tool configuration thin. Do not create placeholder setup or a package.json merely to suggest unimplemented commands work.

Dependency-free Node tests are an explicitly bounded bridge until WP-00 qualifies Vitest/Vite/Playwright Test. Port the assertions into those configured projects; do not maintain two permanent copies. The browser assertions use Playwright APIs and are reusable in the eventual Playwright Test suite.

See [strategy](../docs/testing/TEST-STRATEGY.md) and [concept](../docs/testing/TEST-CONCEPT.md) for scope, commands, determinism, security and migration.
