/** Opt-in real-host smoke, never a substitute for interactive/mobile matrix qualification. */
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { qualifyHeaders, assertDiagnostics } from './native-header-checks.mjs';
import { createServer } from 'node:net';
async function freePort() {
  const server = createServer();
  await new Promise((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port;
  await new Promise(ok => server.close(ok));
  return port;
}
const output = resolve('reports/native');
await mkdir(output, { recursive: true });
const report = { status: 'not-run', platform: process.platform, app: '1.13.7', checks: [], errors: [] };
async function save() { await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2)); }
if (!process.argv.includes('--allow-download')) {
  report.reason = 'Explicit --allow-download and isolated provider installation are required. No host downloaded.';
  await save(); console.log(report.reason); process.exit(0);
}
let launcher;
let launched;
let browser;
try {
  const provider = createRequire(resolve('.native-runner/package.json'))('obsidian-launcher');
  await mkdir(resolve('.native-runner/cache'), { recursive: true });
  const scratch = await mkdtemp(resolve('.native-runner/vault-'));
  const vault = join(scratch, 'vault'); await mkdir(vault);
  await writeFile(join(vault, 'Native smoke.md'), '# Synthetic native test vault\n');
  launcher = new provider.ObsidianLauncher({ cacheDir: resolve('.native-runner/cache') });
  const port = await freePort();
  launched = await launcher.launch({ vault, plugins: [resolve('dist')], appVersion: report.app,
    installerVersion: 'latest', configDir: join(scratch, 'config'),
    args: ['--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`] });
  report.app = launched.appVersion;
  report.installer = launched.installerVersion;
  report.binaryHashes = Object.fromEntries(await Promise.all(['main.js', 'styles.css', 'manifest.json'].map(async file => [file, createHash('sha256').update(await readFile(resolve('dist', file))).digest('hex')])));
  for (let attempt = 0; attempt < 40; attempt++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); break; }
    catch { await new Promise(ok => setTimeout(ok, 500)); }
  }
  if (!browser) throw new Error('CDP_UNAVAILABLE');
  const context = browser.contexts()[0];
  const collectErrors = p => {
    p.on('pageerror', error => {
      if (error.stack?.includes('plugin:plugin-shell')) report.errors.push({ code: 'native.renderer', detail: 'plugin-owned page error' });
    });
  };
  context.pages().forEach(collectErrors); context.on('page', collectErrors);
  let page;
  for (let attempt = 0; attempt < 60; attempt++) {
    page = context.pages().find(p => p.url().includes('/index.html'));
    if (page && await page.locator('body').count()) break;
    await new Promise(ok => setTimeout(ok, 500));
  }
  if (!page) throw new Error('NATIVE_PAGE_UNAVAILABLE');
  await page.waitForFunction(() => document.querySelector('.workspace'));
  await page.keyboard.press('ControlOrMeta+p');
  const prompt = page.locator('input.prompt-input');
  await prompt.fill('Open capability showcase');
  await page.locator('.suggestion-item:visible').filter({ hasText: 'Open capability showcase' }).first().click();
  await expect(page.getByTestId('showcase')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Obsidian host', { exact: true })).toBeAttached();
  await page.screenshot({ path: join(output, 'native-overview.png') });
  report.checks.push('native-command-opens-plugin-view');
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Native smoke task');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const preview = await page.getByTestId('markdown-preview').innerText();
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const path = await page.locator('.shell-destination code').innerText();
  const written = await readFile(join(launched.vault ?? vault, path), 'utf8');
  if (written !== preview) throw new Error('NATIVE_MARKDOWN_MISMATCH');
  report.checks.push('native-vault-create-exact-preview');
  await page.screenshot({ path: join(output, 'native-document.png') });
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Publish a typed event' }).click();
  await expect(page.locator('.shell-event-table')).toContainText('showcase.ping');
  report.checks.push('native-view-event-action');
  await page.getByRole('button', { name: 'Open native modal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One view, two environments' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'One view, two environments' })).toHaveCount(0);
  report.checks.push('native-modal-opens-and-dismisses');
  await qualifyHeaders(page, context, report, output, path);
  // Open real host settings, then exercise the declarative preference API rather than calling our service.
  await page.keyboard.press('ControlOrMeta+p');
  await prompt.fill('Open settings');
  await page.locator('.suggestion-item:visible').filter({ hasText: 'Open settings' }).first().click();
  let settings;
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const candidate of context.pages()) {
      if (await candidate.locator('.vertical-tab-nav-item:visible').filter({ hasText: 'Plugin Shell' }).count()) settings = candidate;
    }
    if (settings) break;
    await new Promise(ok => setTimeout(ok, 250));
  }
  if (!settings) throw new Error('NATIVE_SETTINGS_UNAVAILABLE');
  await settings.locator('.vertical-tab-nav-item:visible').filter({ hasText: 'Plugin Shell' }).click();
  const headerControl = settings.locator('.setting-item:visible').filter({ hasText: 'Hide Obsidian view header' }).locator('.checkbox-container');
  await expect(headerControl).toHaveClass(/is-enabled/);
  await headerControl.click();
  await expect.poll(async () => JSON.parse(await readFile(join(launched.vault ?? vault, '.obsidian/plugins/plugin-shell/data.json'), 'utf8')).preferences.hideObsidianViewHeader).toBe(false);
  await expect(page.locator('[data-type="plugin-shell-showcase"] > .view-header:visible')).toHaveCount(1);
  report.checks.push('native-settings-restoration-shares-canonical-service');
  const folderControl = settings.locator('.setting-item:visible').filter({ hasText: 'Task note folder' }).locator('input[type=text]');
  await expect(folderControl).toBeVisible();
  await folderControl.fill('Native/Tasks');
  await folderControl.press('Tab');
  await expect.poll(async () => JSON.parse(await readFile(join(launched.vault ?? vault, '.obsidian/plugins/plugin-shell/data.json'), 'utf8')).preferences.taskFolder).toBe('Native/Tasks');
  await settings.screenshot({ path: join(output, 'native-settings.png') });
  report.checks.push('native-declarative-settings-save');
  await assertDiagnostics(page);
  if (report.errors.length) throw new Error('NATIVE_PLUGIN_ERRORS');
  report.status = 'pass';
} catch (error) {
  report.status = 'fail'; report.reason = String(error.message).replaceAll(process.cwd(), '<repository>').slice(0, 2000);
  console.error(report.reason);
  if (browser) {
    for (const [index, page] of browser.contexts()[0].pages().entries()) {
      try {
        await page.screenshot({ path: join(output, `failure-page-${index}.png`) });
        await writeFile(join(output, `failure-page-${index}.txt`), (await page.locator('body').innerText()).slice(0, 15000));
      } catch { /* A closing host window may be unavailable. */ }
    }
  }
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  if (launcher && launched) await launcher.kill(launched.proc).catch(() => undefined);
  await save();
  console.log(`Native ${report.status}: ${report.checks.length} observed checks; ${report.app}/${report.installer ?? 'unavailable'}.`);
}
