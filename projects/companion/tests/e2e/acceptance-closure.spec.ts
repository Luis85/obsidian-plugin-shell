import { test, expect, type Page } from '@playwright/test';
import manifest from '../../manifest.json' with { type: 'json' };
import '../../harness/app/test-api';

declare global {
  interface Window {
    __AC_WRITES__: { key: string; value: string }[];
    __AC_LOSE_FILE_ACK__: boolean;
  }
}
const prefix = `${manifest.id}:harness:v1:`;
const observed = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; observed.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(filesKey => {
    window.__AC_WRITES__ = []; window.__AC_LOSE_FILE_ACK__ = false;
    const persist = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage) window.__AC_WRITES__.push({ key, value });
      persist.call(this, key, value);
      if (this === localStorage && key === filesKey && window.__AC_LOSE_FILE_ACK__) {
        window.__AC_LOSE_FILE_ACK__ = false;
        throw new Error('Injected lost acknowledgment after actual browser persistence');
      }
    };
  }, `${prefix}files`);
});
test.afterEach(async ({ page }) => {
  expect(observed.get(page)).toEqual([]);
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});
async function open(page: Page) {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-leaf="primary"]').getByRole('button', { name: 'Documents', exact: true }).click();
}
async function preview(page: Page, title: string) {
  await page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true }).fill(title);
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  return page.getByTestId('markdown-preview').innerText();
}
async function writes(page: Page, name: string) {
  return page.evaluate(key => window.__AC_WRITES__.filter(entry => entry.key === key), `${prefix}${name}`);
}

test('[AC-CLOSE-06] overlapping item and preference saves retain exact envelope and independent drafts', async ({ page }) => {
  await open(page); await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  const primary = page.locator('[data-leaf="primary"]'); const secondary = page.locator('[data-leaf="secondary"]');
  await secondary.getByRole('button', { name: 'Documents', exact: true }).click();
  const first = primary.getByTestId('items-repository'); const second = secondary.getByTestId('items-repository');
  await first.getByRole('textbox', { name: 'New item label', exact: true }).fill('  Concurrent item  ');
  await second.getByRole('textbox', { name: 'New item label', exact: true }).fill('Sibling item draft');
  await secondary.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true }).fill('Sibling note draft');
  const itemId = await page.evaluate(key => `demo-${String(Number(localStorage.getItem(key) ?? '0') + 1).padStart(4, '0')}`, `${prefix}sequence`);
  await page.evaluate(() => window.__SHELL_TEST__.fault('settings-pause'));
  await first.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  await secondary.getByRole('button', { name: 'Preferences', exact: true }).click();
  await secondary.getByLabel('Task note folder', { exact: true }).fill('Concurrent/Tasks');
  await secondary.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(secondary.getByLabel('Task note folder', { exact: true })).toBeDisabled();
  expect(await writes(page, 'settings')).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), `${prefix}settings`)).toBeNull();
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await expect(first.getByRole('status')).toHaveText('Item created.');
  await expect(secondary.getByLabel('Task note folder', { exact: true })).toBeEnabled();
  const entities = { schemaVersion: 1, collections: { item: { schemaVersion: 1, revision: 1, records: [
    { id: itemId, revision: 1, createdAt: '2026-09-22T12:00:00.000Z', values: { label: 'Concurrent item' } },
  ] } } };
  const envelope = (taskFolder: string) => JSON.stringify({ schemaVersion: 1,
    preferences: { hideObsidianViewHeader: false, locale: 'en', taskFolder, notifySuccess: true }, pluginEntities: entities });
  expect(await writes(page, 'settings')).toEqual([
    { key: `${prefix}settings`, value: envelope('Tasks') }, { key: `${prefix}settings`, value: envelope('Concurrent/Tasks') },
  ]);
  expect(await page.evaluate(key => localStorage.getItem(key), `${prefix}settings`)).toBe(envelope('Concurrent/Tasks'));
  await expect(first.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('');
  await secondary.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Edit item: Concurrent item', exact: true })).toBeVisible();
  await expect(second.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Sibling item draft');
  await expect(secondary.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Sibling note draft');
  await page.evaluate(() => { window.__SHELL_TEST__.closeSecond(); window.__SHELL_TEST__.mountSecond(); });
  await secondary.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Edit item: Concurrent item', exact: true })).toBeVisible();
  await secondary.getByRole('button', { name: 'Preferences', exact: true }).click();
  await expect(secondary.getByLabel('Task note folder', { exact: true })).toHaveValue('Concurrent/Tasks');
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(key => localStorage.getItem(key), `${prefix}settings`)).toBe(envelope('Concurrent/Tasks'));
  await expect(primary.getByLabel('Task note folder', { exact: true })).toHaveValue('Concurrent/Tasks');
  await primary.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Edit item: Concurrent item', exact: true })).toBeVisible();
  expect(await writes(page, 'settings')).toEqual([]); expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({});
});

test('[AC-CLOSE-05-66] failed and uncertain creates preserve bytes and expose only safe recovery', async ({ page }) => {
  await open(page);
  const firstBytes = await preview(page, 'Existing note');
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create another', exact: true }).click();
  await preview(page, 'Deliberate recovery');
  await page.evaluate(() => window.__SHELL_TEST__.fault('write'));
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.locator('.shell-document-grid').getByRole('alert')).toHaveText('The note could not be saved. Check the destination and permissions.');
  await expect(page.getByText('Task note created', { exact: true })).toHaveCount(0);
  await expect(page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Deliberate recovery');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({ 'Tasks/Existing note.md': firstBytes });
  expect(await writes(page, 'files')).toHaveLength(1);
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const actualRecoveryBytes = await page.getByTestId('markdown-preview').innerText();
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const known = { 'Tasks/Existing note.md': firstBytes, 'Tasks/Deliberate recovery.md': actualRecoveryBytes };
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(known);
  await page.evaluate(() => window.__SHELL_TEST__.fault('open'));
  await page.getByRole('button', { name: 'Open created note', exact: true }).click();
  await expect(page.locator('.shell-document-grid').getByRole('alert')).toContainText('could not be opened');
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Task note', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await page.getByRole('button', { name: 'Open created note', exact: true }).click();
  await expect(page.getByRole('dialog').locator('pre')).toHaveText(actualRecoveryBytes);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  expect(await writes(page, 'files')).toHaveLength(2);
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(known);
  await page.getByRole('button', { name: 'Create another', exact: true }).click();
  const uncertainBytes = await preview(page, 'Lost acknowledgment');
  await page.evaluate(() => { window.__AC_LOSE_FILE_ACK__ = true; });
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.locator('.shell-document-grid').getByRole('alert')).toContainText('write result is uncertain');
  for (const name of ['Create Task note', 'Preview Markdown', 'Back to editing']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await expect(page.getByText('Task note created', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open created note', exact: true })).toHaveCount(0);
  await expect(page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Lost acknowledgment');
  const final = { ...known, 'Tasks/Lost acknowledgment.md': uncertainBytes };
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(final);
  expect(await writes(page, 'files')).toEqual([
    { key: `${prefix}files`, value: JSON.stringify({ 'Tasks/Existing note.md': firstBytes }) },
    { key: `${prefix}files`, value: JSON.stringify(known) }, { key: `${prefix}files`, value: JSON.stringify(final) },
  ]);
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(final); expect(await writes(page, 'files')).toEqual([]);
});
