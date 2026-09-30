# Hindsight: keyless, opt-in developer memory

## What is and is not automatic

The project exposes `node bin/app memory <command>`, `node bin/app help memory` and the equivalent `npm run memory -- <command>`. Help, provider discovery and installation previews do not need project npm dependencies, Python, a provider key or a running daemon. Operations on a bank require a Git checkout. This is developer tooling, not part of the Obsidian plugin runtime or companion UI.

Nothing installs or activates Hindsight during clone, ordinary `npm install`, setup, tests or builds. Once a contributor explicitly runs memory setup and approves the connection, opening an opted-in **local** project in Claude's Code tab or Codex can start the already installed profile and provide the official MCP tools. Desktop trust/permission prompts still belong to the user. A cloud execution session is a different machine and cannot access the workstation's loopback API.

## Choose a provider without an API key

MCP connects the outer coding agent to memory. It does not lend that agent's current conversation model to the memory server. Hindsight's internal reasoning needs its own configured provider unless you select its limited no-LLM mode. Keyless does not mean unlimited usage, no account, no downloads or automatically offline.

| Provider | Requirement | Capability |
| --- | --- | --- |
| `openai-codex` | Eligible Codex account authentication accessible as `auth.json` to the daemon | Account-backed extraction and reflection, no separate API key |
| `claude-code` | Authenticated Claude Code/official Agent SDK on this machine | Account-backed extraction and reflection; upstream limits this route to personal development |
| `ollama` | Running local server and explicitly selected downloaded model | Local inference; model capability and hardware determine results |
| `lmstudio` | Loaded model and enabled local server | Local inference; model capability and hardware determine results |
| `none` | Local embedding/reranking models, downloaded on first use | Chunk storage and recall; no generated reflection, facts or knowledge-page synthesis |
| `environment` | Deliberately configured existing profile/environment | Advanced compatibility mode; actual key requirement depends on the underlying provider |

These are upstream-supported provider routes, not a claim that every subscription/model is eligible or has been tested here. See the [upstream models guide](https://hindsight.vectorize.io/developer/models) and [configuration reference](https://hindsight.vectorize.io/developer/configuration). Follow the providers' current account conditions. The helper never signs in, extracts desktop tokens or copies credentials into the repository.

`openai-codex` defaults here to `gpt-5.4-mini`; `claude-code` defaults to `claude-sonnet-4-5-20250929`, matching the reviewed upstream configuration. An explicit `--model` can select another supported model. Local providers always require a model identifier; no model is silently downloaded or selected by this helper. Upstream embeddings/reranker downloads still occur on initial service use.

### Codex authentication and desktop login

Desktop sign-in alone is not proof that Hindsight can read usable file-backed credentials. Follow the installed Codex client's documented sign-in flow and verify the expected auth location without printing its contents. Upstream warns that long-lived services sharing rotating credentials with interactive sessions can lose refresh access. A dedicated auth home is supported:

```sh
node bin/app memory setup --agents claude-code,codex --provider openai-codex --auth-home /absolute/private/hindsight-codex
```

Authenticate that home separately using the official client first. The path is non-secret configuration; its contents are private. The helper persists the path so desktop launches do not depend on a terminal's `CODEX_HOME`. This option changes the **Python service's** auth home, not the desktop client's configuration location. The latter follows the normal `CODEX_HOME` of the process running `connect`.

For Claude, use the official authenticated Agent SDK route; no token spoofing or OAuth-to-API proxy is introduced. Both account-backed routes need access to their remote provider and can consume account allowance. Use local inference when that distinction is unsuitable.

## First-time setup

Use the repo's qualified Node/npm toolchain (`.nvmrc` and `packageManager`). Optional package installation needs Python 3.11+ with venv/pip, Git, npm and selected agent prerequisites. The source launcher supports Node 22.13+ native type stripping. Full installation on Intel macOS is deliberately refused; a separately reviewed slim/external-service setup is not silently substituted. Standard development remains available without Hindsight.

Preview a full desktop setup, choosing just the agents you use:

```sh
node bin/app memory setup --agents claude-code,codex --provider openai-codex
```

After reviewing its provider prerequisites, installation effects and data processing:

```sh
node bin/app memory setup --agents claude-code,codex --provider openai-codex --apply --accept-data-processing
```

No `HINDSIGHT_API_LLM_API_KEY` or generic LLM environment variable is required for explicit keyless providers. Alternative previews:

```sh
node bin/app memory setup --agents claude-code --provider claude-code
node bin/app memory setup --agents claude-code,codex --provider ollama --model YOUR_DOWNLOADED_MODEL
node bin/app memory setup --agents codex --provider none
```

Replace the local model placeholder before applying. `--base-url` is limited to credential-free HTTP loopback URLs for Ollama/LM Studio. Default local endpoints are ports 11434/1234 with `/v1`. `--python PATH` selects the installation interpreter. On Windows, the equivalent `npm run memory -- ...` entry supplies npm's Node-based launcher when needed.

The helper pins direct versions `hindsight-all==0.10.1`, `hindsight-client==0.10.1`, `@vectorize-io/hindsight-coding-agents@0.7.0`. It installs them in a user-local venv/npm runtime, calls the official native agent installer, and connects selected Claude Code/Codex clients. It does not install agent clients globally. `install` is the narrower packages/hooks command; `setup` includes desktop MCP registration. The direct pins are not a cross-platform transitive lock; npm retains its local runtime lockfile. The plugin's root npm dependency graph/lockfile is unchanged.

Close active agent sessions before changing provider or connection settings. First startup can download dependencies/models and exceed a client's startup deadline. Warm the profile once with `memory start --apply`, then restart the desktop app. Verify the correct bank and available tools before using sensitive content.

## Desktop connections and reviewed launchers

The helper edits native user configuration after explicit approval, rather than committing machine paths or active MCP settings into Git:

| Client | Configuration | Project selection |
| --- | --- | --- |
| `claude-code` | `~/.claude.json`, server `hindsight` | Local Code/CLI process working directory |
| `codex` | `~/.codex/config.toml`, respecting caller `CODEX_HOME` | Local Codex process working directory |
| `claude-desktop` | Native macOS/Windows `claude_desktop_config.json` | Explicit checkout root, repository-specific server name |

Claude's local Code tab shares CLI MCP configuration; Codex's desktop/CLI/IDE surfaces share its TOML configuration. See the [Claude desktop documentation](https://code.claude.com/docs/en/desktop) and [Codex MCP documentation](https://developers.openai.com/codex/mcp). A registration in a file is not proof that a particular app version accepted it. Chat and Code surfaces have distinct precedence rules; avoid adding duplicate connections unnecessarily.

To connect existing installations or the optional Claude chat surface:

```sh
node bin/app memory connect --client claude-code
node bin/app memory connect --client codex
node bin/app memory connect --client claude-desktop
```

Each is a preview. Repeat with `--apply`; optionally bind approval to the returned `--plan HASH`. Only owned MCP entries are changed. Foreign/customized entries, malformed configuration and ambiguous TOML layouts are refused. Unrelated settings and TOML comments outside the edited table survive. Existing files receive private backups; this helper coordinates its own writes with a lock and checks preimages, not a universal lock against external editors.

The registered command points at a **content-fingerprinted snapshot under `~/.hindsight/obsidian-shell/launchers/`**, not executable source on the active Git branch. This prevents a checkout/branch change from silently replacing the launcher previously approved for desktop autostart. Connecting again explicitly stages a new version after source updates. Previously staged content that no longer matches is preserved and rejected during reconnect, not overwritten. Snapshots do not protect against another local process with write access to the user account; they are not a sandbox or signature scheme.

At launch, the snapshot validates local opt-in and package version, starts/reuses the approved Python profile, then delegates stdio to the official coding-agents MCP server. Its stdout remains protocol-only. It neither installs packages nor signs in. The official server receives an explicit harness and project directory so its bank matches native hooks. Disabled/unapproved repositories cannot launch the delegate. Reconnect explicitly after a helper update or Node installation-path change; restart existing MCP processes after disabling memory.

## Management and diagnostics

| Command | Effect |
| --- | --- |
| `providers` | Explain provider choices and prerequisites without Git/service access |
| `configure --provider NAME` | Preview a non-secret provider setting; `--apply` persists it without starting inference |
| `status` | Read local configuration/installation/registration state; no daemon probe |
| `doctor --live` | Probe installed profile state; does not start it or certify authentication/inference |
| `tools --agent codex --live` | Perform actual MCP initialize/tools-list; no tool calls or daemon startup |
| `start --apply` | Start/reuse the already installed, approved shared profile |
| `stop --apply` | Stop that shared profile without deleting data |
| `disable --apply` | Disable this repository bank, retaining hooks/configuration/data |
| `disconnect --client codex --apply` | Remove only the owned client MCP registration; keep native hooks/data |
| `recall --query TEXT` / `reflect --query TEXT` | Preview query processing; `--apply` performs the bounded, bank-scoped query |
| `seed --file PATH` | Preview committed-source import; transmission requires `--apply --plan HASH` |
| `pr-context --pr NUMBER` | Read canonical GitHub PR metadata through authenticated `gh`, never ingest or publish |

Receipts are JSON; `--json` keeps failures machine-readable on stdout, except the MCP launcher always reserves stdout for protocol. Duplicate/unknown/misplaced options are refused. Dry-run cannot coexist with apply or live/MCP execution. There is no automatic destructive reset, database purge, global uninstall or implicit `all` agent target.

Configure a different provider only after stopping the profile. A running profile causes `PROFILE_RUNNING`, avoiding a UI claim that a provider changed while the old daemon still serves requests. The non-secret provider file is shared across banks using this profile. Explicit keyless modes clear inherited key/gateway settings in the Python process and set per-operation provider choices, rather than falling back to a paid API because a desktop inherited unrelated environment variables. `environment` intentionally retains upstream profile/environment precedence.

For existing PR #30 installations, stop the profile, preview/apply `configure`, then preview/apply `connect` for your clients. There is no need to reinstall unchanged dependencies just to register the reviewed launcher. Re-enable a disabled bank through a reviewed setup/install with the desired Git/session choices; it is not silently enabled by `start` or `connect`.

Useful diagnosis order: inspect `doctor`; run `doctor --live`; warm with `start --apply` if stopped; run `tools --agent codex --live`; restart the app; verify a synthetic fact with actual recall/reflection. `codexAuthFilePresent` reports existence only, not token validity. A healthy API can coexist with expired authentication. MCP tool discovery proves registration/protocol behavior, not a successful model call.

## No-LLM mode and tool limitations

`--provider none` makes storage and the CLI `recall` path available without a generative model, API key or account. It still needs upstream local embeddings/reranking. `reflect` fails explicitly with `REFLECT_REQUIRES_LLM`. The pinned official MCP surface provides knowledge-page search/read/list, reflection, capture/import and diagnostics, **not a raw recall tool**. Therefore none mode does not provide the complete page/reflection experience in a chat-only MCP client. A coding agent with terminal access can use `node bin/app memory recall --query ... --apply`; choose an account-backed or local generative provider for the full official MCP experience. No reflection is faked or delegated secretly to the desktop conversation.

## Privacy, sharing and recovery

Defaults remain opt-in-only, commit messages (initial cap 100), no transcript retention, no codebase survey, manual knowledge-page refresh and no automatic package updates. `--git none|message|full` and `--sessions` are deliberate choices with processing approval. Commit messages can contain confidential data. Full history can expose content later deleted. Even with retention off, current recall prompts can be processed by the selected provider. No old conversation-history import is invoked.

All user config, runtime, provider settings and snapshots stay under the user home. Upstream manages the profile/database, commonly under `~/.pg0/instances/hindsight-embed-obsidian-shell/`; verify its actual installed paths before backup/deletion. Loopback is not authentication and bank names are not ACLs. Use a trusted local user account, not a shared production endpoint. Canonical repository hashing separates forks/owners; clones/worktrees of the same origin can share a local bank. Prefix mappings include descendants/worktree inheritance; do not opt in a parent containing unrelated projects.

Installation is recoverable, not globally transactional: failure can leave packages, a profile, backups or partial native hooks. The bank stays disabled during the native installer, but a later desktop-connection conflict can occur after package installation/bank activation succeeded. Resolve that specific connection using `connect`; do not delete unrelated settings or repeat operations blindly. `CONFIG_CHANGED`, `MCP_CONFLICT`, `LAUNCHER_CHANGED` and `PLAN_CHANGED` require inspection/review. `BUSY` means verify no helper is active before removing a stale operation lock. Raw subprocess/provider errors are withheld; diagnose locally and do not post private logs.

Disable/restart before broad official agent uninstallation. Per-agent official uninstall affects that user integration across repositories, not just this checkout. Stop is shared across every opted-in bank on the profile. Neither command promises to cancel already in-flight provider calls or independent server jobs.

Durable shared knowledge remains reviewed Markdown under `docs/memory/decisions/`; databases, transcripts and credentials never belong in Git. Seed reads exact regular HEAD blobs, not dirty worktree text, with source hashes and stable IDs. Removed/renamed documents are not automatically purged: explicitly supersede/retire them. Retrieved memories and PR text are data, not instructions, approvals or test evidence.

## Architecture and qualification

`policy.ts`/`provider.ts` define consent and non-secret contracts; `install.ts` coordinates injected ports; `io.ts`/`sources.ts` handle bounded local/Git access; `desktop.ts`/`launcher.ts` plan native configuration and reviewed snapshots; `mcp.ts` delegates the official transport; `embedded.py` adapts the public Python SDK. The source launcher provides a central memory namespace, not a new typed framework-protocol operation. Full release-archive/native qualification remains separate.

[Git/GitHub rationale](HINDSIGHT-GIT-GITHUB.md) · [Keyless desktop research](HINDSIGHT-DESKTOP-RESEARCH.md) · [Actual tests and live acceptance gaps](HINDSIGHT-VERIFICATION.md).
