# Real-Obsidian dev loop and E2E tests

Two commands run the built plugin inside a real Obsidian desktop app. Both use
only contained vaults inside this checkout; they never open a personal vault.

| Command | Purpose |
| --- | --- |
| `npm run dev:obsidian` | Build, watch, hot-reload and stream logs from a persistent sandbox vault |
| `npm run -s dev:obsidian -- --json` | One agent/CI iteration: build, launch, reload once, JSON summary, exit |
| `npm run test:obsidian` | Vitest suite in `tests/obsidian/**/*.obsidian.ts`, a fresh vault copy per case |

## Prerequisites

- The pinned Node/npm toolchain and `npm ci`.
- A display. On Linux without `DISPLAY`/`WAYLAND_DISPLAY`, both commands start
  a private `Xvfb` server themselves (install the `xvfb` package). macOS and
  Windows use the desktop session.
- A one-time, explicit download opt-in. Pass `--allow-download` or set
  `OBSIDIAN_ALLOW_DOWNLOAD=1`. This installs `obsidian-launcher@3.2.1` into
  `.native-runner/` (never globally, never into the project lockfile) and
  downloads Obsidian into `.native-cache/`. Without the opt-in and a complete
  cache, the commands exit with code 2 and download nothing. `OBSIDIAN_VERSION`
  selects the host version (default `1.13.7`, the manifest floor).
- Linux only: Chromium's singleton socket path must fit into 107 bytes. The
  commands refuse checkouts whose path is too long before building. Use a
  shorter checkout path if you see `NATIVE_SOCKET_PATH_TOO_LONG`.

## Inner loop: `dev:obsidian`

The first run copies `tests/obsidian/vault` to `.obsidian-sandbox/vault`. Later
runs reuse it unchanged, so notes, settings and plugin `data.json` persist. Delete
`.obsidian-sandbox/` to start over. The plugin is installed and enabled in that
vault only.

Each build goes to `.obsidian-sandbox/build/` with **inline source maps**. The
release build in `dist/` is unchanged (no source maps, same bytes). On every
successful rebuild the assets are installed atomically, and the plugin is
hot-reloaded over the DevTools protocol. The loop disables the plugin, re-reads
its manifest and enables it again. A status line reports build, reload and total
time. A failed build keeps the last good build installed. Ctrl-C or SIGTERM
closes Obsidian and the watcher and removes the per-run profile under `.nq/`.

Options: `--port <n>` (default 9222, or `OBSIDIAN_DEBUG_PORT`), `--logs plugin|all`,
`--sandbox <.name>`, `--settle <ms>`, `--no-debug-logging`, `--once`/`--headless`,
`--json`. Run `npm run dev:obsidian -- --help` for details.

### Attaching a debugger

Obsidian listens on `127.0.0.1:9222`, and the same port serves every client:

- Chrome/Edge: open `chrome://inspect`, choose *Configure…*, add
  `localhost:9222`, then *inspect*. Sources show `src/**` through the inline maps.
- VS Code: `{"type": "chrome", "request": "attach", "name": "Obsidian sandbox", "port": 9222, "webRoot": "${workspaceFolder}"}`.
- Playwright or DevTools-protocol tools: `chromium.connectOverCDP('http://127.0.0.1:9222')`.

### Reading logs

Console output and uncaught errors from every Obsidian window are appended to
`.obsidian-sandbox/logs/dev.log`. Unhandled promise rejections count as
uncaught errors. The terminal shows plugin-attributed lines plus every error;
`--logs all` shows host output too. Attribution uses Obsidian's `plugin:<id>`
script URL. Stack frames are translated to `src/...:line:column`
through the inline source map. Output that DevTools replays when the loop
attaches (the startup load) is included.

The shell's structured logger has no console or file sink, and its debug level
is runtime-only by design ([logging design](../development/LOGGING-AND-DEBUGGING.md)).
After every load the loop runs the plugin's own `debug-toggle` command when it
exists, so debug records are collected for that session. `--no-debug-logging`
turns this off. In `--json` mode it also runs `debug-report` and saves the
redacted JSON to `.obsidian-sandbox/logs/debug-report.json`.

### Agent/CI mode: `--json`

`npm run -s dev:obsidian -- --json` writes exactly one JSON document to stdout.
Status and build output go to stderr. The exit code is non-zero when the plugin
does not load or reports errors. The summary contains:

- `status`, the plugin and Obsidian versions, and timings (`buildMs`, `reloadMs`);
- deduplicated `errors` with counts and source-mapped `frames`;
- plugin `pluginConsole` lines and the registered command ids;
- the paths of `last-run.png`, `dev.log` and `debug-report.json`.

The same summary is saved as `.obsidian-sandbox/logs/last-run.json`. Use `-s` so
npm does not print its own banner on stdout.

Obsidian 1.12 and later also ship an official CLI (`obsidian plugin:reload`,
`dev:errors`, `dev:console`, `dev:screenshot`) for your own running app. This
repository does not depend on it: it needs a running, single app instance, and
its use against launcher sandboxes is unverified.

## Writing a real-Obsidian test

Create `tests/obsidian/<behavior>.obsidian.ts` and use the fixture:

```ts
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('my feature in real Obsidian', () => {
  test('creates a note from the command', async ({ obsidian }) => {
    await obsidian.runCommand('create-note'); // short id = `${pluginId}:create-note`
    const exists = await obsidian.waitFor(({ app }) => app.vault.getAbstractFileByPath('New.md') !== null);
    expect(exists).toBe(true);
    expect(obsidian.errors()).toEqual([]);
  });
});
```

Each case gets a new Obsidian process, a new profile and a fresh copy of
`tests/obsidian/vault` under `.nq/`. The built plugin is installed there and
enabled after the console recorder attaches, so its whole `onload` is observed.
The fixture provides these members:

- `page`: Playwright, main window.
- `eval(fn, args)`: runs `fn({ app, plugin, pluginId }, args)` inside Obsidian.
  The function cannot capture test variables, so pass JSON-serializable `args`.
- `runCommand(id)`, `openView(type)` and `waitFor(fn)`.
- `pluginViewTypes`: views that this plugin registered.
- `errors()`, `pluginLogs()` and `consoleEntries()`.
- `reloadPlugin()`, `disablePlugin()` and `enablePlugin()`.
- `screenshot(name)`, `manifest` and `vaultPath`.

Cases run serially with no retries. Use `expect.poll` or `waitFor`, never sleeps
for readiness.

Evidence goes to `reports/obsidian/`: Vitest `vitest-results.json` and `junit.xml`,
plus one folder per case in `cases/<file>--<test>/`. Each folder holds
`environment.json` (requested/resolved app, installer and launcher versions,
platform, commit, plugin identity), `console.log`, `final.png`/`final.html`, and
`teardown.json` (outcome, duration, cleanup errors). Session teardown always
stops the host and removes the copied vault, and it keeps a test failure visible
when cleanup also fails. Set `OBSIDIAN_KEEP_SCRATCH=1` to keep the copy for
inspection. Filters pass through to Vitest:
`npm run test:obsidian -- plugin-load -t loads`. `--no-build` reuses `dist/`.

The four starter specs work for any plugin built from this shell and read
`manifest.json` for the id. They check the following:

- The plugin loads without uncaught or plugin errors.
- Every available command is listed in the palette.
- Every registered view renders.
- Disabling the plugin removes its commands, views and DOM. Obsidian keeps the
  leaves as placeholders, and re-enabling restores the same leaves.

## CI

`.github/workflows/obsidian-e2e.yml` installs the Electron system libraries,
restores `.native-cache` with `actions/cache` (key: OS, app version and launcher
version), and runs `test:obsidian` with `OBSIDIAN_ALLOW_DOWNLOAD=1`. It also runs
one `dev:obsidian --json` iteration. It uploads `reports/obsidian/` and
`.obsidian-sandbox/logs/` even when earlier steps fail.

## What this proves and what it does not

It proves that the built `main.js`/`styles.css`/`manifest.json` load, register and
unload in the named Obsidian desktop version on this OS with a synthetic vault.
It covers host APIs, real DOM and real plugin lifecycle.

It does not prove the following:

- other Obsidian versions, mobile or other operating systems;
- behaviour with personal vaults, third-party plugins or themes;
- performance budgets;
- the separate qualification protocol in `npm run test:native`, whose evidence
  and acceptance rules are unchanged.

Host internals used by the harness (`app.plugins`, `app.commands`,
`app.viewRegistry`, the `plugin:<id>` script URL, the eval wrapper offset) are not
public API. Re-check them when you change the pinned host version.
