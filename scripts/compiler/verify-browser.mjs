/** Independent observable assertions against a built self-contained file, with external requests denied. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
const [path, projectPath, evidenceDirectory] = process.argv.slice(2);
if (!path || !projectPath) throw new Error('Supply the built clickdummy.html and its canonical design/project.json paths.');
const project = JSON.parse(await readFile(resolve(projectPath), 'utf8'));
const browser = await chromium.launch({ headless: true }); const errors = [], network = [], cases = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', route => {
    const url = route.request().url(); if (/^(?:file|data|blob):/.test(url)) return route.continue();
    network.push(url); return route.abort();
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(pathToFileURL(resolve(path)).href);
  await page.waitForFunction(() => document.documentElement.dataset.prototypeReady === 'true');
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), project.project.name);
  assert.match(await page.locator('.clickdummy-toolbar').innerText(), /synthetic read data.*business writes unavailable/);
  const nav = page.getByRole('navigation', { name: 'Project navigation' }); await nav.waitFor();
  const buttons = nav.getByRole('button'), count = await buttons.count(); assert.ok(count >= 2, 'navigation and Back are visible');
  const first = await nav.locator('[aria-current="page"]').textContent();
  for (let index = 0; index < count - 1; index++) {
    const button = buttons.nth(index); await button.click();
    await page.waitForFunction(() => Boolean(document.querySelector('nav [aria-current="page"]')));
    assert.equal(await button.getAttribute('aria-current'), 'page'); assert.ok(await page.locator('main').innerText());
  }
  if (count > 2) {
    await nav.getByRole('button', { name: 'Back', exact: true }).click();
    assert.notEqual(await nav.locator('[aria-current="page"]').textContent(), await buttons.nth(count - 2).textContent());
  }
  assert.ok(first); cases.push('declared navigation and contextual Back');
  // Accessible labels are intentional assertions, not incidental option text or CSS selectors.
  const surface = page.getByLabel('Browse surfaces', { exact: true }), state = page.getByLabel('Preview state', { exact: true });
  for (const value of ['loading', 'disabled', 'empty', 'error', 'default']) {
    await state.selectOption(value);
    assert.equal(await page.locator('main').evaluate(element => element.inert), ['loading', 'disabled'].includes(value));
  }
  cases.push('labelled preview states and inert loading/disabled content');
  const modalEdge = project.design.links.find(edge => ['open', 'navigate'].includes(edge.kind) &&
    project.design.nodes.some(node => node.id === edge.to && node.kind === 'modal'));
  assert.ok(modalEdge, 'the qualification project must contain a declared modal interaction');
  const modal = project.design.nodes.find(node => node.id === modalEdge.to);
  await surface.selectOption(modalEdge.from);
  const trigger = page.locator('main').getByRole('button', { name: modalEdge.label, exact: true });
  await trigger.click(); const dialog = page.getByRole('dialog', { name: modal.label, exact: true }); await dialog.waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
  await trigger.click(); await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await dialog.waitFor({ state: 'detached' }); assert.equal(await trigger.evaluate(element => document.activeElement === element), true);
  cases.push('declared modal, Escape, close button and trigger focus return');
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  assert.equal(await state.inputValue(), 'default'); assert.equal(await nav.locator('[aria-current="page"]').textContent(), first);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'clickdummy-reset');
  assert.equal(await page.getByRole('button', { name: 'Back', exact: true }).isDisabled(), true);
  cases.push('reset restores initial navigation, state and keyboard focus');
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Project JSON', exact: true }).click();
  const download = await downloaded; assert.deepEqual(JSON.parse(await readFile(await download.path(), 'utf8')), project); await download.delete();
  cases.push('export preserves the complete canonical project');
  await page.goto(pathToFileURL(resolve(path)).href + '#surface=' + encodeURIComponent(modalEdge.from));
  await page.waitForFunction(() => document.documentElement.dataset.prototypeReady === 'true');
  assert.equal(await surface.inputValue(), modalEdge.from); cases.push('file-origin surface deep link');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.equal(await page.locator('.clickdummy-preview').count(), 0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForFunction(() => document.documentElement.dataset.prototypeReady === 'true');
  assert.equal(await surface.inputValue(), modalEdge.from); await nav.waitFor(); cases.push('full-frame restoration after simulated page suspension');
  if (evidenceDirectory) await page.screenshot({ path: join(resolve(evidenceDirectory), 'preview-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'narrow preview has no horizontal overflow');
  for (const control of [surface, state, page.getByRole('button', { name: 'Reset preview', exact: true })]) {
    const box = await control.boundingBox(); assert.ok(box && box.height >= 36 && box.width > 0);
  }
  await surface.focus(); assert.equal(await surface.evaluate(element => document.activeElement === element), true);
  if (evidenceDirectory) await page.screenshot({ path: join(resolve(evidenceDirectory), 'preview-narrow.png'), fullPage: true });
  cases.push('375px toolbar reflow, keyboard access and minimum control height');
  assert.equal(await page.locator('.clickdummy-error').count(), 0);
  assert.deepEqual(network, [], 'no external asset/provider requests'); assert.deepEqual(errors, [], 'no runtime or console errors');
  console.log(JSON.stringify({ status: 'passed', scope: 'Offline generated preview interactions, export, reflow and simulated page restoration; no manual accessibility, real bfcache or business acceptance', browser: browser.version(), navigationTargets: count - 1, cases }));
  await context.close();
} finally { await browser.close(); }
