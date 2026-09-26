import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { dedupeEntries, formatEntry, loadErrors } from '../testing/obsidian-console.mjs';
import { executeCommand, pluginCommands } from '../testing/obsidian-plugin-control.mjs';

/** Debug logging is runtime-only by design (it resets on reload and has no preference),
 * so the loop runs the plugin's own registered toggle after each fresh load when present. */
export async function enableDebugLogging(page, id) {
  if (!(await pluginCommands(page, id)).some(command => command.id === `${id}:debug-toggle`)) return false;
  await executeCommand(page, `${id}:debug-toggle`);
  return true;
}
/** Run the plugin's debug-report command when present and read the JSON its modal shows. */
export async function captureDebugReport(page, id) {
  if (!(await pluginCommands(page, id)).some(command => command.id === `${id}:debug-report`)) return null;
  const modals = page.locator('.modal-container');
  const before = await modals.count();
  await executeCommand(page, `${id}:debug-report`);
  await page.waitForFunction(count => document.querySelectorAll('.modal-container').length > count, before, { timeout: 10000 });
  const text = await modals.last().locator('.modal').innerText();
  await page.keyboard.press('Escape');
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return { unparsed: text.slice(0, 20000) }; }
}
function frames(stack, limit = 15) {
  return stack ? stack.split('\n').map(line => line.trim()).filter(Boolean).slice(0, limit) : [];
}
/** The agent loop bundle: one JSON document with status, timings, deduplicated errors and paths. */
export async function onceSummary({ root, id, host, sandbox, logFile, recorder, result, debugReport, manifest, view = null }) {
  const screenshot = join(sandbox.logs, 'last-run.png');
  let screenshotError = null;
  await result.page.screenshot({ path: screenshot }).catch(error => { screenshotError = error.message; });
  const debugPath = join(sandbox.logs, 'debug-report.json');
  if (debugReport) await writeFile(debugPath, `${JSON.stringify(debugReport, null, 2)}\n`);
  const failures = loadErrors(recorder.entries, id);
  const { reload, timing } = result;
  const summary = {
    status: reload.loaded && !reload.error && !failures.length ? 'passed' : 'failed',
    plugin: { id, version: manifest.version, loaded: reload.loaded, enabled: reload.enabled, reloadError: reload.error },
    obsidian: { requested: host.requestedVersion, app: host.appVersion, installer: host.installerVersion, launcher: host.launcherVersion },
    timings: { buildMs: timing.buildMs, buildAndInstallMs: timing.totalMs, reloadMs: reload.durationMs },
    debugLogging: result.debugLogging,
    // The plugin view shown in the screenshot (null when the plugin registers no view).
    view,
    commands: (await pluginCommands(result.page, id).catch(() => [])).map(command => command.id),
    errors: dedupeEntries(failures).map(({ entry, count }) => ({ count, kind: entry.kind, text: entry.text, frames: frames(entry.stack) })),
    hostErrorCount: recorder.errors().length - failures.length,
    pluginConsole: recorder.pluginEntries().slice(-200).map(entry => formatEntry(entry, id)),
    files: { sandboxVault: relative(root, sandbox.vault), log: relative(root, logFile),
      screenshot: screenshotError ? null : relative(root, screenshot), debugReport: debugReport ? relative(root, debugPath) : null },
    ...(screenshotError ? { screenshotError } : {}),
  };
  await writeFile(join(sandbox.logs, 'last-run.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
/** The --json summary when the run failed before a normal summary existed (for example Obsidian
 * crashed or exited): status, the error and whatever the run already knew. Never throws. */
export async function failureSummary({ root, error, status = 'failed', id = null, manifest = null, host = null, sandbox = null, logFile = null, recorder = null }) {
  const failures = recorder && id ? loadErrors(recorder.entries, id) : [];
  const summary = {
    status,
    error: error?.message ?? String(error),
    plugin: id ? { id, version: manifest?.version ?? null } : null,
    obsidian: host ? { requested: host.requestedVersion, app: host.appVersion, installer: host.installerVersion, launcher: host.launcherVersion } : null,
    errors: dedupeEntries(failures).map(({ entry, count }) => ({ count, kind: entry.kind, text: entry.text, frames: frames(entry.stack) })),
    pluginConsole: recorder && id ? recorder.pluginEntries().slice(-200).map(entry => formatEntry(entry, id)) : [],
    files: { sandboxVault: sandbox ? relative(root, sandbox.vault) : null, log: logFile ? relative(root, logFile) : null, screenshot: null, debugReport: null },
  };
  if (sandbox) await writeFile(join(sandbox.logs, 'last-run.json'), `${JSON.stringify(summary, null, 2)}\n`).catch(() => undefined);
  return summary;
}
