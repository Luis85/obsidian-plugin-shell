import { test, expect, type Page } from '@playwright/test';
import manifest from '../../manifest.json' with { type: 'json' };
import '../../harness/app/test-api';

async function open(page: Page) {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-leaf="primary"]').getByRole('button', { name: 'Documents', exact: true }).click();
  return page.locator('[data-leaf="primary"]').getByTestId('items-repository');
}
test('item UI validates, synchronizes two views, retains drafts and persists rename/delete through reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const panel = await open(page);
  await expect(panel).toContainText('No items yet.');
  await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill('   ');
  await panel.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('1–120 characters');
  expect(await page.evaluate(key => localStorage.getItem(key), `${manifest.id}:harness:v1:settings`)).toBeNull();
  await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill('  Shared item  ');
  await page.evaluate(() => window.__SHELL_TEST__.fault('settings-pause'));
  await panel.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  await expect(panel.getByRole('status')).toHaveText('Waiting for this action to finish…');
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await expect(panel.getByRole('status')).toHaveText('Item created.');
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(panel.getByRole('button', { name: 'Edit item: Shared item', exact: true })).toBeVisible();
  await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  const secondary = page.locator('[data-leaf="secondary"]');
  await secondary.getByRole('button', { name: 'Documents', exact: true }).click();
  const other = secondary.getByTestId('items-repository');
  await expect(other.getByRole('button', { name: 'Edit item: Shared item', exact: true })).toBeVisible();
  await other.getByRole('textbox', { name: 'New item label', exact: true }).fill('Second view draft');
  await panel.getByRole('button', { name: 'Edit item: Shared item', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Item label', exact: true }).fill('Renamed item');
  await panel.getByRole('button', { name: 'Rename item', exact: true }).click();
  await expect(other.getByRole('button', { name: 'Edit item: Renamed item', exact: true })).toBeVisible();
  await expect(other.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Second view draft');
  await page.evaluate(() => window.__SHELL_TEST__.closeSecond());
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await panel.screenshot({ path: `reports/e2e/harness-items-${width}.png` });
  }
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await panel.getByRole('button', { name: 'Edit item: Renamed item', exact: true }).click();
  await panel.getByRole('button', { name: 'Delete item…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Edit item: Renamed item', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Delete item…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete item', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Item deleted.');
  await expect(panel).toContainText('No items yet.');
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(panel).toContainText('No items yet.');
  await expect(panel.getByRole('button', { name: 'Edit item: Renamed item', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({});
  expect(errors).toEqual([]); expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});

test('item UI retains failed-write draft and recovers only after runtime reload', async ({ page }) => {
  const panel = await open(page);
  await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill('Preserve me');
  await page.evaluate(() => window.__SHELL_TEST__.fault('settings'));
  await panel.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('save outcome is uncertain');
  await expect(panel.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Preserve me');
  await expect(panel.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
  await expect(panel.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([{ code: 'settings.write', operation: 'settings.save' }]);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(panel.getByRole('button', { name: 'Create item', exact: true })).toBeEnabled();
  await panel.getByRole('textbox', { name: 'New item label', exact: true }).fill('Deliberate retry after reload');
  await panel.getByRole('button', { name: 'Create item', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Item created.');
});
