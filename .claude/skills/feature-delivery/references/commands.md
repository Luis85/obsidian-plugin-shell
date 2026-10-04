# Feature delivery: commands per step

Plan and record pull requests with the Workbench CLI first: the PullRequest documents are the source of truth, and `node bin/app pr publish` and `pr sync` write the platform only through a reviewed preview. For everything the CLI does not do (reading checks, marking ready, labels, merging), prefer the GitHub MCP tools when the session has them; the `gh` CLI is the fallback. Every remote write needs the user's explicit request in this conversation. Owner and repository for this framework: `Luis85` / `obsidian-plugin-shell`.

## Workbench CLI (any hosting platform)

| Step | Command |
| --- | --- |
| Inspect an increment and its pull requests | `node bin/app increment show <slug>`, `node bin/app pr list --increment <slug>`, `node bin/app pr show <pr-id>` |
| Plan a change pull request on the increment branch | `node bin/app pr new <slug> --title "<title>" --delivers AC-1 --switch --dry-run`, then `--apply <planHash>` |
| Plan its tasks and scope | `node bin/app pr task add <pr-id> "<task>"`, `node bin/app pr scope add <pr-id> "<item>"`, `node bin/app pr out-of-scope add <pr-id> "<item>"` |
| Open the draft (remote write) | `node bin/app pr publish <pr-id> --dry-run`, then `--apply <planHash>`; commit the document and its `.workbench/pull-requests/<pr-id>.sync.json` |
| Tick tasks, record a changed decision | `node bin/app pr task set <pr-id> T-<n> --status done`, `node bin/app pr amend <pr-id> "<text>"` |
| Sync with the platform (remote write) | `node bin/app pr sync <pr-id>`, then `--apply <planHash>`; conflicts: `--prefer local\|remote` or `--resolutions '<json>'` chosen by the user |
| Tick a delivered criterion | `node bin/app increment ac set <slug> AC-<n> --status done --evidence <path>` |
| Check readiness or completion | `node bin/app increment check <slug>`, `node bin/app increment check <slug> --gate done --base origin/main` |

Exit code 2 from `pr publish` or `pr sync` means the remote write is uncertain: inspect the pull request, then rerun the same command; never create or edit the pull request by hand to compensate.

## GitHub (this framework repository)

| Step | GitHub MCP tool | `gh` CLI |
| --- | --- | --- |
| Open a draft pull request (fallback to `pr publish`) | `mcp__github__create_pull_request` with `draft: true`, `head: <topic>`, `base: increment/<slug>` (or `main`, or the stacked branch) and a `Handoff: docs/increments/<slug>.md` line | `gh pr create --draft --base increment/<slug> --fill` |
| Read checks | `mcp__github__pull_request_read` with `method: get_check_runs` (or `get_status`) | `gh pr checks <number>` |
| List runs of a workflow | `mcp__github__actions_list` with `method: list_workflow_runs`, `resource_id: ci.yml` and a branch filter | `gh run list --workflow ci.yml --branch <topic>` |
| Read failing logs | `mcp__github__get_job_logs` with `run_id` and `failed_only: true` | `gh run view <run-id> --log-failed` |
| Mark ready | `mcp__github__update_pull_request` with `draft: false` | `gh pr ready <number>` |
| Opt in to end-to-end checks | `mcp__github__issue_write` with `method: update`, the pull request number and `labels` including `e2e` (keep the existing labels) | `gh pr edit <number> --add-label e2e` |
| Back to draft | `mcp__github__update_pull_request` with `draft: true` | `gh pr ready <number> --undo` |
| Retarget a stacked pull request | `mcp__github__update_pull_request` with `base: main` | `gh pr edit <number> --base main` |
| Merge (merge commit) | `mcp__github__merge_pull_request` with `merge_method: merge` and `expectedHeadSha` | `gh pr merge <number> --merge --delete-branch` |

Required checks to read before each transition: "Dev checks" and "Definition of Ready" on a draft; "CI result" and "Definition of Done" (plus the triggered workflows) before merging. The DoR and DoD job summaries carry the report and, when red, the refinement brief or the generated documentation.

`mcp__github__merge_pull_request` with `expectedHeadSha` refuses when someone pushed after the checks you read; use it.

## Local gates per tier

| Tier | Commands |
| --- | --- |
| Before the draft (increment) | `node bin/app increment new <slug> --title "<title>" --dry-run` and `node bin/app increment check <slug>` (owned by the `increment-handoff` skill); fallback `node scripts/delivery/increment.mjs new <slug> --from <source>` and `node scripts/delivery/ready.mjs --handoff docs/increments/<slug>.md` |
| Dev (draft) | `node bin/app check --fast --skip-suites --base origin/main`, `node scripts/testing/suites.mjs --check`, `npm run check:repository`, `node scripts/release/changelog.mjs check`, `npm run check:self-review -- --base origin/main --warn-only`, `node scripts/delivery/ready.mjs --base origin/main` |
| Before ready (Definition of Done) | `node scripts/delivery/done.mjs --base origin/increment/<slug>` for a change, `--base origin/main` for the kick-off; `--write` generates the completion record, the Unreleased entry and docs index rows for review |
| Integration (ready) | `node bin/app check --plan --base origin/main`, `node bin/app check`, `npm run verify -- --json --keep-going`, `npm run check:self-review -- --base origin/main`, `node scripts/testing/suites.mjs <suite>`, `npm run test:e2e` (served UI, provisioned Chromium; opt-in) |
| Reproduce one CI job | `node bin/app ci --list`, `node bin/app ci --job <workflow>/<job>` (dry run), `--matrix os=ubuntu-24.04` for computed matrices |

End-to-end steps in a `node bin/app ci` dry run show as condition-unknown: the opt-in (the `e2e` label or input) is not known locally, so run `npm run test:e2e` or the step's command yourself when you need it. `node bin/app ci --job dev/fast` prints the Dev commands but cannot `--execute` them (it reads `github.base_ref`); run them by hand as listed above. `--execute` asks for approval and replaces `node_modules` when a job runs `npm ci`; use a scratch copy for those.

## Azure DevOps (generated projects that use it)

This framework repository is on GitHub. A generated project may instead keep its code and pipelines in Azure DevOps; follow that project's `AGENTS.md` and pipeline files. The equivalent Azure CLI calls (with the `azure-devops` extension, signed in, and `az devops configure --defaults organization=<url> project=<name>`) are:

| Step | Azure CLI |
| --- | --- |
| Open a draft pull request | `az repos pr create --draft true --source-branch <topic> --target-branch main --title "<title>" --description "<body>"` |
| Mark ready | `az repos pr update --id <id> --draft false` |
| Read pipeline runs | `az pipelines runs list --branch <topic> --top 10`, then `az pipelines runs show --id <run-id>` |
| Opt in to end-to-end stages | `az pipelines run --name <pipeline> --branch <topic> --parameters runE2E=true` (Azure Repos has no pull-request labels) |
| Merge when policies pass | `az repos pr update --id <id> --status completed` (only on the user's explicit request) |

Branch policies (required builds and reviewers) play the role of required checks there. The tier names of this repository apply only when the generated project's pipelines implement them.
