/** Actual file-origin browser checks of emitted dialog ownership with explicit frame doubles. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import { chromiumLaunchOptions } from '../testing/browser-executable.mjs';
import { clickdummyHostCode } from '../companion/compiler/clickdummy-host-code.ts';
let source; clickdummyHostCode((_path, content) => { source = content; });
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const root = await mkdtemp(join(tmpdir(), 'preview-host-browser-')), file = join(root, 'index.html');
await writeFile(file, '<!doctype html><html lang="en"><title>Preview host contract</title><body><button id="trigger">Open</button><label for="clickdummy-surface">Browse surfaces</label><select id="clickdummy-surface"><option>Inbox</option></select><script type="module">' + javascript + '\nwindow.hostApi = { createDialogHost, createPreviewLifecycle };<\/script></body></html>');
const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions() });
const cases = [], errors = [], network = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', route => {
    const url = route.request().url(); if (/^(?:file|data|blob):/.test(url)) return route.continue();
    network.push(url); return route.abort();
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  async function check(name, run) {
    await page.goto(pathToFileURL(file).href); await page.waitForFunction(() => Boolean(window.hostApi));
    await page.evaluate(() => {
      window.released = []; window.messages = []; window.mode = 'normal';
      window.host = window.hostApi.createDialogHost({ document, owner: 'fixture',
        label: id => id.startsWith('modal') ? id : undefined,
        mount(target, id) {
          if (window.mode === 'mount-failure') throw new Error('private cause');
          const button = document.createElement('button'); button.textContent = 'Nested opener'; target.append(button);
          if (window.mode === 'reentrant') window.host.closeAll();
          return () => { window.released.push(id); if (window.mode === 'release-failure') throw new Error('private cause'); };
        }, error: message => window.messages.push(message),
      });
      document.getElementById('trigger').focus();
    });
    await run(page); cases.push(name);
  }
  await check('unknown dialogs are refused before mounting', async page => {
    assert.equal(await page.evaluate(() => window.host.open('unknown')), false);
    assert.equal(await page.locator('dialog').count(), 0);
    assert.equal(await page.evaluate(() => window.messages.length), 1);
  });
  await check('failed mounting removes the dialog and restores its trigger', async page => {
    assert.equal(await page.evaluate(() => { window.mode = 'mount-failure'; return window.host.open('modal-one'); }), false);
    assert.equal(await page.locator('dialog').count(), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'trigger');
    assert.deepEqual(await page.evaluate(() => window.messages), ['This preview dialog could not be opened. No data was saved.']);
  });
  await check('Escape releases nested frames and returns focus in stack order', async page => {
    await page.evaluate(() => window.host.open('modal-parent'));
    await page.getByRole('button', { name: 'Nested opener' }).focus(); await page.evaluate(() => window.host.open('modal-child'));
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Nested opener');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.released), ['modal-child', 'modal-parent']);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'trigger');
  });
  await check('native dialog close releases its frame exactly once', async page => {
    await page.evaluate(() => { window.host.open('modal-one'); document.querySelector('dialog').close(); });
    await page.waitForFunction(() => document.querySelectorAll('dialog').length === 0);
    await page.evaluate(() => window.host.closeAll()); assert.deepEqual(await page.evaluate(() => window.released), ['modal-one']);
  });
  await check('closing a parent also disposes its remaining descendants', async page => {
    await page.evaluate(() => { window.host.open('modal-parent'); window.host.open('modal-child'); document.querySelector('dialog').close(); });
    await page.waitForFunction(() => document.querySelectorAll('dialog').length === 0);
    assert.deepEqual(await page.evaluate(() => window.released), ['modal-child', 'modal-parent']);
  });
  await check('cleanup failure is generic and does not strand DOM resources', async page => {
    await page.evaluate(() => { window.mode = 'release-failure'; window.host.open('modal-one'); window.host.closeAll(); });
    assert.equal(await page.locator('dialog').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.messages), ['Preview dialog cleanup failed. Reset preview before continuing.']);
  });
  await check('the dialog bound is enforced and reset releases every frame', async page => {
    const opened = await page.evaluate(() => Array.from({ length: 13 }, (_, index) => window.host.open('modal-' + index)));
    assert.deepEqual(opened, [...Array(12).fill(true), false]); await page.evaluate(() => window.host.closeAll());
    assert.equal(await page.locator('dialog').count(), 0); assert.equal(await page.evaluate(() => window.released.length), 12);
  });
  await check('a removed trigger falls back to the labelled surface control', async page => {
    await page.evaluate(() => { window.host.open('modal-one'); document.getElementById('trigger').remove(); });
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'clickdummy-surface');
  });
  await check('reentrant closure during mounting immediately releases the returned frame', async page => {
    assert.equal(await page.evaluate(() => { window.mode = 'reentrant'; return window.host.open('modal-one'); }), false);
    assert.equal(await page.locator('dialog').count(), 0); assert.deepEqual(await page.evaluate(() => window.released), ['modal-one']);
  });
  await check('repeated open and close never double-disposes or retains a dialog', async page => {
    await page.evaluate(() => { for (let index = 0; index < 30; index++) { window.host.open('modal-' + index); window.host.closeAll(); window.host.closeAll(); } });
    assert.equal(await page.locator('dialog').count(), 0); assert.equal(await page.evaluate(() => window.released.length), 30);
  });
  await check('showModal failure is contained without mounting a frame', async page => {
    const opened = await page.evaluate(() => {
      const original = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = () => { throw new Error('private cause'); };
      try { return window.host.open('modal-one'); } finally { HTMLDialogElement.prototype.showModal = original; }
    });
    assert.equal(opened, false); assert.equal(await page.locator('dialog').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.released), []);
  });
  await check('per-open mount override uses the common owned teardown', async page => {
    const result = await page.evaluate(() => {
      let acquired = 0, released = 0;
      window.host.open('modal-one', target => { target.textContent = 'Scenario frame'; acquired++; return () => { released++; }; });
      const label = document.querySelector('dialog').textContent;
      window.host.closeAll(); window.host.closeAll();
      return { acquired, released, defaultReleases: window.released, label };
    });
    assert.equal(result.acquired, 1); assert.equal(result.released, 1);
    assert.deepEqual(result.defaultReleases, []); assert.match(result.label, /Scenario frame/);
    assert.equal(await page.locator('dialog').count(), 0);
  });
  await check('browser page lifecycle resumes once and detaches after disposal', async page => {
    const result = await page.evaluate(() => {
      let mounts = 0, releases = 0; const lifecycle = window.hostApi.createPreviewLifecycle(window, {
        mount() { mounts++; return () => { releases++; }; }, closeDialogs: window.host.closeAll, error: message => window.messages.push(message),
      });
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      lifecycle.dispose(); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      return { mounts, releases };
    });
    assert.deepEqual(result, { mounts: 2, releases: 2 });
  });
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', scope: 'Emitted browser host, real dialogs and explicit frame doubles; synthetic page-transition events are not real bfcache acceptance', browser: browser.version(), sourceSha256: createHash('sha256').update(source).digest('hex'), cases, externalRequests: network.length, pageErrors: errors.length }));
  await context.close();
} finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
