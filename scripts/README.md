# Tooling directory

## Available now

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

The first starts a loopback-only fixed-asset server for the original stylesheet specimen; Ctrl+C stops it. `--help` prints usage. The second runs seven focused Node tests. Neither initializes the plugin or replaces full verification. There is no package.json yet.

## Planned structure

Keep setup/bootstrap, makers/templates, shared safe-file/process helpers, build/style composition, local deployment, quality, maintenance and release logic under scripts. Root configs/package commands/Actions stay thin. See [TOOL-01–06](../docs/development/SETUP-AND-MAKERS.md).

Bootstrap must run without installed dependencies. Do not wire an interactive wizard to npm install/prepare hooks. Generation uses safe plans, explicit registries, tests and collision handling. Setup and makers never write example Task notes into a personal vault.

The current host-style server is intentionally a small standalone qualification tool. Integrate its fixture/tests into the selected Vite/Vitest/Playwright projects when those exist; do not create a second permanent stack. It serves no vault or arbitrary repository paths and performs no network installation.

Runtime services and plugin CSS stay under src; original host simulation and gallery stay under harness. Release code must exclude them. Source tooling ≤400 physical lines, tests/helpers ≤450. No implicit privilege changes, global installation, browser opening, or publication.

[Harness contract](../docs/testing/HARNESS-STYLES.md) · [Error/notification contract](../docs/architecture/ERRORS-AND-NOTIFICATIONS.md) · [Release guide](../docs/development/MAINTENANCE-AND-RELEASE.md)
