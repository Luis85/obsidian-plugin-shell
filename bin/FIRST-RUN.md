# Optional first run: install, build and showcase

After source generation has been approved, Angular project setup offers a second,
independent choice:

- **Skip** (default): retain the generated source without installing or running it.
- **Verify**: install dependencies, type-check, test and build.
- **Showcase**: run the same checks, then serve the built application locally.

Showcase additionally asks whether to open the default browser and which local
port to use. A second review shows the working directory, exact npm arguments,
package scripts, side effects and execution plan hash. Approving file generation
never approves package execution. The first-run choice is offered only after
boilerplate was created; it can also be started later from the studio or CLI.

```sh
# From the project root, with the CLI kit kept intact:
node tools/shell-cli/shell.mjs project-setup --root .
node tools/shell-cli/shell.mjs first-run
node tools/shell-cli/shell.mjs first-run status --json
```

## What is executed

The runner uses the configured `paths.app` directory and the project's exact
`.nvmrc` and `packageManager` versions. A mismatch is shown before any npm process
starts. It resolves the installed npm CLI, not an implicit global installation.

The sequence is `npm install` or `npm ci`, `npm run typecheck`, `npm run test`, and
`npm run build`. Each process uses argument arrays, an explicit application prefix,
`--workspaces=false`, and a timeout. Dependency installation includes development
dependencies and inherits existing npm lifecycle-script policy; it does not bypass
script approval, force peers, upgrade packages or fall back after a failure.

In `auto` mode an absent or generated root-only dependency lock selects `install`.
An already resolved lock selects `ci`; a mismatching resolved lock fails instead
of being silently repaired. The execution review explains that install can update
the lock and that ci replaces node_modules. Commit a reviewed, resolved lock before
using ci elsewhere. npm's official contracts describe these differences:
<https://docs.npmjs.com/cli/v11/commands/npm-ci/> and
<https://docs.npmjs.com/cli/v11/commands/npm-install/>.

Package lifecycle and application scripts execute with normal user permissions,
not in a sandbox. Existing user/global npm configuration and credentials remain
in effect. npm caches and other external effects are not rolled back. Source,
local configuration, package/lock inputs and the selected npm entry are fingerprinted;
changed inputs require a new review. Only the install step may change the dependency
lock without a new approval, and its new hash is tracked for subsequent stages.
Do not edit source or tool configuration during a run.

## Showcase and shutdown

The first-run showcase is a shell-owned static server for the completed
`dist/webapp` or `dist/website` output. It does not execute another build, serve the
project source directory, expose .env files, listen on the public network or launch
an Obsidian instance. It binds only `127.0.0.1` and refuses an occupied port.

The server loads a bounded snapshot of built assets, verifies its own HTTP 200
response with an instance token, and only then requests the browser opening. A
browser-launch failure retains the working URL for manual opening. The readiness
check proves that the built index can be served; it does not prove that Angular
bootstrapped in the browser or that business requirements passed acceptance.

Progress and `SHOWCASE_READY http://127.0.0.1:<port>/` are emitted on stderr. The
CLI remains attached while the preview is open, with no detached daemon. The
default showcase duration is five minutes. Ctrl+C closes a ready showcase cleanly;
Ctrl+C during install/check/build cancels that stage. Expiry, failure and shutdown
close the owned HTTP server and connections. On return, the browser tab may remain
open, but its localhost server has stopped. This is a showcase, not hot reload.
Use the generated app's npm start command for a later standalone preview.

## Settings

Existing version-1 settings files remain valid. Missing new fields receive defaults;
no read silently writes an upgraded file. `configs/user-settings.json` now also
supports:

```json
{
  "schemaVersion": 1,
  "paths": { "firstRunReport": "reports/first-run.json" },
  "preferences": {
    "firstRun": {
      "install": "auto",
      "port": 4173,
      "openBrowser": false,
      "stepTimeoutMs": 600000,
      "readyTimeoutMs": 30000,
      "showcaseDurationMs": 300000
    }
  }
}
```

This is a partial settings request for the existing reviewed `settings --input`
command, not permission to execute. The JSON settings schema exposes all these
values. First-run request overrides apply to that invocation only. No persistent
preference can change the wizard's default from Skip or bypass execution approval.
The report path must be contained, non-overlapping and end in .json.

## Agents

There is no interactive-only execution path. Agents first apply the setup's file
plan, then prepare and separately approve a first-run execution plan:

```sh
node tools/shell-cli/shell.mjs first-run schema --json
node tools/shell-cli/shell.mjs first-run --input first-run.json --json
# Inspect data.package, data.review, data.blockers, data.steps and data.planHash.
node tools/shell-cli/shell.mjs first-run --input first-run.json --json --apply "$PLAN_HASH"
node tools/shell-cli/shell.mjs first-run status --json
```

[Example request](examples/first-run.json): choose mode `verify` for build-only
validation or `showcase` for a bounded server session. Browser opening defaults to
false. No --yes shortcut is supported. CI/JSON mode never prompts or assumes a
human approved scripts. An agent host owns any required user-consent policy.

Stdout contains one versioned JSON envelope, emitted after the requested operation
finishes. Progress and the ready URL use stderr while the showcase is alive. An
agent can request a shorter `showcaseDurationMs` or signal the foreground process
to stop; there is no detached-process/PID control protocol. Exit codes are 0 for a
successful proposal/run, 1 for failure and 130 for cancellation before a ready
showcase. A planned result is not evidence of execution.

## Failure and recovery

The report records stages, timings, failure code, installed/built flags, resolved
lock hash, preview readiness/browser-dispatch/shutdown and whether manual acceptance
was performed (always `not-verified` for this runner). It is updated as work proceeds.
`first-run status` exposes the last recorded result, not a live readiness guarantee.

The pipeline stops at the first failed stage; remaining stages are marked not-run.
Generated source and completed external effects are preserved. Inspect stderr and
the report, correct the failure, and prepare a new execution plan. There is no
automatic retry with a previous approval token. Unknown, corrupt or concurrently
changed reports are not overwritten.

A project-local `.shell-first-run.lock` prevents overlapping first runs and maker
file writes. A crashed process may leave this lock and a running report behind.
Verify that the old process has stopped and inspect its effects before manually
removing a stale lock; the CLI never steals it or kills a PID read from disk.
POSIX execution cancellation targets the child process group; Windows requests
termination of the owned child tree with taskkill. Arbitrary external scripts are
not transactional or universally contained by this coordination mechanism.

The validation record is in
[docs/testing/FIRST-RUN.md](../docs/testing/FIRST-RUN.md).
