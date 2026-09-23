import { pendingNativeData } from './native-data.mjs';
// Optional native smoke: only fresh temporary vault/config directories, never a personal vault.
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
import { qualifyHeaders, assertDiagnostics } from './native-header-checks.mjs';
import { sizeNativeWindow } from './native-window.mjs';
import { nativeCommand } from './native-command.mjs';
import { qualifyRepository } from './native-repository.mjs';
import { readNativeIdentity } from './native-identity.mjs';
import { qualifyCommandRemoval } from './native-command-contract.mjs';
import { qualifyModals } from './native-modals.mjs';
import { qualifyDebugging } from './native-debugging.mjs';
import { qualifyItems, qualifyItemsRestart } from './native-items.mjs';
import { qualifyPerformance } from './native-performance.mjs';
import { qualifyItemOwnership } from './native-item-ownership.mjs';
import { nativeScratch, nativeConfigDirectory, assertNativeVault } from './native-isolation.mjs';
const flags = process.argv.slice(2);
if (flags.length === 1 && flags[0] === '--help') {
  console.log('Usage: npm run test:native -- --allow-download [--performance [--controlled-reference]]\nRequires provisioned obsidian-launcher 3.2.1 and retained dist assets; uses isolated vault/config only.\nPerformance: 3 warmups + 30 samples each of warm initialization and real 100-item readiness. Budgets are reported separately.\nUse --controlled-reference only on an otherwise idle reference host. All attempts are retained under reports/native/attempts.'); process.exit(0);
}
if (!flags.includes('--allow-download') || new Set(flags).size !== flags.length || flags.some(flag => !['--allow-download', '--performance', '--controlled-reference'].includes(flag)) || flags.includes('--controlled-reference') && !flags.includes('--performance')) {
  console.error('Native smoke needs explicitly provisioned obsidian-launcher 3.2.1 in .native-runner plus --allow-download. Optional flags: --performance [--controlled-reference]. This may download the host. No test was run.'); process.exit(2);
}
const output = resolve('reports/native/attempts', `${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`); await mkdir(output, { recursive: true });
const report = { mode: 'native-obsidian', status: 'not-run', sourceCommit: process.env.GITHUB_SHA ?? null, targetApp: '1.13.7', attemptDirectory: output, assets: [], checks: [], errors: [] };
const scratch = await nativeScratch();
let launched; let browser; let activePage; let log = ''; const configDirectories = [];
try {
  const identity = await readNativeIdentity(); report.identity = { id: identity.id, name: identity.name, version: identity.version };
  const provider = JSON.parse(await readFile('.native-runner/node_modules/obsidian-launcher/package.json', 'utf8'));
  if (provider.version !== '3.2.1') throw new Error('UNQUALIFIED_NATIVE_LAUNCHER'); report.launcherVersion = provider.version;
  const module = await import(pathToFileURL(resolve('.native-runner/node_modules/obsidian-launcher/dist/index.js')).href);
  const Launcher = module.default ?? module.ObsidianLauncher;
  const launcher = new Launcher({ cacheDir: resolve('.native-cache'), interactive: false });
  const vault = join(scratch, 'vault'); await mkdir(vault);
  const server = createServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port; await new Promise(ok => server.close(ok));
  report.resolvedVersions = await launcher.resolveVersion('1.13.7', 'latest');
  const [appVersion, installerVersion] = report.resolvedVersions;
  for (const file of ['main.js', 'styles.css', 'manifest.json']) report.assets.push({ file, sha256: createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex') });
  launched = await launcher.launch({ appVersion, installerVersion, vault, copy: false, plugins: [resolve('dist')], localStorage: { language: 'en' }, args: [`--remote-debugging-port=${port}`], spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
  await assertNativeVault(launched.vault, vault); configDirectories.push(await nativeConfigDirectory(launched.configDir));
  const capture = data => { log = (log + data.toString()).slice(-50000); };
  launched.proc.stdout?.on('data', capture); launched.proc.stderr?.on('data', capture);
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { browser = await chromium.connectOverCDP(endpoint, { timeout: 2000 }); break; }
    catch { if (launched.proc.exitCode !== null) throw new Error(`Obsidian exited: ${log}`); await new Promise(ok => setTimeout(ok, 250)); }
  }
  if (!browser) throw new Error(`Native debugging endpoint unavailable: ${log}`);
  const context = browser.contexts()[0];
  const observedPages = new WeakSet();
  const observe = candidate => {
    if (observedPages.has(candidate)) return;
    observedPages.add(candidate);
    candidate.setDefaultTimeout(15000); candidate.setDefaultNavigationTimeout(45000);
    candidate.on('pageerror', error => report.errors.push({ message: error.message.slice(0, 300), stack: error.stack?.slice(0, 3000), url: candidate.url(), phase: report.phase ?? 'initial-smoke' }));
  };
  for (const candidate of context.pages()) observe(candidate);
  context.on('page', observe);
  let page = context.pages().find(value => value.url().startsWith('app:')) ?? context.pages()[0];
  if (!page) page = await context.waitForEvent('page', { timeout: 30000 });
  activePage = page;
  await page.waitForSelector('.workspace', { timeout: 45000 });
  report.window = await sizeNativeWindow(page);
  report.installedAssets = [];
  for (const asset of report.assets) {
    const sha256 = createHash('sha256').update(await readFile(join(launched.vault ?? vault, identity.pluginDirectory, asset.file))).digest('hex');
    expect(sha256).toBe(asset.sha256); report.installedAssets.push({ file: asset.file, sha256 });
  }
  report.userAgent = await page.evaluate(() => navigator.userAgent);
  // Workspace visibility precedes async plugin registration on a fresh vault.
  await expect(page.locator('[aria-label="Open capability showcase"]')).toBeVisible({ timeout: 45000 });
  if (flags.includes('--performance')) await qualifyPerformance(page, report, output, launched.vault ?? vault, identity, flags.includes('--controlled-reference') ? 'controlled-reference' : 'shared-runner');
  await page.keyboard.press('ControlOrMeta+p');
  await page.locator('input.prompt-input').fill('Open capability showcase');
  await page.locator('.suggestion-item:visible').filter({ hasText: 'Open capability showcase' }).first().click();
  await expect(page.getByTestId('showcase')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Obsidian host', { exact: true })).toBeAttached(); report.checks.push('native-command-opens-view');
  await qualifyItems(page, report, output, launched.vault ?? vault, identity);
  await qualifyItemOwnership(page, report, output, launched.vault ?? vault, identity);
  await qualifyCommandRemoval(page, report, identity);
  await page.screenshot({ path: join(output, 'native-overview.png') });
  await page.getByRole('button', { name: 'Create your first Task note' }).click();
  await page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title' }).fill('Native smoke Task');
  await page.getByLabel('Due date', { exact: true }).fill('2026-09-30');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const preview = await page.getByTestId('markdown-preview').innerText();
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const path = await page.locator('.shell-destination code').innerText();
  expect(path).toBe('Tasks/Native smoke Task.md');
  expect(await readFile(join(launched.vault ?? vault, path), 'utf8')).toBe(preview); report.checks.push('actual-vault-verbatim-title-and-markdown-match-preview');
  await page.screenshot({ path: join(output, 'native-document.png') });
  await qualifyRepository(page, report, output, launched.vault ?? vault, identity);
  expect(await readFile(join(launched.vault ?? vault, path), 'utf8')).toBe(preview);
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Publish a typed event' }).click(); await expect(page.locator('.shell-event-table')).toContainText('showcase.ping'); report.checks.push('native-view-real-event');
  await qualifyModals(page, report, output, identity);
  await qualifyDebugging(page, report, output, identity, path);
  await qualifyHeaders(page, context, report, output, path, identity);
  report.phase = 'native-settings';
  // The command palette may belong to a different native window after pop-out use.
  await nativeCommand(page, 'Open settings');
  let settingsPage;
  await expect.poll(async () => {
    for (const candidate of context.pages()) {
      if (await candidate.locator('.vertical-tab-nav-item:visible').filter({ hasText: identity.settingsName }).count()) { settingsPage = candidate; return true; }
    }
    return false;
  }, { timeout: 15000 }).toBe(true);
  activePage = settingsPage;
  const settings = settingsPage.locator('body');
  await settings.locator('.vertical-tab-nav-item:visible').filter({ hasText: identity.settingsName }).click();
  const headerControl = settings.locator('.setting-item:visible').filter({ hasText: 'Hide Obsidian view header' }).locator('.checkbox-container');
  await expect(headerControl).toHaveClass(/is-enabled/); await headerControl.click();
  await expect.poll(async () => (await pendingNativeData(join(launched.vault ?? vault, identity.pluginDirectory, 'data.json')))?.preferences?.hideObsidianViewHeader).toBe(false);
  await expect(page.locator(`${identity.viewSelector} > .view-header:visible`)).toHaveCount(1);
  report.checks.push('native-settings-restoration-shares-canonical-service');
  const folderControl = settings.locator('.setting-item:visible').filter({ hasText: 'Task note folder' }).locator('input');
  await expect(folderControl).toHaveValue('Tasks'); await folderControl.fill('Native/Tasks'); await folderControl.press('Tab');
  await expect.poll(async () => (await pendingNativeData(join(launched.vault ?? vault, identity.pluginDirectory, 'data.json')))?.preferences?.taskFolder).toBe('Native/Tasks');
  await expect(folderControl).toHaveValue('Native/Tasks');
  report.checks.push('native-declarative-settings-use-application-writer');
  await settingsPage.screenshot({ path: join(output, 'native-settings.png') });
  await assertDiagnostics(page, identity);
  report.phase = 'cold-restart';
  // A cold process restart uses the same isolated vault and its already-installed assets.
  await headerControl.click();
  await expect.poll(async () => (await pendingNativeData(join(launched.vault ?? vault, identity.pluginDirectory, 'data.json')))?.preferences?.hideObsidianViewHeader).toBe(true);
  const persistedVault = launched.vault ?? vault;
  const previousPid = launched.proc.pid;
  await browser.close(); browser = undefined;
  if (launched.proc.exitCode === null && launched.proc.signalCode === null) {
    const exited = new Promise(ok => launched.proc.once('exit', ok));
    if (process.platform !== 'win32') process.kill(-previousPid, 'SIGTERM'); else launched.proc.kill();
    await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('NATIVE_STOP_TIMEOUT')), 10000))]);
  }
  launched = await launcher.launch({ appVersion, installerVersion, vault: persistedVault, copy: false,
    localStorage: { language: 'en' },
    args: [`--remote-debugging-port=${port}`], spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
  await assertNativeVault(launched.vault, vault); configDirectories.push(await nativeConfigDirectory(launched.configDir)); launched.proc.stdout?.on('data', capture); launched.proc.stderr?.on('data', capture);
  expect(launched.proc.pid).not.toBe(previousPid);
  const restartDeadline = Date.now() + 90000;
  while (Date.now() < restartDeadline) {
    try { browser = await chromium.connectOverCDP(endpoint, { timeout: 2000 }); break; }
    catch { if (launched.proc.exitCode !== null) throw new Error('NATIVE_RESTART_EXIT'); await new Promise(ok => setTimeout(ok, 250)); }
  }
  if (!browser) throw new Error('NATIVE_RESTART_ENDPOINT');
  const restartedContext = browser.contexts()[0];
  for (const candidate of restartedContext.pages()) observe(candidate); restartedContext.on('page', observe);
  const restarted = restartedContext.pages().find(value => value.url().startsWith('app:')) ?? restartedContext.pages()[0];
  if (!restarted) throw new Error('NATIVE_RESTART_PAGE'); activePage = restarted;
  await expect(restarted.locator('[aria-label="Open capability showcase"]')).toBeVisible({ timeout: 45000 });
  await nativeCommand(restarted, 'Open capability showcase');
  const restartedView = restarted.locator(identity.viewSelector).first();
  await expect(restartedView.locator('[data-plugin-ui]')).toBeVisible();
  await expect(restartedView.locator(':scope > .view-header')).toBeHidden();
  await restartedView.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(restartedView.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true })).toBeChecked();
  await expect(restartedView.getByRole('textbox', { name: 'Task note folder', exact: true })).toHaveValue('Native/Tasks');
  await qualifyItemsRestart(restarted, report, persistedVault, identity);
  for (const asset of report.assets) expect(createHash('sha256').update(await readFile(join(persistedVault, identity.pluginDirectory, asset.file))).digest('hex')).toBe(asset.sha256);
  expect(await readFile(join(persistedVault, path), 'utf8')).toBe(preview);
  await assertDiagnostics(restarted, identity); await restarted.screenshot({ path: join(output, 'native-cold-restart-header-hidden.png') });
  report.checks.push('native-cold-process-restart-persists-header-folder-note-and-identical-installed-assets');
  for (const asset of report.assets) expect(createHash('sha256').update(await readFile(`dist/${asset.file}`)).digest('hex')).toBe(asset.sha256);
  if (report.errors.length) throw new Error('Native page reported unexpected errors; inspect report.');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.reason = error.message; process.exitCode = 1;
  if (activePage) {
    report.themeFailure = await activePage.evaluate(() => ({
      bodyClass: document.body.className.slice(0, 2048),
      bodyConnected: document.body.isConnected,
      visibility: document.visibilityState, focus: document.hasFocus(),
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      hostConfig: window.app ? { theme: window.app.vault.getConfig('theme'), cssTheme: window.app.vault.getConfig('cssTheme') } : { unavailable: true },
      independentForegroundHwnd: 'not-captured',
      roots: Array.from(document.querySelectorAll('[data-plugin-ui]')).slice(0, 16).map(root => ({
        className: String(root.className).slice(0, 2048), connected: root.isConnected,
        ownerIsCurrentDocument: root.ownerDocument === document,
        ownerBodyClass: root.ownerDocument.body?.className.slice(0, 2048),
        ownerBodyIsCurrent: root.ownerDocument.body === document.body,
        owningViewType: root.closest('[data-type]')?.getAttribute('data-type'),
      })),
    })).catch(() => ({ unavailable: true }));
    await activePage.screenshot({ path: join(output, 'native-failure.png') }).catch(() => undefined);
    report.nativeControlLabels = await activePage.locator('[aria-label]').evaluateAll(els => els.map(el => el.getAttribute('aria-label'))).catch(() => []);
    report.visibleText = await activePage.locator('body').innerText().then(value => value.slice(-12000)).catch(() => 'unavailable');
  }
}
finally {
  // Preserve the primary outcome even when host processes delay filesystem cleanup.
  await writeFile(join(output, 'host.log'), log);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close().catch(() => undefined);
  if (launched?.proc.pid && launched.proc.exitCode === null && launched.proc.signalCode === null) {
    let timeout;
    try {
      const stopped = new Promise(ok => launched.proc.once('exit', ok));
      if (process.platform !== 'win32') process.kill(-launched.proc.pid, 'SIGTERM'); else launched.proc.kill();
      await Promise.race([stopped, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('NATIVE_STOP_TIMEOUT')), 10000); })]);
    } catch { report.status = 'failed'; report.cleanupFailure = 'NATIVE_PROCESS_STOP_FAILED'; process.exitCode = 1; }
    finally { clearTimeout(timeout); }
  }
  const stopped = !launched || launched.proc.exitCode !== null || launched.proc.signalCode !== null;
  for (const directory of configDirectories) {
    try { if (!stopped) throw new Error('NATIVE_STILL_RUNNING'); await rm(await nativeConfigDirectory(directory), { recursive: true, force: true }); }
    catch { report.status = 'failed'; report.cleanupFailure = 'NATIVE_CONFIG_CLEANUP_FAILED'; process.exitCode = 1; }
  }
  if (stopped) {
    try { await rm(scratch, { recursive: true, force: true }); }
    catch { report.status = 'failed'; report.cleanupFailure = 'NATIVE_SCRATCH_CLEANUP_FAILED'; report.scratchPreserved = true; process.exitCode = 1; }
  } else report.scratchPreserved = true;
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve('reports/native/report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
