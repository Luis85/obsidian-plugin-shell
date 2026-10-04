# Release: commands per step

Owner and repository: `Luis85` / `obsidian-plugin-shell`. Every row marked **write** needs the user's explicit confirmation in this conversation, each time. Prefer the GitHub MCP tools; `gh` is the fallback.

| Step | Read-only or write | GitHub MCP tool | CLI |
| --- | --- | --- | --- |
| Changelog structure | read-only | — | `node scripts/release/changelog.mjs check` |
| Notes of a version | read-only | — | `node scripts/release/changelog.mjs notes --version X.Y.Z` |
| Preview the cut | read-only | — | `node scripts/release/cut.mjs --version X.Y.Z` |
| Dispatch Release cut | **write** | `mcp__github__actions_run_trigger` (`method: run_workflow`, `workflow_id: release-cut.yml`, `ref: main`, `inputs: {"version": "X.Y.Z"}`) | `gh workflow run release-cut.yml --ref main -f version=X.Y.Z` |
| Find the release pull request | read-only | `mcp__github__list_pull_requests` (head `Luis85:release/X.Y.Z`) | `gh pr list --head release/X.Y.Z` |
| Release runs | read-only | `mcp__github__actions_list` (`list_workflow_runs`, `resource_id: release.yml`, branch `release/X.Y.Z`) | `gh run list --workflow release.yml --branch release/X.Y.Z` |
| Checks on the release head | read-only | `mcp__github__pull_request_read` (`get_check_runs`) | `gh pr checks <number>` |
| Failing job logs | read-only | `mcp__github__get_job_logs` (`run_id`, `failed_only: true`) | `gh run view <run-id> --log-failed` |
| Metadata gate locally | read-only | — | `node scripts/release/branch.mjs verify --version X.Y.Z` (on the release branch) |
| Fix forward | **write** | — | commit on `release/X.Y.Z`, `git push origin release/X.Y.Z` (never force) |
| Rerun a failed run | **write** | `mcp__github__actions_run_trigger` (`rerun_failed_jobs`, `run_id`) | `gh run rerun <run-id> --failed` |
| Preview Publish | read-only | — | `node scripts/release/publish.mjs --version X.Y.Z --repository Luis85/obsidian-plugin-shell` |
| Dispatch Publish | **write** | `mcp__github__actions_run_trigger` (`run_workflow`, `workflow_id: publish.yml`, `ref: main`, `inputs: {"version": "X.Y.Z"}`) | `gh workflow run publish.yml --ref main -f version=X.Y.Z` |
| Verify the tag | read-only | `mcp__github__get_tag` or `mcp__github__list_tags` | `git fetch --tags origin`, `git rev-parse X.Y.Z^{commit}` |
| Verify the release | read-only | `mcp__github__get_release_by_tag` (`tag: X.Y.Z`) | `gh release view X.Y.Z` |
| Verify the merge | read-only | `mcp__github__list_commits` on `main` | `git merge-base --is-ancestor X.Y.Z origin/main` |
| Verify branch deletion | read-only | `mcp__github__list_branches` | `git ls-remote --heads origin release/X.Y.Z` (prints nothing) |

The workflow files are `.github/workflows/release-cut.yml`, `.github/workflows/release.yml` and `.github/workflows/publish.yml`. `node bin/app ci --job release-cut/cut` and `node bin/app ci --job publish/publish` print their commands but refuse `--execute` (secrets, environment, publication).

## Gated locally

`.claude/settings.json` asks before `npm run release*`, `node bin/app release ...` and `node scripts/release/* --execute|--remote`; `npm publish` and `gh release create|upload|delete` stay denied. An approval prompt is not a request: do not route around it, and do not run these unasked: `node scripts/release/cut.mjs --execute`, `--remote` and `node scripts/release/publish.mjs --execute` write to the repository and GitHub and are for the workflows (or the owner) only.
