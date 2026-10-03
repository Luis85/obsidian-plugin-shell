---
name: debug-in-obsidian
description: Reproduce and fix a plugin problem inside a real, contained Obsidian sandbox (reload, read errors, screenshot, console and debug log). Use when the plugin misbehaves in Obsidian, fails to load, shows an error notice, or a UI change must be checked in the real app.
---

# Debug in real Obsidian

The loop is: reload → errors → screenshot → console/log → fix → repeat.

1. Run one iteration (build with inline source maps, launch the contained sandbox
   vault, reload the plugin, collect evidence):
   `npm run -s dev:obsidian -- --json`
   - Exit 2 with "not provisioned": downloads are denied to agents. Ask the user to
     run `npm run dev:obsidian -- --allow-download` once (it downloads the pinned
     Obsidian into `.native-cache/`), then continue.
   - `NATIVE_SOCKET_PATH_TOO_LONG`: the project path is too long on Linux; tell the user.
2. Read the JSON summary: `status`, `plugin.loaded`/`plugin.enabled`, `errors[]`
   (`text`, `count`, `frames` already mapped to `src/...:line:column`),
   `pluginConsole`, `commands`, `view` (the plugin view opened for the screenshot).
   A run where Obsidian exits or crashes reports `status: "failed"` with `error`.
3. Look at the screenshot in `files.screenshot` (`.obsidian-sandbox/logs/last-run.png`)
   when the problem is visual.
4. For more context read `.obsidian-sandbox/logs/dev.log` (all console output) and
   `.obsidian-sandbox/logs/debug-report.json` (structured debug records).
5. Reproduce the failure as a test first when possible (in-memory kit test in the
   product tests, or a `tests/obsidian/*.obsidian.ts` spec).
6. Fix, then repeat step 1 until `"status": "passed"` with no `errors`. Finish with
   `npm run check`.

Only the sandbox vault in `.obsidian-sandbox/vault` is used; it persists between
runs. Never open or modify a personal vault. The user can attach a debugger while
`npm run dev:obsidian` runs (VS Code "Attach to Obsidian", port 9222).
