# Keyless desktop integration research

Reviewed 2026-09-27. Complements [the Git/GitHub operating model](HINDSIGHT-GIT-GITHUB.md).


The initial integration required generic LLM environment settings and exposed a separate npm command. The follow-up makes inference selection explicit without requiring an API key, adds the `shell.mjs memory` namespace, and connects the official tools through native desktop configuration. Provider choice is shared non-secret user configuration; project opt-in and Git-backed decision review remain separate boundaries.

The desktop agent and the memory inference provider are different roles. A desktop MCP connection is not an API adapter for the model serving that chat. Hindsight documents `openai-codex` and `claude-code` account-backed providers and local Ollama/LM Studio providers. It also documents `none` for chunks/search without an LLM. The latter cannot supply generated reflection or synthesized pages. This implementation reports those capability limits rather than hiding an API-key requirement behind a dummy credential. [7][8]

Account authentication is a prerequisite, not something the repo may extract. The Codex provider expects accessible file-backed credentials and supports a dedicated `CODEX_HOME` to avoid refresh-token contention with interactive clients. The helper persists only an optional auth-home path and delegates authentication to upstream. Claude uses the official Agent SDK path documented by Hindsight; the personal-use/account restrictions are not waived by this integration. Existing desktop sign-in is not asserted sufficient for either service. Local providers need an explicitly chosen, already available model. [7]

For local coding sessions, native client configuration is preferable to an additional repository-owned MCP implementation. Claude's Code tab shares CLI MCP configuration; Codex's desktop/CLI surfaces share its TOML configuration. We preserve existing settings, register the official package behind an opt-in launcher, and offer actual initialize/tools-list discovery. The plain Claude chat surface receives a fixed project root under a repository-specific server name instead of guessing its working directory. [9][10]

A registered command that directly executes the current checkout is a trust problem: changing a branch could change code run automatically on the next desktop startup. Connections therefore stage a content-fingerprinted snapshot of reviewed launcher sources outside Git. Source changes require an explicit reconnect; the preview hash incorporates the new launcher identity. This is a controlled-update boundary, not protection against a local user who can modify their own executable files. Existing snapshots and memories are not silently purged.

Startup and diagnosis are deliberately separate. Status reads configuration, live doctor probes the profile without starting it, tools discovery invokes no tools, and an opted-in MCP startup can reuse/start the installed Python profile. None claims that authentication or a model call succeeded. A healthy database can coexist with failed inference. A first cold start can exceed the host's startup timeout; warm-up and restart are documented instead of reporting a fictitious seamless installation.

The existing archive job exposed a registry integration defect: `tests/hindsight` had not been declared in `tests/suites.json`. The follow-up adds its root and two named suites without removing any prior suite and checks the registry in the memory workflow. Tests now exercise real Git, disposable Python venvs, CLI subprocesses and a stdio MCP handshake with explicitly substituted external SDK/server fixtures. This establishes local orchestration and refusal behavior, not real provider or desktop-client acceptance.

[7] Hindsight provider/authentication/model guidance: https://hindsight.vectorize.io/developer/models

[8] Hindsight no-LLM and per-operation configuration: https://hindsight.vectorize.io/developer/configuration

[9] Claude local desktop/CLI configuration sharing and precedence: https://code.claude.com/docs/en/desktop

[10] Codex MCP configuration and client sharing: https://developers.openai.com/codex/mcp
