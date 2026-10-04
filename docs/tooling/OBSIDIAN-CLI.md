# Optional Obsidian CLI adapter

> Type: how-to guide · Part of the [docs index](../README.md)

The shell exposes a deliberately narrow adapter over the official Obsidian CLI. It requires Obsidian CLI **1.12.7 or newer** and an explicit `--obsidian-vault <name-or-id>` on every call. It never falls back to whichever vault happens to be active.

## Read-only surface

```sh
node bin/app obsidian status --obsidian-vault "My Vault" --json
node bin/app obsidian files --obsidian-vault "My Vault" --obsidian-folder docs/application --json
node bin/app obsidian read --obsidian-vault "My Vault" --obsidian-path docs/application/project.md --json
node bin/app obsidian prepare --obsidian-vault "My Vault" --json
```

The adapter only invokes the official `version`, `vault`, `files`, `folders`, and `read` commands. File reads are limited to non-hidden vault-relative Markdown paths. It does not expose arbitrary command passthrough.

`obsidian prepare` reads the project's configured application-documentation paths, asks Obsidian for the selected vault's Markdown inventory, and parses only matching files. Supported typed Markdown is reported separately from ordinary or invalid Markdown. The result proposes bounded `docs import ... --dry-run` argument arrays. Import remains the existing shell operation: review its file plan and apply that plan explicitly.

## Interactive setup

Terminal setup asks whether to connect an Obsidian vault before the documentation-import question. Answering yes asks for the vault name or ID, runs `obsidian status` against it, and then asks whether to prepare the vault. Preparing runs `obsidian prepare`, and each proposed batch of supported typed notes becomes its own reviewed `docs import` plan that you approve separately. An unavailable CLI, an unknown vault or a declined prepare only skips this step. The vault name is not stored, and nothing in the vault is written.

## Deliberately excluded

The adapter does not expose Obsidian `eval`, `dev:cdp`, create/append/prepend/move/rename/delete, plugin installation or enablement, or restricted-mode changes. No adapter command installs or enables this project in a personal vault. Existing isolated test-vault installation remains a separate shell feature.

Obsidian itself may start when an official CLI read is invoked if the application is not already running. CLI stderr is not copied into structured results. Vault content is returned only for an explicitly requested Markdown read or processed transiently by `obsidian prepare`.
