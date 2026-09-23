import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pendingNativeData } from './native-data.mjs';
import { sha256 } from './source-inputs.mjs';

const collection = data => data?.pluginEntities?.collections?.item;
async function observeWrites(page, identity) {
  // Driver-owned read-only observation of the real persistence boundary. Calls still reach native saveData unchanged.
  await page.evaluate(id => {
    const plugin = window.app.plugins.plugins[id]; const original = plugin.saveData;
    const observation = { calls: 0, active: 0, maximumActive: 0, failures: 0 };
    plugin.saveData = async function (value) {
      observation.calls++; observation.active++; observation.maximumActive = Math.max(observation.maximumActive, observation.active);
      try { return await original.call(this, value); } catch (error) { observation.failures++; throw error; }
      finally { observation.active--; }
    };
    window.__qualificationItems = { observation, restore: () => { plugin.saveData = original; } };
  }, identity.id);
  return { counts: () => page.evaluate(() => ({ ...window.__qualificationItems.observation })),
    restore: () => page.evaluate(() => { window.__qualificationItems?.restore(); delete window.__qualificationItems; }) };
}
export async function qualifyItems(page, report, output, vault, identity) {
  report.phase = 'native-items';
  const path = join(vault, identity.pluginDirectory, 'data.json');
  const owned = page.locator(identity.viewSelector).first();
  const observation = await observeWrites(page, identity); const counts = observation.counts;
  const persisted = async count => {
    await expect.poll(async () => collection(await pendingNativeData(path))?.records.length).toBe(count);
    return pendingNativeData(path);
  };
  let sibling;
  try {
    await owned.getByRole('button', { name: 'Documents', exact: true }).click();
    const panel = owned.getByTestId('items-repository');
    await expect(panel).toContainText('No items yet.');
    for (const invalid of ['   ', 'x'.repeat(121)]) {
      await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill(invalid);
      await panel.getByRole('button', { name: 'Create item', exact: true }).click();
      await expect(panel.getByRole('alert')).toContainText('1–120 characters');
      expect((await counts()).calls).toBe(0);
    }
    await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill('  Native item  ');
    await panel.getByRole('button', { name: 'Create item', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Item created.');
    const created = collection(await persisted(1)).records[0];
    expect(created.values).toEqual({ label: 'Native item' }); expect((await counts()).calls).toBe(1);
    report.checks.push('native-items-invalid-and-trimmed-create-one-write');

    await owned.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.locator('.menu-item').filter({ hasText: 'Open showcase in a split' }).click();
    await expect(page.locator(identity.viewSelector)).toHaveCount(2);
    sibling = page.locator(identity.viewSelector).nth(1);
    await sibling.getByRole('button', { name: 'Documents', exact: true }).click();
    const other = sibling.getByTestId('items-repository');
    await expect(other.getByRole('button', { name: 'Edit item: Native item', exact: true })).toBeVisible();
    await other.getByRole('textbox', { name: 'New item label', exact: true }).fill('Independent native draft');
    await panel.getByRole('button', { name: 'Edit item: Native item', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Item label', exact: true }).fill('  Native renamed  ');
    await panel.getByRole('button', { name: 'Rename item', exact: true }).click();
    await expect(other.getByRole('button', { name: 'Edit item: Native renamed', exact: true })).toBeVisible();
    await expect(other.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Independent native draft');
    const renamed = collection(await persisted(1)).records[0];
    expect(renamed).toEqual({ ...created, revision: created.revision + 1, values: { label: 'Native renamed' } });
    expect((await counts()).calls).toBe(2);
    report.checks.push('native-items-stable-id-rename-two-view-projection-independent-draft');

    const beforeCancel = await readFile(path);
    await panel.getByRole('button', { name: 'Delete item…', exact: true }).click();
    const modal = page.locator('.modal').filter({ hasText: 'Delete this item?' });
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toHaveCount(0); expect(await readFile(path)).toEqual(beforeCancel); expect((await counts()).calls).toBe(2);
    await panel.getByRole('button', { name: 'Delete item…', exact: true }).click();
    await modal.getByRole('button', { name: 'Delete item', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('Item deleted.');
    await expect(other).toContainText('No items yet.'); await persisted(0); expect((await counts()).calls).toBe(3);
    report.checks.push('native-items-cancel-byte-preservation-confirmed-delete-one-write');

    await owned.getByRole('button', { name: 'Preferences', exact: true }).click();
    await owned.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true }).click();
    await other.getByRole('button', { name: 'Create item', exact: true }).click();
    await expect(other.getByRole('status')).toHaveText('Item created.');
    await expect.poll(async () => (await pendingNativeData(path))?.preferences?.hideObsidianViewHeader).toBe(true);
    const retained = collection(await persisted(1));
    expect(retained.records[0].values).toEqual({ label: 'Independent native draft' });
    expect(await counts()).toEqual({ calls: 5, active: 0, maximumActive: 1, failures: 0 });
    await owned.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true }).click();
    await expect.poll(async () => (await pendingNativeData(path))?.preferences?.hideObsidianViewHeader).toBe(false);
    expect(collection(await pendingNativeData(path))).toEqual(retained);
    report.items = { collection: retained, savedBytesSha256: sha256(await readFile(path)), writes: await counts(), mode: 'real-native-io-with-read-only-call-observer' };
    expect(report.items.writes).toEqual({ calls: 6, active: 0, maximumActive: 1, failures: 0 });
    report.checks.push('native-items-settings-entity-serialized-writes-retain-current-state');
    await page.screenshot({ path: join(output, 'native-items.png') });
  } catch (error) {
    await page.screenshot({ path: join(output, 'native-items-failure.png') }).catch(() => undefined);
    throw error;
  } finally {
    await observation.restore();
    if (sibling && await sibling.count()) {
      await sibling.getByRole('button', { name: 'View actions', exact: true }).click();
      await page.locator('.menu-item').filter({ hasText: 'Close this view' }).click();
    }
  }
  await owned.getByRole('button', { name: 'Overview', exact: true }).click();
}

export async function qualifyItemsRestart(page, report, vault, identity) {
  const owned = page.locator(identity.viewSelector).first();
  const path = join(vault, identity.pluginDirectory, 'data.json');
  expect(collection(await pendingNativeData(path))).toEqual(report.items.collection);
  const before = await readFile(path);
  const observation = await observeWrites(page, identity);
  try {
    await owned.getByRole('button', { name: 'Documents', exact: true }).click();
    const panel = owned.getByTestId('items-repository');
    await expect(panel.getByRole('button', { name: 'Edit item: Independent native draft', exact: true })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('');
    await panel.getByRole('button', { name: 'Reload items', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Your drafts are retained');
    expect(await readFile(path)).toEqual(before);
    report.items.restartQueryWrites = await observation.counts();
    expect(report.items.restartQueryWrites).toEqual({ calls: 0, active: 0, maximumActive: 0, failures: 0 });
  } finally { await observation.restore(); }
  report.checks.push('native-items-cold-restart-current-state-load-without-writes');
}
