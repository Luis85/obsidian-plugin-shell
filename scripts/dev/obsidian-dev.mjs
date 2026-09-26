import { appendFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { stagedBuild } from '../bundling/staged-build.mjs';
import { installLocal } from './install-local.mjs';
import { createRebuildLoop, watchPluginSources } from './rebuild-loop.mjs';
import { devUsage, parseDevOptions } from './obsidian-dev-options.mjs';
import { enableVaultPlugin, seedSandbox } from './obsidian-sandbox.mjs';
import { captureDebugReport, enableDebugLogging, failureSummary, onceSummary } from './obsidian-dev-report.mjs';
import { createDevSession, listenForInterrupts } from './dev-session.mjs';
import { ProvisionRequired, assertHostPath, assertPortFree, captureOutput, connectHost, provisionHost, requestedAppVersion, signalHostTree, stopHost, workspacePage } from '../testing/obsidian-host.mjs';
import { assertNativeVault, nativeScratch, nativeScratchDirectory, withNativeTemporaryDirectory } from '../testing/native-isolation.mjs';
import { createConsoleRecorder, formatEntry, loadErrors, selectEntries } from '../testing/obsidian-console.mjs';
import { inlineSourceMap, mapPluginStack } from '../testing/obsidian-source-map.mjs';
import { openPluginView, reloadPlugin } from '../testing/obsidian-plugin-control.mjs';
import { ensureDisplay } from '../testing/obsidian-display.mjs';
import { sourceRoots } from '../shared/project-roots.mjs';

/** Real-Obsidian inner loop: contained sandbox vault, CDP hot reload and streamed plugin logs. */
const root = process.cwd();
const entry = fileURLToPath(import.meta.url);

/** Build a dev candidate with inline source maps into the sandbox; dist/ and release builds are untouched. */
async function buildAndInstall(options, state) {
  const started = Date.now();
  const build = `${options.sandbox}/build`;
  await stagedBuild({ root, target: build, sourcemap: 'inline', ...(options.once ? { logLevel: 'warn' } : {}) });
  const buildMs = Date.now() - started;
  state.manifest = JSON.parse(await readFile(join(root, build, 'manifest.json'), 'utf8'));
  state.sourceMap = inlineSourceMap(await readFile(join(root, build, 'main.js'), 'utf8'));
  await installLocal({ root, vault: `${options.sandbox}/vault`, source: build });
  return { buildMs, totalMs: Date.now() - started };
}
/** The scratch profile and the Obsidian process are tracked the moment they exist. */
async function launch(host, options, sandbox, session) {
  const scratch = await nativeScratch(root);
  session.track('scratch profile', () => nativeScratchDirectory(scratch, root)
    .then(path => rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }))
    .catch(error => { console.error(`[dev:obsidian] Scratch retained: ${error.message}`); }));
  let launched; let output = () => '';
  await withNativeTemporaryDirectory(scratch, async () => {
    launched = await host.launcher.launch({ appVersion: host.appVersion, installerVersion: host.installerVersion, vault: sandbox.vault, copy: false,
      plugins: [], localStorage: { language: 'en' }, args: [`--remote-debugging-port=${options.port}`],
      spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
    const { proc } = launched; output = captureOutput(proc);
    session.track('Obsidian', async () => {
      await stopHost(proc).catch(error => { console.error(`[dev:obsidian] ${error.message}`); });
      await writeFile(join(sandbox.logs, 'host-process.log'), output()).catch(() => undefined);
    }, () => signalHostTree(proc, 'SIGKILL'));
  }, root);
  await assertNativeVault(launched.vault, sandbox.vault);
  return { proc: launched.proc, output };
}
const defaults = { seedSandbox, buildAndInstall, enableVaultPlugin, launch, connectHost, workspacePage, reloadPlugin, openPluginView,
  enableDebugLogging, captureDebugReport, onceSummary, failureSummary, watchPluginSources };
async function main(argv = process.argv.slice(2)) {
  let options;
  try { options = parseDevOptions(argv, process.env); } catch (error) { console.error(`${error.message}\n\n${devUsage}`); return 2; }
  if (options.help) { console.log(devUsage); return 0; }
  // Once mode keeps stdout for the JSON summary only; status, build output and streamed logs go to stderr.
  const out = options.once ? console.error : console.log;
  // Build tools write progress straight to stdout, so once mode routes the stream itself to stderr.
  const stdout = process.stdout.write.bind(process.stdout);
  if (options.once) process.stdout.write = process.stderr.write.bind(process.stderr);
  const printSummary = summary => { stdout(`${JSON.stringify(summary, null, 2)}\n`); };
  const say = message => { out(`[dev:obsidian] ${message}`); };
  // Interrupts are handled from the first step: whatever already exists is stopped and removed.
  const session = createDevSession({ once: options.once, say });
  const unlisten = listenForInterrupts(session);
  try {
    let host;
    try { assertHostPath(root); host = await provisionHost({ root, allowDownload: options.allowDownload, appVersion: requestedAppVersion() }); }
    catch (error) {
      if (error instanceof ProvisionRequired || error.message.startsWith('NATIVE_SOCKET_PATH_TOO_LONG')) { console.error(error.message); return 2; }
      throw error;
    }
    if (session.interrupted) return session.code;
    await assertPortFree(options.port);
    await ensureDisplay({ log: say, track: (stop, kill) => session.track('virtual display', stop, kill) });
    return await develop(options, host, { say, out, printSummary }, session);
  } finally { await session.release(); unlisten(); }
}
/** One run in the sandbox. Returns the exit code; resources are released by the caller. */
export async function develop(options, host, { say, out, printSummary }, session, overrides = {}) {
  const run = { ...defaults, ...overrides };
  const known = { root, host, id: null, manifest: null, sandbox: null, logFile: null, recorder: null };
  try {
    const sandbox = known.sandbox = await session.guard(run.seedSandbox({ root, sandbox: options.sandbox }));
    say(`Contained sandbox vault: ${relative(root, sandbox.vault)} (${sandbox.seeded ? `seeded ${sandbox.files} files from tests/obsidian/vault` : 'existing data preserved'}). No personal vault is opened.`);
    const logFile = known.logFile = join(sandbox.logs, 'dev.log');
    const log = line => appendFile(logFile, `${line}\n`).catch(() => undefined);
    await log(`=== dev:obsidian session ${new Date().toISOString()} pid ${process.pid}`);
    session.track('session log', () => log(`=== session ended (${session.interrupted ?? session.failure?.message ?? 'complete'})`));
    const state = { manifest: undefined, sourceMap: null };
    const first = await session.guard(run.buildAndInstall(options, state));
    const id = known.id = state.manifest.id; known.manifest = state.manifest;
    await session.guard(run.enableVaultPlugin(root, sandbox.vault, id));
    const host$ = await session.guard(run.launch(host, options, sandbox, session));
    host$.proc.once('exit', (code, signal) => session.hostExited(code, signal));
    if (host$.proc.exitCode !== null || host$.proc.signalCode !== null) session.hostExited(host$.proc.exitCode, host$.proc.signalCode);
    const recorder = known.recorder = createConsoleRecorder({ pluginId: id,
      transform: item => ({ ...item, text: mapPluginStack(item.text, state.sourceMap, id), stack: mapPluginStack(item.stack, state.sourceMap, id) }),
      onEntry: item => {
        const line = formatEntry(item, id); void log(line);
        if (selectEntries([item], { pluginId: id, mode: options.logs }).length) out(line);
      } });
    session.track('console recorder', () => recorder.dispose());
    const browser = await session.guard(run.connectHost({ chromium, port: options.port, proc: host$.proc, output: host$.output }));
    session.track('debugger connection', () => browser.close().catch(() => undefined));
    session.track('console capture', recorder.attachContext(browser.contexts()[0]));
    await session.guard(run.workspacePage(browser));
    say(`Obsidian ${host.appVersion} is running. Debugger: http://127.0.0.1:${options.port} (chrome://inspect, VS Code "attach", Playwright connectOverCDP).`);
    say(`Logs: ${relative(root, logFile)} (terminal filter: ${options.logs}; inline dev source maps${state.sourceMap ? '' : ' unavailable'}).`);
    const cycle = async (label, timing) => {
      const page = await run.workspacePage(browser); const mark = recorder.mark();
      const reload = await run.reloadPlugin(page, id, { timeout: 15000, required: false });
      const debugLogging = options.debugLogging && reload.loaded ? await run.enableDebugLogging(page, id) : false;
      const errors = loadErrors(recorder.since(mark), id);
      say(`${errors.length || !reload.loaded ? '✗' : '✓'} ${label}: ${id} ${reload.version} ${reload.loaded ? 'loaded' : 'NOT loaded'} (build ${timing.buildMs}ms, reload ${reload.durationMs}ms, total ${timing.totalMs + reload.durationMs}ms)${errors.length ? `, ${errors.length} error(s)` : ''}${debugLogging ? ', debug logging on' : ''}${reload.error ? ` [${reload.error}]` : ''}`);
      return { page, reload, errors, debugLogging, timing };
    };
    if (options.once) return await once(options, run, session, { cycle, first, printSummary, say, known, recorder, state });
    await session.guard(cycle('initial load', first));
    const loop = createRebuildLoop(async () => { await cycle('rebuilt', await run.buildAndInstall(options, state)); },
      { onError: error => { say(`✗ build/reload failed; the last good build stays installed. ${error.message}`); } });
    session.track('rebuild loop', () => loop.close());
    const roots = ['src', 'scripts/bundling', ...sourceRoots(root)];
    session.track('source watchers', run.watchPluginSources(() => loop.changed(), { sources: roots }));
    say(`Watching ${[...new Set(roots)].join(', ')} and build configuration. Ctrl-C stops Obsidian and the watcher.`);
    await session.stopRequested;
    return session.code;
  } catch (error) {
    session.fail(error);
    if (options.once) printSummary(await run.failureSummary({ ...known, error: session.failure ?? error, status: session.interrupted ? 'cancelled' : 'failed' }));
    return session.code;
  }
}
/** --json/once: reload, show the plugin's first view, settle, then one summary on stdout. */
async function once(options, run, session, { cycle, first, printSummary, say, known, recorder, state }) {
  const { root: base, host, id, sandbox, logFile } = known;
  const result = await session.guard(cycle('reload', first));
  const view = result.reload.loaded ? await session.guard(run.openPluginView(result.page, result.reload.viewTypes)) : null;
  if (view) say(`${view.opened ? 'Showing' : '✗ Could not show'} view ${view.type}${view.error ? ` [${view.error}]` : ''}.`);
  await session.guard(new Promise(ok => setTimeout(ok, options.settleMs)));
  let debugReport = null;
  try { debugReport = result.reload.loaded ? await session.guard(run.captureDebugReport(result.page, id)) : null; }
  catch (error) { if (session.failure || session.interrupted) throw error; debugReport = { error: error.message }; }
  const summary = await session.guard(run.onceSummary({ root: base, id, host, sandbox, logFile, recorder, result, debugReport, manifest: state.manifest, view }));
  session.settle();
  printSummary(summary);
  if (summary.status !== 'passed') session.failed(1);
  return session.code;
}
if (process.argv[1] && resolve(process.argv[1]) === entry) {
  main().then(code => { process.exitCode = code; }, error => { console.error(`[dev:obsidian] ${error.stack ?? error.message}`); process.exitCode = 1; });
}
