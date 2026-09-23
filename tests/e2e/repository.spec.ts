import { test, expect, type Page } from '@playwright/test';
import '../../harness/app/test-api';
import manifest from '../../manifest.json' with { type: 'json' };
async function create(page: Page) {
  await page.goto('/harness/app/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true }).fill('Repository example');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Repository example', exact: true }).click();
}
test('[UI-03-E1] served repository CRUD persists status and preserves body before reversible trash', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await create(page);
  const before = await page.evaluate(() => window.__SHELL_TEST__.files());
  const path = Object.keys(before)[0]; if (!path) throw new Error('missing note');
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Revised title');
  await page.getByLabel('Status', { exact: true }).selectOption('done');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Task changes saved.', { exact: false })).toBeVisible();
  const after = await page.evaluate(() => window.__SHELL_TEST__.files());
  expect(Object.keys(after)).toEqual([path]); expect(after[path]).toContain('status: "done"');
  expect(after[path]?.split('---\n\n')[1]).toBe(before[path]?.split('---\n\n')[1]);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByTestId('task-repository').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByTestId('task-repository').screenshot({ path: `reports/e2e/harness-repository-${width}.png` });
  }
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Revised title', exact: true }).click();
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('done');
  await page.getByRole('button', { name: 'Move to trash…', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(Object.keys(await page.evaluate(() => window.__SHELL_TEST__.files()))).toHaveLength(1);
  await page.getByRole('button', { name: 'Move to trash…', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm move to trash', exact: true }).click();
  await expect(page.getByText('Task note moved to trash.', { exact: true })).toBeVisible();
  const trashed = await page.evaluate(() => window.__SHELL_TEST__.files());
  expect(trashed[path]).toBeUndefined();
  expect(trashed[`.trash/${path}`]).toContain('Revised title');
  expect(errors).toEqual([]); expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});
test('[UI-03-E2] manual edits block stale updates and survive reloading', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await create(page);
  await page.evaluate(key => {
    const files = window.__SHELL_TEST__.files(); const path = Object.keys(files)[0];
    if (!path) throw new Error('missing note'); files[path] += '\nManual content outside the app.\n';
    localStorage.setItem(key, JSON.stringify(files));
  }, `${manifest.id}:harness:v1:files`);
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Retain my draft');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByTestId('task-repository').getByRole('alert')).toContainText('Your draft is retained');
  await expect(page.getByRole('textbox', { name: 'Task title', exact: true })).toHaveValue('Retain my draft');
  await page.getByRole('button', { name: 'Reload notes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Repository example', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('doing');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Task changes saved.', { exact: false })).toBeVisible();
  expect(Object.values(await page.evaluate(() => window.__SHELL_TEST__.files()))[0]).toContain('Manual content outside the app.');
  expect(errors).toEqual([]); expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});
