# Project-local Workbench MCP

The setup flow can expose the Workbench application to coding agents through a repository-local stdio MCP server.

## Opt in

Preview first:

```sh
npm run setup -- --mcp --dry-run
```

Apply through the normal reviewed setup flow:

```sh
npm run setup -- --mcp
```

MCP is disabled by default. Interactive setup asks once and defaults to **No**. Non-interactive setup requires `--mcp` (or `"mcp": true` in the data-only answers file).

Opt-in creates three project files:

- `.mcp.json` — Claude Code project MCP registration.
- `.claude/settings.json` — explicitly allows the `workbench` MCP server tools.
- `.codex/config.toml` — Codex project MCP registration with write-capable tools still using the client approval policy.

Claude Code asks the user to trust project-scoped MCP configuration. Codex loads project `.codex/config.toml` only for trusted projects. Setup does not install either client, sign in, change user-global settings, or place credentials in the repository.

## Server surface

`scripts/agent/workbench-mcp.mjs` is dependency-free and uses stdio JSON-RPC. It exposes:

- `workbench_capabilities` — read-only capability discovery.
- `workbench_help` — read-only CLI help.
- `workbench_execute` — an exact argument-array bridge to `node bin/app`.

The execute tool deliberately does **not** add `--yes`, `--apply`, release flags, or any other authorization. Existing Workbench commands remain the source of truth for planning, validation, confirmation, file safety, process trust, and release boundaries. The MCP process uses Node argument arrays with `shell: false`, a fixed repository root, a bounded output budget, and a bounded timeout.

## Ownership and reruns

Setup records the exact hashes of the MCP client files in `.template-state/setup.json`. A rerun can leave those files unchanged or update a file that still matches the last setup-owned hash. If a user or another tool changed one of the files, setup stops with `MCP_CONFIG_CONFLICT` instead of overwriting it.

Disabling MCP in a later setup run does not delete existing configuration. Removal is an explicit manual change so setup cannot silently remove agent configuration that may have been extended after installation.
