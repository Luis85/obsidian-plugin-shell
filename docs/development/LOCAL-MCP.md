# Project-local Workbench MCP

Workbench can expose its complete CLI surface to coding agents through a repository-local stdio MCP server. The server is **off by default**.

## Opt in during setup

Fresh-checkout bootstrap:

```sh
npm run setup -- --mcp --dry-run
npm run setup -- --mcp
```

Workbench setup:

```sh
node bin/app setup --mcp --dry-run --id my-plugin --name "My Plugin" --author "Team" --blank
node bin/app setup --mcp --yes --id my-plugin --name "My Plugin" --author "Team" --blank
```

Interactive Workbench setup asks whether to enable the local MCP and defaults to **No**. Non-interactive setup must pass `--mcp`; `--no-mcp` suppresses the interactive offer. The bootstrap setup also accepts `"mcp": true` in its data-only answers file.

Setup never installs Claude Code or Codex, authenticates either client, changes user-global settings, or stores credentials.

Opt-in creates three project-local client files:

- `.mcp.json` — Claude Code project MCP registration. Claude still asks the user to trust project-scoped MCP configuration.
- `.claude/settings.local.json` — local project permission for the `workbench` MCP server. It coexists with generated shared `.claude/settings.json` and is already git-ignored.
- `.codex/config.toml` — Codex project MCP registration with `default_tools_approval_mode = "writes"`. Codex loads project configuration only after the project is trusted.

Both clients launch the same application-owned transport:

```sh
node bin/app mcp
```

## MCP surface

The bundled CLI owns the server; there is no second application API to keep in sync. It exposes three deterministic tools:

- `workbench_capabilities` — read-only capability discovery.
- `workbench_help` — read-only CLI help.
- `workbench_execute` — exact argument-array delegation to `node bin/app`.

`workbench_execute` can reach the whole Workbench command surface, but the MCP layer never injects `--yes`, `--apply`, process trust, release authorization, or other permissions. Existing Workbench planners, plan hashes, file-ownership checks, test-vault restrictions, process trust and release boundaries remain authoritative.

The stdio bridge supports the legacy initialize era through MCP revision 2025-11-25 and the stateless 2026-07-28 discovery era. Delegated output is bounded to 1 MiB and a tool-selected timeout is bounded to ten minutes.

## Ownership and reruns

Bootstrap setup records exact hashes of the three client files in `.template-state/setup.json`. Workbench setup places them under its existing intake ownership receipt. A rerun may update only bytes setup still owns. If a user or another tool edits a managed MCP configuration file, setup stops rather than overwriting it.

Disabling MCP later does not automatically delete existing configuration. Removal is explicit so setup cannot destroy agent settings that may have been extended after installation.
