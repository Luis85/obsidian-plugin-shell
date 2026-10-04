> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Optional integrations and separate entry points

## Keep opt-ins separate from the default project

An optional capability must not silently install packages, start services, change desktop-client configuration or grant data-processing consent. Inspect the installed capability before opting in. This handbook does not invent commands for work that has not landed in the reviewed source.

Storybook and Airship are independent opt-in development integrations. Their commands are listed by `node bin/app help --all`; neither is a mandatory dependency of generated plugins. Storybook generation is controlled separately from its tooling workspace, as described below. Consult `docs/framework/tooling/AIRSHIP.md` for the separate Airship enable, install and launch workflow.

## Hindsight project memory

Memory uses a separate dispatcher and approval protocol. Start with its own help and provider discovery:

```sh
node bin/app memory --help
node bin/app memory providers
node bin/app memory status
```

The equivalent npm entry, when present, is `npm run memory -- <command>`. Its output is not the shared framework command-result envelope. Do not reuse framework `--apply HASH`, `--yes`, profile names or result-status parsing without checking the memory interface.

A setup preview for a no-model configuration is:

```sh
node bin/app memory setup --agents codex --provider none
```

Read the package, hook, provider and desktop-connection changes. Setup application requires both `--apply` and `--accept-data-processing`. Setup installs and connects selected supported clients; `install` and `connect` are also separate operations. Do not run the application step merely to read this manual.

The reviewed memory interface provides provider selection/configuration; install/setup; status/doctor; start/stop/disable; connect/disconnect; tools/MCP discovery; recall/reflect; committed-document seeding; and pull-request context. Use `memory --help` for exact per-command arguments. This separate surface is intentionally not included in the shared-catalog command count.

## Operational safeguards

`memory doctor` avoids a daemon probe unless `--live` is requested. `memory tools --agent codex --live` performs live MCP discovery, not arbitrary tool execution. A keyless provider does not imply offline operation, free unlimited inference or no account prerequisites. Provider `none` does not provide reflection/synthesis.

Seed only reviewed, eligible committed documents. The seed preview returns a plan hash; application uses `memory seed ... --apply --plan HASH`, distinct from the framework planner. Review data before retention. Never put tokens or credentials in command arguments or repository files.

Stopping the shared memory profile can affect other opted-in projects. Disable preserves data and requires client restart to take full effect; it is not a deletion request. Desktop MCP services are local to the machine: a cloud coding session does not gain access to them merely because the project contains configuration. Native client permissions and trust prompts remain under the user's control.

Consult the repository's `HINDSIGHT.md` for provider/platform prerequisites and the complete optional-memory lifecycle. This manual generation never installs Hindsight, starts its service or executes its commands.

## Storybook: two independent opt-ins

`tooling.storybook.enabled` emits the isolated development workspace.
`tooling.storybook.generateStories` emits CSF3 stories for the generated Vue pages
and components. Both default to false and neither enables Airship.

```sh
node bin/app new ../folio-tools --from project.json --storybook on --storybook-stories on --yes
cd ../folio-tools
npm ci
node bin/app storybook status --json
node bin/app storybook install --dry-run
node bin/app storybook install --yes
node bin/app storybook check
node bin/app storybook build
node bin/app storybook dev
```

The first optional install creates `storybook/package-lock.json`; review and
commit it. Later optional installs use `npm ci`. Custom stories belong in
`storybook/custom`. Generation does not install or launch anything. Disabling
via reviewed `generate --storybook off` blocks retained launchers without
deleting custom files. See [the full guide](../../development/OPTIONAL-STORYBOOK.md).
