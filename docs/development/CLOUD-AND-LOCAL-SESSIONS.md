# Local and cloud sessions

How a Workbench project, or this framework checkout, goes from "created locally" to "an agent
works in a fresh cloud container" without manual setup. Applies to this framework repository
and to every project generated with `node bin/app new`.

## The path

1. **Create locally.** `node bin/app new <dir> --starter <id> --yes` writes the project and makes one
   initial git commit. `bin/app` and `scripts/agent/cloud-setup.sh` are committed executable.
   `npm ci` then `npm run check` work on the qualified toolchain (`.nvmrc`, `packageManager`).
2. **Push.** Add a remote and push. Everything a session needs is committed: the exact
   `package-lock.json`, `.claude/settings.json` (hooks, allowlist) and the `scripts/agent/*` hooks.
   Personal overrides live in the ignored `.claude/settings.local.json`. `clickdummy.html` is a
   build artifact and is ignored: `npm run test:e2e` and `npm run build:clickdummy` rebuild it.
3. **Open a cloud session.** Claude Code on the web clones the repository into a fresh Linux container
   (`CLAUDE_CODE_REMOTE=true`, system Node 22, a Playwright cache with an older Chromium, outbound
   HTTPS through a proxy, no `node_modules`). The `SessionStart` hook prepares the toolchain.

## What the SessionStart hook does

`scripts/agent/session-start.mjs` prints a status of at most ten lines (it becomes the agent's context),
always exits 0 and never claims a qualification it did not verify. In a cloud session it:

| Step | Behaviour |
| --- | --- |
| Node | Compares Node and npm with `.nvmrc`, `engines` and `packageManager`. Looks for the qualified Node in `/opt/node<major>`, nvm, n, Volta, `SHELL_NODE_BIN` and the Workbench cache. When none exists it downloads the exact `.nvmrc` version from `https://nodejs.org/dist`, verifies its SHA-256 against the official `SHASUMS256.txt` (a mismatch is refused, nothing is extracted), extracts it to `${XDG_CACHE_HOME:-~/.cache}/workbench/node-v<ver>-<platform>-<arch>` and pins npm to the `packageManager` version with `npm install -g` against that private prefix only. Downloads use `curl` (it honours `HTTPS_PROXY` and the CA variables) and fall back to Node's `fetch`. System locations are never touched. |
| PATH | The qualified Node's `bin` is exported through `CLAUDE_ENV_FILE`, so every later shell command and `npm run` uses it. The Stop and post-edit hooks look the same Node up themselves, because hooks do not receive those exports. |
| Dependencies | A missing `node_modules` is restored with `npm ci --ignore-scripts` using that toolchain. |
| Browser | Reports the pinned Chromium, a `SHELL_CHROMIUM` override, a missing browser or a revision mismatch. Cloud caveat below. |

Time: when Node is already qualified and `node_modules` exists the hook only reads files (well under a
second). A cold container downloads about 58 MB of Node (a few seconds) and runs `npm ci` (typically
10 to 120 seconds). The hook budgets itself at 570 s inside Claude Code's 600 s `SessionStart` timeout;
every step is clamped to the remaining time and a step that runs out is reported, not hidden.

Switches (environment variables, also usable in the environment's settings):

| Variable | Effect |
| --- | --- |
| `SHELL_SESSION_START_NODE=0` | Never download Node. `=1` allows it in a local session too. |
| `SHELL_SESSION_START_INSTALL=0` | Never run `npm ci`. `=1` allows it locally. |
| `SHELL_NODE_BIN=<bin dir>` | Use this Node first when it reports the qualified version. |
| `SHELL_NODE_DIST=<url>` | Mirror of `https://nodejs.org/dist` (checksums come from the same mirror). |
| `SHELL_CHROMIUM=<executable>` | Browser override for every Playwright-driven script. |

A local session is read-only by default: it reports and prints hints. Nothing is downloaded or installed
unless you opt in.

## Browser caveat

The cloud image's Chromium is older than the revision the pinned Playwright expects (for example r1194
against r1243). `scripts/testing/browser-executable.mjs` never uses a different revision silently. In a
cloud session the hook exports `SHELL_CHROMIUM=<older chromium>` and says so: **browser evidence from that
session (`npm run test:e2e`, `npm run test:ui-quality`, `npm run ui:gallery`) comes from a non-pinned
Chromium** and is not the qualified revision. Report it that way. To use the pinned revision instead,
run `node node_modules/@playwright/test/cli.js install chromium` (needs network access to the Playwright CDN)
and unset `SHELL_CHROMIUM`. Locally the hook only prints the hint.

## Environment setup script (optional, faster sessions)

Claude Code environments have a **Setup script** (environment settings, then Setup script) that runs when a
new session starts. Point it at the repository's script so the toolchain and `node_modules` are prepared
before the agent starts, and persist per environment where the platform snapshots it:

```sh
sh scripts/agent/cloud-setup.sh
```

If the script runs before the repository is cloned, or from another directory, set `CLAUDE_PROJECT_DIR`
to the checkout. The script delegates to `node scripts/agent/session-start.mjs --provision-only` when Node
18 or newer exists; otherwise it downloads and verifies the qualified Node itself with `curl` (or `wget`),
`tar` and `sha256sum`/`shasum`. It always exits 0 (a failing setup script would stop the session) and prints
what it could not do. The SessionStart hook then finds the cached Node instantly. `SHELL_SESSION_START_NODE=0`
and `SHELL_SESSION_START_INSTALL=0` apply here too.

## Prove it: handoff qualification (framework repository)

```sh
node scripts/testing/qualify-project-handoff.mjs --starter quick-capture --base-node <a Node 22 install>
node scripts/testing/qualify-project-handoff.mjs --target framework --base-node <a Node 22 install>
```

Maintainer tooling of the framework repository (generated projects do not carry it). It generates a project,
`git clone`s it (only committed files exist), audits the clone (lockfile, symlinks,
executable bits, absolute or local-dependency paths, hook scripts, settings, CRLF), replays a cloud
`SessionStart` with only the base Node on `PATH`, applies the hook's `CLAUDE_ENV_FILE` exports, then runs
`npm run -s check`, `node bin/app doctor --json`, `node bin/app ui status --json` and, when a browser is
usable, `npm run -s test:e2e`, and finally checks that the tree is still clean. The output is one JSON summary
with `status` and `durationMs` per step. Exit 0 means every step passed, 1 a failure, 3 that steps could not
run (offline, no usable browser, `--skip-e2e`); anything but 0 is not a pass. The CI job `project-handoff`
in `.github/workflows/project-starter-qualification.yml` runs it on Ubuntu with Node 22 as the only Node.
The Workbench cache of the run is private to it (`--cache-dir` reuses one). This is evidence about the
generated project and the hook, not native Obsidian qualification.

## Hooks and timeouts

The `Stop` hook runs `npm run -s check -- --fast --base HEAD` and the post-edit hook runs Vitest for the
edited file. Both start their command in its own process group: when the time budget (300 s and 120 s)
passes, or the hook itself is terminated, the whole tree is ended (`taskkill /T /F` on Windows), so no
test process outlives the hook. A check that did not finish is reported, never treated as a failure to fix.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Status says `Provisioning failed` | Read the reason after it: proxy or DNS (`curl -fsSI https://nodejs.org/dist/` should work), a checksum mismatch (refused on purpose; retry, or point `SHELL_NODE_DIST` at a trusted mirror), no `tar`/`gzip`, or no time left. Install Node manually (`nvm install <version>`) and continue. |
| `node: not found` or Node 22 in later commands | The env file was not applied (older Claude Code, or `CLAUDE_ENV_FILE` missing). Run the printed `export PATH=...` line. |
| `npm ci` fails or is `older than package-lock.json` | Re-run `npm ci --ignore-scripts` with the qualified Node first on `PATH`. Never `npm install`. |
| Browser `REVISION MISMATCH` locally | By design: run `node node_modules/@playwright/test/cli.js install chromium` or set `SHELL_CHROMIUM`. |
| E2E reports `not-run` | No usable browser; see the `Browser:` line of the session status. |
| Hooks seem slow on the first stop | The first fast check type-checks and lints the project; later runs are incremental. A hook that exceeds its budget reports it and leaves no process behind. |
| Download is blocked by a proxy policy | Do not retry policy denials. Pre-install Node in the environment image or use the setup script from a network-open environment. |

Related: [DEVELOPER-WORKFLOW.md](DEVELOPER-WORKFLOW.md) (the hook reference) and
[AUTHORING-TOOLS.md](AUTHORING-TOOLS.md).
