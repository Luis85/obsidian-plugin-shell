/** Real rendered actions. --fixture uses explicit storage/hash host shims when navigation is unavailable. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../..');
const fixture = process.argv.includes('--fixture');
const html = await readFile(resolve(root, 'reports/companion-mvp/index.html'), 'utf8');
const golden = resolve(root, 'configs/starters/companion-plugin.json');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const checks = [], errors = [], requests = [];
const context = await browser.newContext();
let page;
async function open(saved = null) {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => { if (route.request().url().startsWith('file:')) return route.continue(); requests.push(route.request().url()); return route.abort(); });
  if (fixture) {
    await page.exposeFunction('fixtureHash', values => Array.from(createHash('sha256').update(Buffer.from(values)).digest()));
    const storage = JSON.stringify(saved ? { 'shell-workbench-single-vault-v2': saved } : {}).replaceAll('<', '\\u003c');
    await page.setContent(`<script>const fixtureStore=${storage};Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,v)=>{fixtureStore[k]=v},removeItem:k=>delete fixtureStore[k]}});Object.defineProperty(window.crypto,'subtle',{value:{digest:async(_,bytes)=>new Uint8Array(await window.fixtureHash(Array.from(new Uint8Array(bytes)))).buffer}});</script>` + html);
  } else {
    await page.goto(pathToFileURL(resolve(root, 'reports/companion-mvp/index.html')).href);
    if (saved === null) {
      await page.evaluate(() => localStorage.clear()); await page.reload();
    }
  }
}
async function check(name, fn) { await fn(); checks.push(name); }
async function importFiles(files) {
  await page.locator('#starter-definition-files').setInputFiles(files);
  await page.waitForFunction(() => !starterImportBusy);
}
const status = () => page.locator('#starter-import-status').textContent();
const action = name => page.locator(`[data-action="${name}"]`).first();
try {
  await open();
  await check('empty startup has no project or embedded definitions', async () => {
    assert.equal(await page.evaluate(() => project()), null);
    assert.equal(await page.evaluate(() => state.view), 'starters');
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
    assert.equal(await page.locator('#project-starters-data, #companion-visual-seed').count(), 0);
    assert.ok(!html.includes('function jmSeed('));
  });
  await check('blank creation can be cancelled without mutation', async () => {
    await action('starter-blank').click(); await action('close').click();
    assert.equal(await page.evaluate(() => project()), null);
  });
  await check('blank project configuration opens setup without executing it', async () => {
    await action('starter-blank').click();
    await page.locator('[data-field="vault-name"]').fill('Blank acceptance');
    await page.locator('[data-field="vault-id"]').fill('blank-acceptance');
    await page.locator('[data-field="vault-author"]').fill('Test author');
    await action('vault-save').click();
    assert.equal(await page.evaluate(() => project().id), 'blank-acceptance');
    assert.equal(await page.evaluate(() => modalType), 'wizard');
    assert.equal(await page.evaluate(() => state.wizard.step), 0);
    assert.equal(await page.evaluate(() => state.activeRun), null);
  });
  await open();
  const good = await readFile(golden);
  await check('mixed valid and malformed JSON batch is atomic', async () => {
    await importFiles([{ name: 'companion-plugin.json', mimeType: 'application/json', buffer: good },
      { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') }]);
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
    assert.equal(await page.evaluate(() => project()), null);
  });
  await check('duplicate definitions fail the entire import', async () => {
    await importFiles([{ name: 'companion-plugin.json', mimeType: 'application/json', buffer: good },
      { name: 'copy.json', mimeType: 'application/json', buffer: good }]);
    assert.match(await status(), /Duplicate starter/);
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
  });
  await check('oversized imports fail before parsing or project mutation', async () => {
    await importFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(4_000_001, 32) });
    assert.match(await status(), /4 MB/);
    assert.equal(await page.evaluate(() => project()), null);
  });
  await check('invalid UTF-8 is not silently replaced', async () => {
    await importFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from([0xff]) });
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
  });
  await check('the golden definition is imported without starting a project or process', async () => {
    await importFiles(golden);
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 1);
    assert.equal(await page.evaluate(() => project()), null);
    assert.equal(await page.evaluate(() => state.activeRun), null);
    assert.equal(await page.evaluate(() => starterCatalog.starters[0].sha256), createHash('sha256').update(good).digest('hex'));
  });
  await check('golden definition review preserves v6 and does not commit before confirmation', async () => {
    await action('starter-open').click();
    await page.locator('[data-field="starter-name"]').fill('Configured Companion');
    await page.locator('[data-field="starter-id"]').fill('configured-companion');
    await action('starter-review').click();
    assert.equal(await page.evaluate(() => project()), null);
    assert.equal(await page.evaluate(() => JSON.parse(projectTransferUi.text).schemaVersion), 6);
    assert.equal(await page.evaluate(() => JSON.parse(projectTransferUi.text).design.sitemap.journeys.length), 3);
    await action('project-import-apply').click();
    assert.equal(await page.evaluate(() => project()), null);
  });
  await check('confirmed configuration enters setup with the complete authored model', async () => {
    await page.locator('#project-import-confirm').check(); await action('project-import-apply').click();
    assert.equal(await page.evaluate(() => project().id), 'configured-companion');
    assert.equal(await page.evaluate(() => project().design.visualDesigns.components.length), 54);
    assert.equal(await page.evaluate(() => modalType), 'wizard');
    assert.equal(await page.evaluate(() => state.wizard.step), 0);
    assert.equal(await page.evaluate(() => state.activeRun), null);
    assert.equal(await page.evaluate(() => state.runs.length), 0);
  });
  const saved = await page.evaluate(() => localStorage.getItem(STORAGE_KEY));
  await check('existing projects reopen without reimporting the starter or replacing data', async () => {
    await open(saved);
    assert.equal(await page.evaluate(() => project().id), 'configured-companion');
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
    assert.equal(await page.evaluate(() => project().design.visualDesigns.components.length), 54);
  });
  await check('no browser errors or external requests occurred', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  });
  console.log(JSON.stringify({ scope: fixture ? 'rendered DOM with explicit storage and SHA-256 host shims; not file-origin acceptance' : 'real Chromium file-origin interactions', passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
