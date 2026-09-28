/** Independent observable assertions against a built self-contained file, with external requests denied. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { visualNodes } from '../companion/visual/visual-ir.mjs';
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
  const scenarioPicker = page.getByLabel('Authored scenario', { exact: true });
  const authored = project.design.visualDesigns.pages.find(definition =>
    project.design.nodes.some(node => node.id === definition.ownerId && node.kind === 'page') &&
    definition.scenarios.some(scenario => scenario.bindings.some(binding => Array.isArray(binding.value) && binding.value.length)));
  assert.ok(authored, 'qualification requires an authored scenario with representative data');
  const nodes = visualNodes(authored.root), table = nodes.find(node => node.kind === 'component' && node.ref.entryId === 'u-table');
  assert.ok(table && table.props.data.kind === 'source' && table.props.data.field === '');
  const columns = table.props.columns.value.map(column => column.accessorKey);
  await surface.selectOption(authored.ownerId);
  const detail = page.locator('main .generated-detail').first();
  const rows = detail.locator('[data-design-node="' + table.id + '"] tbody tr');
  for (const scenario of authored.scenarios) {
    await scenarioPicker.selectOption(scenario.id);
    await expect(state).toHaveValue(scenario.state);
    await expect(detail).toHaveAttribute('data-design-state', scenario.state);
    const binding = scenario.bindings.find(item => item.sourceId === table.props.data.sourceId && item.operationId === table.props.data.operationId);
    assert.ok(binding && Array.isArray(binding.value));
    if (binding.value.length) {
      await expect(rows).toHaveCount(binding.value.length);
      for (let index = 0; index < binding.value.length; index++) {
        await expect(rows.nth(index).locator('td')).toHaveText(columns.map(key => String(binding.value[index][key] ?? '')));
      }
    } else {
      const firstValue = authored.scenarios.flatMap(item => item.bindings).find(item => Array.isArray(item.value) && item.value.length).value[0][columns[0]];
      await expect(detail).not.toContainText(String(firstValue));
    }
    await expect(page.locator('.clickdummy-preview > [role="status"]')).toContainText('no data is saved');
  }
  cases.push('every authored page scenario renders its canonical sample rows and state');
  const populated = authored.scenarios.find(scenario => scenario.state === 'default');
  assert.ok(populated);
  const inputNode = nodes.find(node => node.kind === 'component' && node.ref.entryId === 'u-input');
  const hook = nodes.find(node => node.kind === 'component' && node.events.some(event => event.event === 'click' && !event.actions.length));
  assert.ok(inputNode && hook);
  await scenarioPicker.selectOption(populated.id);
  const input = detail.locator('[data-design-node="' + inputNode.id + '"] input');
  await input.fill('Unsaved review draft');
  await detail.locator('[data-design-node="' + hook.id + '"]').click();
  await expect(detail).toContainText('The interaction could not be completed. Your input is retained.');
  await expect(detail).not.toContainText('Interaction implementation required.');
  await expect(input).toHaveValue('Unsaved review draft');
  await scenarioPicker.selectOption(authored.scenarios.find(scenario => scenario.id !== populated.id).id);
  await expect(input).not.toHaveValue('Unsaved review draft');
  const nextSurface = project.design.nodes.find(node => node.id !== authored.ownerId && node.kind === 'page');
  assert.ok(nextSurface); await surface.selectOption(nextSurface.id);
  await expect(scenarioPicker).toHaveValue(''); await expect(state).toHaveValue('default');
  await surface.selectOption(authored.ownerId); await expect(scenarioPicker).toHaveValue('');
  cases.push('scenario hooks are refused, drafts reset and selection never leaks to another surface');
  await scenarioPicker.selectOption(populated.id);
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  await expect(scenarioPicker).toHaveValue(''); await expect(state).toHaveValue('default');
  cases.push('reset clears scenario ownership');
  const modalEdge = project.design.links.find(edge => ['open', 'navigate'].includes(edge.kind) &&
    project.design.nodes.some(node => node.id === edge.to && node.kind === 'modal'));
  assert.ok(modalEdge, 'the qualification project must contain a declared modal interaction');
  const modal = project.design.nodes.find(node => node.id === modalEdge.to);
  await surface.selectOption(modalEdge.from);
  const parentDefinition = project.design.visualDesigns.pages.find(definition => definition.ownerId === modalEdge.from);
  const parentScenario = parentDefinition?.scenarios.find(scenario => scenario.state === 'default');
  const modalDefinition = project.design.visualDesigns.pages.find(definition => definition.ownerId === modalEdge.to);
  const modalHook = modalDefinition && visualNodes(modalDefinition.root).find(node => node.kind === 'component' && node.events.some(event => event.event === 'click' && !event.actions.length));
  assert.ok(parentScenario && modalHook, 'qualification requires a scenario opener and a nested business hook');
  await scenarioPicker.selectOption(parentScenario.id);
  const trigger = page.locator('main').getByRole('button', { name: modalEdge.label, exact: true });
  await trigger.click(); const dialog = page.getByRole('dialog', { name: modal.label, exact: true }); await dialog.waitFor();
  await dialog.locator('[data-design-node="' + modalHook.id + '"]').click();
  await expect(dialog).toContainText('The interaction could not be completed. Your input is retained.');
  await expect(dialog).not.toContainText('Interaction implementation required.');
  cases.push('modal inherits scenario read-only mode without a foreign sample binding');
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
  for (const control of [surface, state, scenarioPicker, page.getByRole('button', { name: 'Reset preview', exact: true })]) {
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
