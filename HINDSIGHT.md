# Optional Hindsight project memory

Use **`node bin/app memory`** or the equivalent **`npm run memory --`** entry. Cloning, opening an agent, normal setup and builds do not install or opt you in. After one explicit setup, local Claude Code/Codex desktop sessions can launch the installed Python profile and use the official Hindsight MCP tools.

```sh
node bin/app memory providers
node bin/app memory setup --agents claude-code,codex --provider openai-codex
```

This is a preview. The account-backed example needs eligible, file-backed Codex authentication accessible to the daemon; merely being signed into a desktop app does not prove that prerequisite. Review it, then repeat with `--apply --accept-data-processing`. No LLM API key is required for that provider. Alternatively select `claude-code`, or `ollama`/`lmstudio` with an explicit local model. Select `none` for storage/search without a generative model; **reflection and synthesized knowledge pages then do not work**.

```sh
node bin/app memory doctor --live
node bin/app memory tools --agent codex --live
```

These inspect the local service and MCP tool discovery, not inference quality or account entitlement. Restart your desktop client after setup and approve its normal trust/tool permissions. Use a **local** project session; cloud sessions cannot reach your workstation's service.

[Setup, providers, desktop connections and recovery](docs/development/HINDSIGHT.md) · [Git/GitHub research](docs/development/HINDSIGHT-GIT-GITHUB.md) · [Executed tests and remaining acceptance](docs/_archive/development/HINDSIGHT-VERIFICATION.md).
