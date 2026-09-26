import { appendFile, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { stagedBuild } from '../bundling/staged-build.mjs';
import { installLocal } from './install-local.mjs';
import { createRebuildLoop, watchPluginSources } from './rebuild-loop.mjs';
import { devUsage, parseDevOptions } from './obsidian-dev-options.mjs';
import { enableVaultPlugin, seedSandbox } from './obsidian-sandbox.mjs';
import { captureDebugReport, enableDebugLogging, onceSummary } from './obsidian-dev-report.mjs';
import { ProvisionRequired, assertHostPath, assertPortFree, captureOutput, connectHost, processRunning, provisionHost, requestedAppVersion, stopHost, workspacePage } from '../testing/obsidian-host.mjs';
import { assertNativeVault, nativeScratch, nativeScratchDirectory, withNativeTemporaryDirectory } from '../testing/native-isolation.mjs';
import { createConsoleRecorder, formatEntry, loadErrors, selectEntries } from '../testing/obsidian-console.mjs';
import { inlineSourceMap, mapPluginStack } from '../testing/obsidian-source-map.mjs';
import { reloadPlugin } from '../testing/obsidian-plugin-control.mjs';
import { ensureDisplay } from '../testing/obsidian-display.mjs';

/** Real-Obsidian inner loop: contained sandbox vault, CDP hot reload and streamed plugin logs. */
const root = process.cwd();
const entry = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);

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
async function launch(host, options, sandbox) {
  const scratch = await nativeScratch(root);
  let launched;
  try {
    await withNativeTemporaryDirectory(scratch, async () => {
      launched = await host.launcher.launch({ appVersion: host.appVersion, installerVersion: host.installerVersion, vault: sandbox.vault, copy: false,
        plugins: [], localStorage: { language: 'en' }, args: [`--remote-debugging-port=${options.port}`],
        spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
    }, root);
    await assertNativeVault(launched.vault, sandbox.vault);
  } catch (error) {
    await stopHost(launched?.proc).catch(() => undefined);
    await rm(await nativeScratchDirectory(scratch, root), { recursive: true, force: true });
    throw error;
  }
  return { scratch, proc: launched.proc, output: captureOutput(launched.proc) };
}
async function main() {
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
  let host;
  try { assertHostPath(root); host = await provisionHost({ root, allowDownload: options.allowDownload, appVersion: requestedAppVersion() }); }
  catch (error) {
    if (error instanceof ProvisionRequired || error.message.startsWith('NATIVE_SOCKET_PATH_TOO_LONG')) { console.error(error.message); return 2; }
    throw error;
  }
  await assertPortFree(options.port);
  const display = await ensureDisplay({ log: say });
  try { return await develop(options, host, { say, out, printSummary }); }
  finally { await display.stop(); }
}
async function develop(options, host, { say, out, printSummary }) {
  const sandbox = await seedSandbox({ root, sandbox: options.sandbox });
  say(`Contained sandbox vault: ${relative(root, sandbox.vault)} (${sandbox.seeded ? `seeded ${sandbox.files} files from tests/obsidian/vault` : 'existing data preserved'}). No personal vault is opened.`);
  const logFile = join(sandbox.logs, 'dev.log');
  const log = line => appendFile(logFile, `${line}\n`).catch(() => undefined);
  await log(`=== dev:obsidian session ${new Date().toISOString()} pid ${process.pid}`);
  const state = { manifest: undefined, sourceMap: null };
  const first = await buildAndInstall(options, state);
  const id = state.manifest.id;
  await enableVaultPlugin(root, sandbox.vault, id);
  const host$ = await launch(host, options, sandbox);
  const recorder = createConsoleRecorder({ pluginId: id,
    transform: item => ({ ...item, text: mapPluginStack(item.text, state.sourceMap, id), stack: mapPluginStack(item.stack, state.sourceMap, id) }),
    onEntry: item => {
      const line = formatEntry(item, id); void log(line);
      if (selectEntries([item], { pluginId: id, mode: options.logs }).length) out(line);
    } });
  let browser; let stopContext = () => undefined; let stopWatching = () => undefined; let loop; let closing;
  const shutdown = (reason, code) => {
    closing ??= (async () => {
      say(`Stopping (${reason}).`);
      stopWatching(); await loop?.close();
      stopContext(); recorder.dispose();
      await browser?.close().catch(() => undefined);
      await stopHost(host$.proc).catch(error => { console.error(error.message); });
      await writeFile(join(sandbox.logs, 'host-process.log'), host$.output()).catch(() => undefined);
      await rm(await nativeScratchDirectory(host$.scratch, root), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
        .catch(error => { console.error(`Scratch retained: ${error.message}`); });
      await log(`=== session ended (${reason})`);
      return code;
    })();
    return closing;
  };
  // Registered as soon as Obsidian runs: an interrupt at any later point closes the host and profile.
  let stopped;
  const finished = new Promise(resolve => { stopped = resolve; });
  const stopOn = (reason, code) => () => { void shutdown(reason, code).then(stopped); };
  process.once('SIGINT', stopOn('SIGINT', 0)); process.once('SIGTERM', stopOn('SIGTERM', 0));
  host$.proc.once('exit', stopOn('Obsidian exited', 0));
  try {
    browser = await connectHost({ chromium, port: options.port, proc: host$.proc, output: host$.output });
    stopContext = recorder.attachContext(browser.contexts()[0]);
    await workspacePage(browser);
    say(`Obsidian ${host.appVersion} is running. Debugger: http://127.0.0.1:${options.port} (chrome://inspect, VS Code "attach", Playwright connectOverCDP).`);
    say(`Logs: ${relative(root, logFile)} (terminal filter: ${options.logs}; inline dev source maps${state.sourceMap ? '' : ' unavailable'}).`);
    const cycle = async (label, timing) => {
      const page = await workspacePage(browser); const mark = recorder.mark();
      const reload = await reloadPlugin(page, id, { timeout: 15000, required: false });
      const debugLogging = options.debugLogging && reload.loaded ? await enableDebugLogging(page, id) : false;
      const errors = loadErrors(recorder.since(mark), id);
      say(`${errors.length || !reload.loaded ? '✗' : '✓'} ${label}: ${id} ${reload.version} ${reload.loaded ? 'loaded' : 'NOT loaded'} (build ${timing.buildMs}ms, reload ${reload.durationMs}ms, total ${timing.totalMs + reload.durationMs}ms)${errors.length ? `, ${errors.length} error(s)` : ''}${debugLogging ? ', debug logging on' : ''}${reload.error ? ` [${reload.error}]` : ''}`);
      return { page, reload, errors, debugLogging, timing };
    };
    if (options.once) {
      const result = await cycle('reload', first);
      await new Promise(ok => setTimeout(ok, options.settleMs));
      let debugReport = null;
      try { debugReport = result.reload.loaded ? await captureDebugReport(result.page, id) : null; }
      catch (error) { debugReport = { error: error.message }; }
      const summary = await onceSummary({ root, id, host, sandbox, logFile, recorder, result, debugReport, manifest: state.manifest });
      printSummary(summary);
      return await shutdown('once complete', summary.status === 'passed' ? 0 : 1);
    }
    await cycle('initial load', first);
    loop = createRebuildLoop(async () => { await cycle('rebuilt', await buildAndInstall(options, state)); },
      { onError: error => { say(`✗ build/reload failed; the last good build stays installed. ${error.message}`); } });
    stopWatching = watchPluginSources(() => loop.changed());
    say('Watching src/ and build configuration. Ctrl-C stops Obsidian and the watcher.');
    return await finished;
  } catch (error) {
    // After an interrupt, in-flight page calls fail because the host is closing; keep the interrupt's result.
    if (!closing) console.error(`[dev:obsidian] ${error.message}`);
    return await shutdown('failure', 1);
  } finally { if (processRunning(host$.proc)) await shutdown('cleanup', 1); }
}
if (process.argv[1] && resolve(process.argv[1]) === entry) {
  main().then(code => { process.exitCode = code; }, error => { console.error(`[dev:obsidian] ${error.stack ?? error.message}`); process.exitCode = 1; });
}
