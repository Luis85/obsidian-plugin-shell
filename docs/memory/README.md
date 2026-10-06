# Reviewed, Git-backed project knowledge

> Type: how-to guide · Part of the [docs index](../README.md)

This folder is **not an auto-ingestion trigger**. Adding a file, cloning the repo or opening an agent must not opt a contributor in. It is an optional, reviewable bridge from durable project decisions to a local Hindsight bank.

Create lowercase Markdown files under `decisions/`. Keep each focused on one durable decision and below 64 KiB. Include status (proposed/accepted/superseded), context, decision/rationale, alternatives, affected contracts, source PR/commit and actual verification. Never claim acceptance merely because the record exists on a branch. Do not include raw conversations, customer information, credentials or output from private diagnostics.

After normal review and commit, inspect the **committed** text and preview an import:

```sh
git show HEAD:docs/memory/decisions/project-memory.md
npm run memory -- seed --file docs/memory/decisions/project-memory.md
```

Then use the returned hash, with the same explicit file selection:

```sh
npm run memory -- seed --file docs/memory/decisions/project-memory.md --apply --plan <reviewed-plan-hash>
```

Replace the placeholder with the actual hash; do not include angle brackets. The helper reads HEAD blobs, not dirty files. Changing HEAD changes the plan and requires review again. This command can call the configured LLM provider and is refused unless the repository has been enabled locally. No automatic seed occurs during installation; the coding agent's separately disclosed Git-message ingestion is its own behavior.

Stable path-based document IDs preserve source identity on updates. For a renamed/deleted/superseded decision, explicitly retire the old knowledge through a reviewed record or upstream deletion; this tool does not silently erase memory. Memory may be stale or inaccurate: repository instructions, reviewed source and executed tests remain authoritative.
