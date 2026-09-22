// Optional native smoke: only fresh temporary vault/config directories, never a personal vault.
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
const flags = process.argv.slice(2);
if (flags.length !== 1 || flags[0] !== '--allow-download') {
  console.error('Native smoke needs explicitly provisioned obsidian-launcher 3.2.1 in .native-runner plus --allow-download. This may download the host. No test was run.'); process.exit(2);
}
const output = resolve('reports/native'); await mkdir(output, { recursive: true });
const report = { mode: 'native-obsidian', status: 'not-run', sourceCommit: process.env.GITHUB_SHA ?? null, targetApp: '1.13.7', assets: [], checks: [], errors: [] };
const scratch = await mkdtemp(join(tmpdir(), 'plugin-shell-native-'));
let launched; let browser; let activePage;
try {
  const module = await import(pathToFileURL(resolve('.native-runner/node_modules/obsidian-launcher/dist/index.js')).href);
  const Launcher = module.default ?? module.ObsidianLauncher;
  const launcher = new Launcher({ cacheDir: resolve('.native-cache'), interactive: false });
  const vault = join(scratch, 'vault'); await mkdir(vault);
  const server = createServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port; await new Promise(ok => server.close(ok));
  report.resolvedVersions = await launcher.resolveVersion('1.13.7', 'latest');
  for (const file of ['main.js', 'styles.css', 'manifest.json']) report.assets.push({ file, sha256: createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex') });
  launched = await launcher.launch({ appVersion: '1.13.7', installerVersion: 'latest', vault, plugins: [resolve('dist')], args: [`--remote-debugging-port=${port}`], spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
  let log = ''; const capture = data => { log = (log + data.toString()).slice(-50000); };
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
    candidate.on('pageerror', error => report.errors.push(error.message.slice(0, 300)));
  };
  for (const candidate of context.pages()) observe(candidate);
  context.on('page', observe);
  let page = context.pages().find(value => value.url().startsWith('app:')) ?? context.pages()[0];
  if (!page) page = await context.waitForEvent('page', { timeout: 30000 });
  activePage = page;
  await page.waitForSelector('.workspace', { timeout: 45000 });
  report.userAgent = await page.evaluate(() => navigator.userAgent);
  // Workspace visibility precedes async plugin registration on a fresh vault.
  await expect(page.locator('[aria-label="Open capability showcase"]')).toBeVisible({ timeout: 45000 });
  await page.keyboard.press('ControlOrMeta+p');
  await page.locator('input.prompt-input').fill('Open capability showcase');
  await page.locator('.suggestion-item:visible').filter({ hasText: 'Open capability showcase' }).first().click();
  await expect(page.getByTestId('showcase')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Obsidian host', { exact: true })).toBeVisible(); report.checks.push('native-command-opens-view');
  await page.screenshot({ path: join(output, 'native-overview.png') });
  await page.getByRole('button', { name: 'Create your first Task note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Native smoke Task');
  await page.getByLabel('Due date', { exact: true }).fill('2026-09-30');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const preview = await page.getByTestId('markdown-preview').innerText();
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const path = await page.locator('.shell-destination code').innerText();
  expect(await readFile(join(launched.vault ?? vault, path), 'utf8')).toBe(preview); report.checks.push('actual-vault-markdown-matches-preview');
  await page.screenshot({ path: join(output, 'native-document.png') });
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Publish a typed event' }).click(); await expect(page.locator('.shell-event-table')).toContainText('showcase.ping'); report.checks.push('native-view-real-event');
  await page.getByRole('button', { name: 'Open native modal', exact: true }).click();
  await expect(page.locator('.modal').filter({ hasText: 'One view, two environments' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal').filter({ hasText: 'One view, two environments' })).toHaveCount(0);
  report.checks.push('native-modal-opens-and-dismisses');
  // Use the documented user workflow, not a global substring matching a hidden Search settings icon.
  await page.keyboard.press('ControlOrMeta+p');
  await page.locator('input.prompt-input').fill('Open settings');
  const openSettings = page.locator('.suggestion-item:visible').filter({ hasText: /Open settings/i });
  await expect(openSettings).toHaveCount(1);
  await openSettings.click();
  // Current Obsidian can place settings in another native window.
  let settingsPage;
  await expect.poll(async () => {
    for (const candidate of context.pages()) {
      if (await candidate.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Plugin shell$/i }).count()) { settingsPage = candidate; return true; }
    }
    return false;
  }, { timeout: 15000 }).toBe(true);
  activePage = settingsPage;
  const settings = settingsPage.locator('body');
  await settings.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Plugin shell$/i }).click();
  const folderControl = settings.locator('.setting-item:visible').filter({ hasText: 'Task note folder' }).locator('input');
  await expect(folderControl).toHaveValue('Tasks'); await folderControl.fill('Native/Tasks'); await folderControl.press('Tab');
  await expect.poll(async () => {
    try { return JSON.parse(await readFile(join(launched.vault ?? vault, '.obsidian/plugins/plugin-shell/data.json'), 'utf8')).preferences.taskFolder; }
    catch { return null; }
  }).toBe('Native/Tasks');
  await expect(folderControl).toHaveValue('Native/Tasks');
  report.checks.push('native-declarative-settings-use-application-writer');
  await settingsPage.screenshot({ path: join(output, 'native-settings.png') });
  if (report.errors.length) throw new Error('Native page reported unexpected errors; inspect report.');
  report.status = 'passed';
  await writeFile(join(output, 'host.log'), log);
} catch (error) {
  report.status = 'failed'; report.reason = error.message; process.exitCode = 1;
  if (activePage) {
    await activePage.screenshot({ path: join(output, 'native-failure.png') }).catch(() => undefined);
    report.nativeControlLabels = await activePage.locator('[aria-label]').evaluateAll(els => els.map(el => el.getAttribute('aria-label'))).catch(() => []);
    report.visibleText = await activePage.locator('body').innerText().then(value => value.slice(-12000)).catch(() => 'unavailable');
  }
}
finally {
  if (browser) await browser.close().catch(() => undefined);
  if (launched?.proc.pid) { try { if (process.platform !== 'win32') process.kill(-launched.proc.pid, 'SIGTERM'); else launched.proc.kill(); } catch { /* Already exited. */ } }
  if (launched?.configDir) await rm(launched.configDir, { recursive: true, force: true }).catch(() => undefined);
  await rm(scratch, { recursive: true, force: true }); await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
