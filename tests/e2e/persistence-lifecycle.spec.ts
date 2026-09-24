import { test, expect, type Page } from '@playwright/test';
import { instrument, ready, writes, stored, ledger, preview, prefix, itemEnvelope } from './persistence-lifecycle-fixture';

const observed = new WeakMap<Page, string[]>();
const expectedFaults = new WeakMap<Page, { code: string; operation: string }[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; observed.set(page, errors); expectedFaults.set(page, []);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(observed.get(page)).toEqual([]); await ledger(page, expectedFaults.get(page)); });

for (const [name, raw] of [
  ['corrupt JSON', '{"schemaVersion":1,"private":"do not replace"'],
  ['future envelope', '{ "schemaVersion": 999, "private": ["preserve", 17] }'],
] as const) test(`[PL-B07] ${name} retains exact raw bytes and disables durable mutations across reload`, async ({ page }) => {
  const faults = [{ code: 'settings.read', operation: 'settings.load' }]; expectedFaults.set(page, faults);
  await instrument(page, raw); await ready(page);
  const primary = page.locator('[data-leaf="primary"]');
  for (let load = 0; load < 2; load++) {
    await primary.getByRole('button', { name: 'Preferences', exact: true }).click();
    await expect(primary.getByRole('button', { name: 'Save preferences', exact: true })).toBeDisabled();
    await expect(primary.getByLabel('Task note folder', { exact: true })).toBeDisabled();
    await expect(primary.getByRole('alert')).toContainText('Saving is disabled');
    await primary.getByRole('button', { name: 'Documents', exact: true }).click();
    const items = primary.getByTestId('items-repository');
    await expect(items.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
    await expect(items.getByRole('textbox', { name: 'New item label', exact: true })).toBeDisabled();
    await expect(items.getByRole('alert')).toContainText('Stored plugin data is protected');
    expect(await stored(page)).toBe(raw); expect(await writes(page, 'settings')).toEqual([]);
    expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({}); await ledger(page, faults);
    if (load === 0) { await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); }
  }
});

for (const scope of ['registry', 'collection'] as const) test(`[PL-B07] future ${scope} disables Items while preference saves preserve its opaque payload`, async ({ page }) => {
  const pluginEntities = scope === 'registry' ? { schemaVersion: 99, collections: { future: { untouched: ['private', 7] } } }
    : { schemaVersion: 1, collections: { item: { schemaVersion: 99, revision: 42, records: [{ opaque: ['private', 7] }] } } };
  const initial = { schemaVersion: 1, preferences: { hideObsidianViewHeader: false, locale: 'en', taskFolder: 'Tasks', notifySuccess: true }, pluginEntities, extension: { keep: true } };
  await instrument(page, JSON.stringify(initial)); await ready(page);
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  await expect(page.getByTestId('items-repository').getByRole('alert')).toContainText('Stored entity data is invalid');
  expect(await stored(page)).toBe(JSON.stringify(initial)); expect(await writes(page, 'settings')).toEqual([]);
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Task note folder', { exact: true }).fill('Reviewed/Tasks');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByLabel('Task note folder', { exact: true })).toBeEnabled();
  const saved = JSON.stringify({ ...initial, preferences: { ...initial.preferences, taskFolder: 'Reviewed/Tasks' } });
  expect(await writes(page, 'settings')).toEqual([{ key: `${prefix}settings`, value: saved }]); expect(await stored(page)).toBe(saved);
  await ledger(page); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Task note folder', { exact: true })).toHaveValue('Reviewed/Tasks');
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  expect(await stored(page)).toBe(saved); expect(await writes(page, 'settings')).toEqual([]);
});

for (const phase of ['before', 'after'] as const) test(`[PL-B05] rejected shared save ${phase} persistence retains drafts and reconstructs only actual bytes`, async ({ page }) => {
  const initial = itemEnvelope('retained-id', 'Existing item'); const original = JSON.stringify(initial);
  await instrument(page, original); await ready(page); await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  const primary = page.locator('[data-leaf="primary"]'); const secondary = page.locator('[data-leaf="secondary"]');
  for (const root of [primary, secondary]) await root.getByRole('button', { name: 'Documents', exact: true }).click();
  const first = primary.getByTestId('items-repository'); const sibling = secondary.getByTestId('items-repository');
  await first.getByRole('textbox', { name: 'New item label', exact: true }).fill('Preserved private draft');
  await sibling.getByRole('textbox', { name: 'New item label', exact: true }).fill('Sibling draft');
  const id = await page.evaluate(key => `demo-${String(Number(localStorage.getItem(key) ?? '0') + 1).padStart(4, '0')}`, `${prefix}sequence`);
  await page.evaluate(phase => { window.__PL_SAVE_FAILURE__ = phase; }, phase);
  await first.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(first.getByRole('alert')).toContainText('save outcome is uncertain');
  await expect(first.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  await expect(first.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Preserved private draft');
  await expect(first.getByRole('status')).toHaveCount(0); await expect(sibling.getByRole('button', { name: 'Edit item: Preserved private draft', exact: true })).toHaveCount(0);
  await sibling.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(sibling.getByRole('alert')).toContainText('Stored plugin data is protected');
  await expect(sibling.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Sibling draft');
  const next = itemEnvelope(id, 'Preserved private draft'); next.pluginEntities.collections.item.revision = 2;
  const added = next.pluginEntities.collections.item.records[0]; if (!added) throw new Error('Missing expected new record'); added.revision = 2;
  next.pluginEntities.collections.item.records.unshift(...initial.pluginEntities.collections.item.records);
  const attempted = JSON.stringify(next);
  expect(await writes(page, 'settings')).toEqual([{ key: `${prefix}settings`, value: attempted }]);
  expect(await stored(page)).toBe(phase === 'after' ? attempted : original);
  await expect(sibling.getByRole('button', { name: 'Edit item: Existing item', exact: true })).toBeVisible();
  const faults = [{ code: 'settings.write', operation: 'settings.save' }]; expectedFaults.set(page, faults); await ledger(page, faults);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expectedFaults.set(page, []);
  await expect(first.getByRole('button', { name: 'Edit item: Preserved private draft', exact: true })).toHaveCount(phase === 'after' ? 1 : 0);
  expect(await stored(page)).toBe(phase === 'after' ? attempted : original); expect(await writes(page, 'settings')).toEqual([]);
  await expect(first.getByRole('button', { name: 'Edit item: Existing item', exact: true })).toBeVisible();
  await first.getByRole('textbox', { name: 'New item label', exact: true }).fill('Deliberate recovered action');
  await first.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(first.getByRole('status')).toHaveText('Item created.'); expect(await writes(page, 'settings')).toHaveLength(1);
});

test('[PL-B62] cancelled preview and closed writing owner preserve exact Markdown and live sibling draft', async ({ page }) => {
  await instrument(page); await ready(page); await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  const primary = page.locator('[data-leaf="primary"]'); const writer = page.locator('[data-leaf="secondary"]');
  for (const root of [primary, writer]) await root.getByRole('button', { name: 'Documents', exact: true }).click();
  await primary.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true }).fill('Sibling private draft');
  await preview(writer, 'Cancelled note'); await writer.getByRole('button', { name: 'Back to editing', exact: true }).click();
  expect(await writes(page, 'files')).toEqual([]); expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({});
  const bytes = await preview(writer, 'Committed after close');
  await page.evaluate(() => window.__SHELL_TEST__.fault('write-pause'));
  await writer.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(writer.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled();
  expect(await writes(page, 'files')).toEqual([]);
  await page.evaluate(() => window.__SHELL_TEST__.closeSecond()); const baseline = await page.evaluate(() => window.__SHELL_TEST__.resources());
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await primary.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await expect(primary.locator('.shell-event-table')).toContainText('documents.created');
  await primary.getByRole('button', { name: 'Documents', exact: true }).click(); await primary.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await expect(primary.getByRole('button', { name: 'Edit Committed after close', exact: true })).toBeVisible();
  await expect(primary.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Sibling private draft');
  await expect(writer).toHaveCount(0); expect(await page.evaluate(() => window.__SHELL_TEST__.resources())).toEqual(baseline);
  const files = { 'Tasks/Committed after close.md': bytes };
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(files);
  expect(await writes(page, 'files')).toEqual([{ key: `${prefix}files`, value: JSON.stringify(files) }]);
  await ledger(page); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(files); expect(await writes(page, 'files')).toEqual([]);
});

test('[PL-B66] open-only recovery ignores stale and disposed completions without recreating Markdown', async ({ page }) => {
  await instrument(page); await ready(page);
  const root = page.locator('[data-leaf="primary"]'); await root.getByRole('button', { name: 'Documents', exact: true }).click();
  const bytes = await preview(root, 'Open recovery'); await root.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(root.getByText('Task note created', { exact: true })).toBeVisible();
  await page.evaluate(() => window.__SHELL_TEST__.fault('open'));
  await root.getByRole('button', { name: 'Open created note', exact: true }).click();
  await expect(root.locator('.shell-document-grid').getByRole('alert')).toContainText('could not be opened');
  await page.evaluate(() => window.__SHELL_TEST__.fault('open-pause'));
  await root.getByRole('button', { name: 'Open created note', exact: true }).click();
  await expect(root.getByRole('button', { name: 'Open created note', exact: true })).toBeDisabled();
  await root.getByRole('button', { name: 'Create another', exact: true }).click(); await preview(root, 'New draft');
  await page.evaluate(() => window.__SHELL_TEST__.fault('open'));
  await expect(root.locator('.shell-document-grid').getByRole('alert')).toHaveCount(0);
  await expect(root.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('New draft');
  expect((await page.evaluate(() => window.__SHELL_TEST__.resources())).openCalls).toBe(2);
  await page.evaluate(() => window.__SHELL_TEST__.mountSecond()); const secondary = page.locator('[data-leaf="secondary"]');
  await secondary.getByRole('button', { name: 'Documents', exact: true }).click();
  const other = await preview(secondary, 'Disposed open'); await secondary.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await page.evaluate(() => window.__SHELL_TEST__.fault('open-pause'));
  await secondary.getByRole('button', { name: 'Open created note', exact: true }).evaluate(button => { if (button instanceof HTMLButtonElement) window.__PL_RETAINED_BUTTON__ = button; });
  await secondary.getByRole('button', { name: 'Open created note', exact: true }).click();
  await page.evaluate(() => { window.__SHELL_TEST__.closeSecond(); window.__SHELL_TEST__.fault('open'); window.__PL_RETAINED_BUTTON__?.click(); });
  await expect(secondary).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await page.evaluate(() => window.__SHELL_TEST__.resources())).openCalls).toBe(3);
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({ 'Tasks/Open recovery.md': bytes, 'Tasks/Disposed open.md': other });
  expect(await writes(page, 'files')).toHaveLength(2);
});

test('[PL-B11-71] twenty served view cycles release measured owned timers dialogs notices and subscriptions', async ({ page }) => {
  await instrument(page); await ready(page);
  const primary = page.locator('[data-leaf="primary"]'); await primary.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.evaluate(() => { const sentinel = document.createElement('div'); sentinel.id = 'unrelated-notice'; sentinel.textContent = 'Other owner'; document.body.append(sentinel); });
  const baseline = await page.evaluate(() => window.__SHELL_TEST__.resources());
  expect(baseline).toMatchObject({ leaves: 1, timers: 0, dialogs: 0, notices: 0, actions: 0 });
  for (let cycle = 0; cycle < 20; cycle++) {
    await page.evaluate(() => window.__SHELL_TEST__.mountSecond()); const secondary = page.locator('[data-leaf="secondary"]');
    await secondary.getByRole('button', { name: 'Events & feedback', exact: true }).click();
    await secondary.getByRole('button', { name: 'Show a native notice', exact: true }).click();
    await secondary.getByRole('button', { name: 'Confirm an example', exact: true }).click();
    const active = await page.evaluate(() => window.__SHELL_TEST__.resources());
    expect(active).toMatchObject({ leaves: 2, timers: 1, dialogs: 1, notices: 1, actions: 0 }); expect(active.subscriptions).toBeGreaterThan(baseline.subscriptions);
    await page.evaluate(() => { window.__SHELL_TEST__.closeSecond(); window.__SHELL_TEST__.closeSecond(); });
    await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.harness-native-notice')).toHaveCount(0);
    expect(await page.evaluate(() => window.__SHELL_TEST__.resources())).toEqual(baseline);
    await primary.getByRole('button', { name: 'Publish a typed event', exact: true }).click();
    await expect(primary.locator('.shell-event-table')).toContainText(String(cycle + 1).padStart(3, '0'));
  }
  await ledger(page); await page.evaluate(() => window.__SHELL_TEST__.dispose());
  expect(await page.evaluate(() => window.__SHELL_TEST__.resources())).toEqual({ timers: 0, dialogs: 0, notices: 0, actions: 0, openDialogs: 0, openCalls: 0, subscriptions: 0, leaves: 0 });
  await expect(page.locator('#unrelated-notice')).toHaveText('Other owner');
});

test('[PL-B46] committed facts refresh two views without crossing an independently mounted browser runtime', async ({ page, context }) => {
  await instrument(page); await ready(page); const independent = await context.newPage(); const errors: string[] = [];
  independent.on('pageerror', error => errors.push(error.message));
  independent.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await instrument(independent); await ready(independent); await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
    const primary = page.locator('[data-leaf="primary"]'); const secondary = page.locator('[data-leaf="secondary"]');
    for (const root of [primary, secondary]) await root.getByRole('button', { name: 'Documents', exact: true }).click();
    await independent.getByRole('button', { name: 'Documents', exact: true }).click();
    await secondary.getByTestId('items-repository').getByRole('textbox', { name: 'New item label', exact: true }).fill('Sibling draft');
    const id = await page.evaluate(key => `demo-${String(Number(localStorage.getItem(key) ?? '0') + 1).padStart(4, '0')}`, `${prefix}sequence`);
    await primary.getByTestId('items-repository').getByRole('textbox', { name: 'New item label', exact: true }).fill('Owned runtime item');
    await page.evaluate(() => window.__SHELL_TEST__.fault('settings-pause'));
    await primary.getByRole('button', { name: 'Create item', exact: true }).click();
    await expect(secondary.getByRole('button', { name: 'Edit item: Owned runtime item', exact: true })).toHaveCount(0);
    expect(await writes(page, 'settings')).toEqual([]);
    await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
    for (const root of [primary, secondary]) await expect(root.getByRole('button', { name: 'Edit item: Owned runtime item', exact: true })).toBeVisible();
    await expect(secondary.getByTestId('items-repository').getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Sibling draft');
    await expect(independent.getByRole('button', { name: 'Edit item: Owned runtime item', exact: true })).toHaveCount(0);
    await expect(independent.getByTestId('items-repository').getByRole('status')).toHaveCount(0);
    const bytes = JSON.stringify(itemEnvelope(id, 'Owned runtime item'));
    expect(await stored(page)).toBe(bytes); expect(await writes(page, 'settings')).toEqual([{ key: `${prefix}settings`, value: bytes }]);
    expect(await writes(independent, 'settings')).toEqual([]); await ledger(independent); expect(errors).toEqual([]);
    await independent.reload(); await expect(independent.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(independent.getByRole('button', { name: 'Edit item: Owned runtime item', exact: true })).toBeVisible();
    expect(await writes(independent, 'settings')).toEqual([]); await ledger(independent); expect(errors).toEqual([]);
  } finally { await independent.close(); }
});
