# Project-local Workbench MCP

> Type: how-to guide · Part of the [docs index](../README.md)

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

Interactive Workbench setup asks whether to enable the local MCP and defaults to **No**. Non-interactive setup must pass `--mcp`; `--no-mcp` explicitly disables a previously setup-owned MCP. A setup rerun with neither flag preserves the current MCP state. The bootstrap setup also accepts `"mcp": true` or `"mcp": false` in its data-only answers file.

Setup never installs Claude Code or Codex, authenticates either client, changes user-global settings, or stores credentials.

Opt-in creates three project-local client files:

- `.mcp.json` — Claude Code project MCP registration. Claude still asks the user to trust project-scoped MCP configuration.
- `.claude/settings.local.json` — local project permissions that auto-allow only `workbench_capabilities` and `workbench_help`; `workbench_execute` still asks for approval. It coexists with generated shared `.claude/settings.json` and is already git-ignored.
- `.codex/config.toml` — Codex project MCP registration with an explicit three-tool allowlist, a 10-minute tool timeout, `writes` as the server default, and an explicit `prompt` override for `workbench_execute`. Codex loads project configuration only after the project is trusted.

Both clients launch the same application-owned transport:

```sh
node bin/app mcp
```

## MCP surface

The bundled CLI owns the server; there is no second application API to keep in sync. It exposes three deterministic tools:

- `workbench_capabilities` — read-only capability discovery.
- `workbench_help` — read-only CLI help.
- `workbench_execute` — exact argument-array delegation to `node bin/app`, with optional bounded stdin for data-driven commands.

`workbench_execute` can reach the whole Workbench command surface, including data-driven commands through optional bounded stdin, but the MCP layer never injects `--yes`, `--apply`, process trust, release authorization, or other permissions. The project-local server rejects `--root`, so it cannot redirect operations into another repository. Claude Code keeps this write-capable tool behind an explicit approval prompt; Codex keeps its write-aware MCP approval policy. Existing Workbench planners, plan hashes, file-ownership checks, test-vault restrictions, process trust and release boundaries remain authoritative.

The stdio bridge is anchored to the Workbench root rather than the client's current subdirectory. It supports the legacy initialize era through MCP revision 2025-11-25 and the stateless 2026-07-28 discovery era. Tool results include both readable text and structured machine output when Workbench returns JSON. Up to four requests may be in flight; stdio cancellation stops the owned Workbench process tree and cancelled calls emit no stale response. Output collection is UTF-8 aware; delegated output is bounded to 1 MiB, stdin to 256 KiB, each request frame to 512 KiB measured as UTF-8 bytes, and a tool-selected timeout to ten minutes.

## Ownership and reruns

Bootstrap setup records exact hashes of the three client files in `.template-state/setup.json`. Workbench setup places them under its existing intake ownership receipt. A rerun may update only bytes setup still owns. If a user or another tool edits a managed MCP configuration file, setup stops rather than overwriting it.

MCP lifecycle is explicit: ordinary setup reruns preserve the existing state; `--mcp` enables or refreshes setup-owned configuration; `--no-mcp` removes only files whose current hashes still match setup ownership. Edited or unmanaged client files are never deleted automatically and instead produce an ownership conflict.

## Verify the client connection

After setup, restart or reopen the client and trust the project configuration. Then verify the registration without changing Workbench state:

```sh
claude mcp list
codex mcp list
```

Inside either client, use the read-only capability/help tools first. A write-capable `workbench_execute` call remains subject to the client's approval UI and to Workbench's own plan, trust, and authorization requirements.
