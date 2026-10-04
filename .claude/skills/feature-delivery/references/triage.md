# Feature delivery: triage CI honestly

A red check is information about the change until proven otherwise.

1. **Find the failing job.** Read the check runs of the head commit. "CI result" only aggregates: open the job it names (`CI gate jobs did not succeed: <job>=failure`).
2. **Read the evidence.** The job log's failing step and its uploaded artifact (`reports/` evidence, verify `summary.md`, coverage or e2e reports). For a verify failure, `reports/verify/summary.md` lists the failing step and its output tail.
3. **Reproduce locally.** `node bin/app ci --job <workflow>/<job>` prints the exact commands; a computed matrix needs `--matrix os=ubuntu-24.04`. Run the failing command itself, or the narrower suite (`node scripts/testing/suites.mjs <suite>`). Windows and macOS legs can only be inspected here; say so.
4. **Fix the cause** in the change and push. Rerun the narrowest local gate first.
5. **Report what you saw.** Paste the failing output and the fix into the pull request conversation or body.

## Never

- Call a failing test a flake without a rerun of the same commit that passed and a stated reason.
- Weaken a threshold, add `.skip`/`.only`, delete or narrow a test, add a lint/type/coverage/analyzer suppression, raise a timeout to hide slowness, or edit a workflow, `tests/suites.json` or `configs/quality/**` to get green. Those need an owner decision recorded in the pull request.
- Accept a screenshot baseline or mark a gate passed that did not run.

## Outside the change

A runner outage, an upstream registry error in the informational live audit, or a provisioning failure is outside the change. Say so with the output and ask the user before rerunning (`mcp__github__actions_run_trigger` with `rerun_failed_jobs`, or `gh run rerun <run-id> --failed`). The informational "Security audit" job does not fail "CI result".

## Release pull requests

A `release/*` pull request shows a deliberately failing "CI result" until the Release workflow reports. That is not a failure to fix here; it belongs to the `release` skill.
