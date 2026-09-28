# Optional integrations and separate entry points

## Keep opt-ins separate from the default project

An optional capability must not silently install packages, start services, change desktop-client configuration or grant data-processing consent. Inspect the installed capability before opting in. This handbook does not invent commands for work that has not landed in the reviewed source.

Storybook generation/runtime and Airship compatibility are separate evolving requirements. Their exact setup and generation flags must come from the branch or release that implements them. They are not treated here as mandatory dependencies or as already-present flags in the inspected framework command catalog.

## Hindsight project memory

Memory uses a separate dispatcher and approval protocol. Start with its own help and provider discovery:

```sh
node shell.mjs memory --help
node shell.mjs memory providers
node shell.mjs memory status
```

The equivalent npm entry, when present, is `npm run memory -- <command>`. Its output is not the shared framework command-result envelope. Do not reuse framework `--apply HASH`, `--yes`, profile names or result-status parsing without checking the memory interface.

A setup preview for a no-model configuration is:

```sh
node shell.mjs memory setup --agents codex --provider none
```

Read the package, hook, provider and desktop-connection changes. Setup application requires both `--apply` and `--accept-data-processing`. Setup installs and connects selected supported clients; `install` and `connect` are also separate operations. Do not run the application step merely to read this manual.

The reviewed memory interface provides provider selection/configuration; install/setup; status/doctor; start/stop/disable; connect/disconnect; tools/MCP discovery; recall/reflect; committed-document seeding; and pull-request context. Use `memory --help` for exact per-command arguments. This separate surface is intentionally not included in the shared-catalog command count.

## Operational safeguards

`memory doctor` avoids a daemon probe unless `--live` is requested. `memory tools --agent codex --live` performs live MCP discovery, not arbitrary tool execution. A keyless provider does not imply offline operation, free unlimited inference or no account prerequisites. Provider `none` does not provide reflection/synthesis.

Seed only reviewed, eligible committed documents. The seed preview returns a plan hash; application uses `memory seed ... --apply --plan HASH`, distinct from the framework planner. Review data before retention. Never put tokens or credentials in command arguments or repository files.

Stopping the shared memory profile can affect other opted-in projects. Disable preserves data and requires client restart to take full effect; it is not a deletion request. Desktop MCP services are local to the machine: a cloud coding session does not gain access to them merely because the project contains configuration. Native client permissions and trust prompts remain under the user's control.

Consult the repository's `HINDSIGHT.md` for provider/platform prerequisites and the complete optional-memory lifecycle. This manual generation never installs Hindsight, starts its service or executes its commands.
