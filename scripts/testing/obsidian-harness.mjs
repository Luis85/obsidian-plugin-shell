/** The typed surface the real-Obsidian Vitest fixture consumes (see obsidian-harness.d.mts). */
export { provisionHost, requestedAppVersion } from './obsidian-host.mjs';
export { createObsidianSession, withSession, closeOnAbort } from './obsidian-session.mjs';
export { createConsoleRecorder, formatEntry, loadErrors } from './obsidian-console.mjs';
export { enablePlugin, disablePlugin, reloadPlugin, executeCommand } from './obsidian-plugin-control.mjs';
