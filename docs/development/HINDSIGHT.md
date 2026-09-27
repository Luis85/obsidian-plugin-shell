# Hindsight: opt-in developer memory

## Scope and architecture

This is optional repository tooling, not a feature of the Obsidian plugin or companion UI. No Python package, agent hook, service, credential or network call is added to `npm install`, `setup`, `build`, `verify` or the application runtime. The existing npm lock/dependencies are unchanged. The standalone entry is `node --experimental-strip-types scripts/hindsight/cli.ts`; `npm run memory -- …` is its convenience alias. This does not add a `shell.mjs memory` protocol operation or claim release-archive qualification.

`policy.ts` owns pure consent, routing, source validation and plan contracts. `install.ts` coordinates injected process/configuration ports. `io.ts` owns local files and subprocesses; `sources.ts` reads Git and GitHub. `embedded.py` is the narrow JSON boundary to the official Python `HindsightEmbedded` class, with lazy SDK imports. The official coding-agents installer, not a hand-built approximation, merges native agent hooks/MCP/skill registration.

Both Python usage and coding agents connect to one explicitly started **Python embedded profile**, `obsidian-shell`. The coding plugin is configured as **self-hosted at that profile's loopback URL**, not as its separate Node-managed daemon and not Hindsight Cloud. UI startup is disabled. Closing a Python client does not stop the shared profile; stopping it is an explicit command.

## Before installing

Use the repository's qualified Node/npm toolchain (`.nvmrc`, `packageManager`). The command also runs without project dependencies on Node 22.13+, using native type stripping. Optional installation needs Python 3.11+ with venv/pip, Git, npm, and your selected agent CLI already installed. `pr-context` alone additionally needs an authenticated GitHub CLI with read access.

The full Python distribution currently targets Linux, Windows and Apple Silicon macOS. macOS dependencies can require a current Rust toolchain. This helper deliberately refuses the full install on Intel macOS: upstream recommends a separately configured slim deployment with external embedding/reranking services. That deployment is not silently substituted or qualified here. Standard repository development remains usable without Hindsight on every platform.

Pinned direct packages are `hindsight-all==0.10.1`, `hindsight-client==0.10.1`, and `@vectorize-io/hindsight-coding-agents@0.7.0`. Automatic coding-plugin updates are disabled. These are **direct version pins, not a fully resolved cross-platform transitive lock**. pip resolves optional transitive dependencies at installation; npm writes a local runtime package-lock. Review dependency changes before updating the constants; rerun offline tests and a live smoke. Do not apply broad dependency overrides to the plugin runtime to accommodate optional tooling.

## Preview and opt in

From the checkout, preview without writes, package resolution or daemon startup:

```sh
npm run memory -- install --agents claude-code,codex
```

Choose only the agents actually used. Supported helper targets are `claude-code`, `codex`, `cursor-cli`, `copilot-cli`, and `opencode`; there is no implicit `all`. More upstream agents can be integrated in a separately tested change.

Set `HINDSIGHT_API_LLM_PROVIDER` and `HINDSIGHT_API_LLM_MODEL` explicitly in the environment of the terminal running installation. Set the provider's required authentication through your normal secret manager/environment, typically `HINDSIGHT_API_LLM_API_KEY`. For a configured local provider, use its documented base URL and authentication requirements. No model, account or paid provider is chosen for you. Do not place keys in a tracked file, command argument, issue, screenshot or PR.

Then explicitly approve the reviewed choices:

```sh
npm run memory -- install --agents claude-code,codex --apply --accept-data-processing
```

`--python /absolute/path/to/python` selects an interpreter when necessary. The default is `python3` on Unix and `python` on Windows. On Windows use the npm entry so npm's Node-based launcher is available; no shell-quoted `.cmd` execution is used by this helper.

Installation creates an isolated venv and npm runtime under `~/.hindsight/obsidian-shell/`; it does not perform a global npm installation. The official installer also stages its runtime under `~/.hindsight/coding-agents/` and changes selected agents' **user-scope** configuration. Close active agent/MCP sessions before installing or changing policy. Restart them afterwards. For Codex, verify `codex_hooks = true` in its feature configuration and inspect its MCP registration. Existing repository Claude hooks/settings are not edited by this integration.

The helper first writes a disabled bank, invokes the native installer, checks that its memory configuration was preserved, and only then enables the bank. A failed installation can leave downloaded dependencies, a running profile or partially installed user hooks; it does not report success or destructively roll back unrelated user configuration. The bank stays disabled unless an external actor changes the staged configuration. Inspect conflicts before retrying. If a native installer unexpectedly changes configuration, the helper refuses to overwrite that edit.

## Privacy and cost boundaries

Fresh configuration is `optInOnly: true` with only explicit checkout mappings. Existing cloud, broad opt-in, automatic-update, static routing, authenticated-server or conflicting harness configurations are refused rather than silently converted. A custom `HINDSIGHT_CONFIG` must be reconciled first. User config updates preserve unrelated entries, keep private backups and coordinate this helper through an exclusive operation lock. This is not a universal lock against every external editor.

The selected bank starts with commit-message ingestion, **no transcript retention**, **no codebase survey**, an initial Git seed cap of 100 commits, and manual knowledge-page refresh. The following are deliberate broader choices; preview them first and repeat the approval flags when applying:

```sh
npm run memory -- install --agents codex --git none
npm run memory -- install --agents codex --git full --sessions
```

`--git full` allows commit diffs, including source/deleted content in history. `--sessions` allows agent conversation retention; it is not an assurance that transcripts contain no secrets. No retrospective `--import-conversations` operation is invoked by this helper. Commit messages can themselves be confidential. Even with Git and sessions disabled, **recall queries/current prompts can be sent to the configured memory/LLM service**; disabling retention does not mean no prompt processing.

Local database storage does not make the entire system offline. Dependency/model downloads and remote LLM calls can occur, with provider cost and data handling. A local model requires its own setup. Manual refresh reduces unattended synthesis but makes knowledge pages less current; use direct recall/reflect and verify sources. Existing already-created server jobs are not deleted by disabling this client. Loopback is not authentication: other processes with access to your machine may reach the local API. Use trusted single-user machines and review a separate authenticated deployment before sharing a server.

Path mappings use upstream **prefix semantics** and worktree inheritance. Do not approve a directory containing unrelated nested repositories. Main-checkout mappings are recognized from linked worktrees. Separate clones can share a bank by canonical GitHub origin; different owners/forks use distinct banks. Changing a bank policy affects those clones/worktrees using that same local bank. Remote URLs and credentials are not embedded in bank IDs. This is logical isolation, not an access-control boundary.

## Daily use, disable and recovery

```sh
npm run memory -- status
npm run memory -- start --apply
npm run memory -- disable --apply
npm run memory -- stop --apply
```

`status` is a configuration/file-presence check, **not a health probe**; it never starts the server. `start` uses the installed profile and checks its endpoint against approved configuration. A changed endpoint is a conflict, not permission to redirect prompts automatically. `disable` retains data and hooks but disables the repository bank. Restart persistent agents/MCP processes for the change to take full effect. `stop` also works after disable, and stops the **shared** profile for every opted-in project without deleting data. Existing in-flight requests or independent server jobs are not promised to be cancelled.

Inside a fresh selected agent session, inspect `hindsight_diagnose` and `hindsight_sync_status`. Confirm the bank and loopback endpoint, then test a non-sensitive fact across two sessions. An accepted retain is not proof of queryability or correct synthesis. The GitHub runner cannot reach this workstation's loopback service.

Complete user-agent uninstallation is broader than disabling this checkout. After reviewing the impact on all repositories, invoke the installed official `dist/installer.js uninstall <agent>` with Node (path printed in the installation plan). Do not use `uninstall all` casually. No automatic database purge is provided. Profile data is managed by upstream under `~/.pg0/instances/hindsight-embed-obsidian-shell/`; confirm the installed SDK's actual paths before backup or deletion. Configuration/backups, agent transcripts and upstream diagnostic logs may contain sensitive information even though this helper redacts subprocess errors.

Common diagnostics: `CONSENT_REQUIRED` means no install was approved; `CONFIG_CONFLICT`/`BANK_CONFLICT` require manually reconciling existing user settings; `CONFIG_CHANGED` means re-review a concurrent/native-installer edit; `BUSY` requires checking for an active operation before removing a stale lock; `PLAN_CHANGED` requires re-reviewing committed inputs. `PROCESS_FAILED` intentionally omits raw output: use the displayed stage and rerun the documented pip/npm/native-installer command locally to diagnose, without posting raw sensitive logs. A failing retain may be partial; retry only the same reviewed document IDs after resolving the cause.

## Shared Git-backed knowledge

Use [the decision-record workflow](../memory/README.md). `seed` reads only explicitly named, bounded, regular Markdown **Git blobs at HEAD** under `docs/memory/`, never the dirty worktree, a symlink, `.env`, source tree or whole vault. It prints content hashes and a plan hash before allowing transmission. Review the exact committed text with `git show HEAD:path` and re-run with the matching hash. Stable document IDs update the same source on re-import; this is not a guarantee of zero provider cost. Removed or renamed records are not automatically deleted from memory: explicitly retire/supersede them and review any upstream deletion separately.

[Research and GitHub operating model](HINDSIGHT-GIT-GITHUB.md) · [Verification](HINDSIGHT-VERIFICATION.md).
