import { test, expect, type Page } from '@playwright/test';
import '../../harness/app/test-api';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const observed: string[] = []; errors.set(page, observed);
  page.on('pageerror', error => observed.push(error.message));
  page.on('console', message => { if (message.type() === 'error') observed.push(message.text()); });
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4180' ? route.continue() : route.abort());
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => window.__SHELL_TEST__?.faults ?? [])).toEqual([]);
});
test('[UI-02-PENDING] controlled header checkbox waits for the actual persistence barrier', async ({ page }) => {
  await page.goto('/harness/app/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  const toggle = page.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true });
  const header = page.locator('[data-leaf="primary"] > .view-header');
  await expect(toggle).not.toBeChecked(); await expect(header).toBeVisible();
  await page.evaluate(() => window.__SHELL_TEST__.fault('settings-pause'));
  await toggle.click();
  await expect(toggle).toBeDisabled(); await expect(toggle).not.toBeChecked();
  await expect(page.getByText('Saving header preference…', { exact: true })).toBeVisible();
  await expect(header).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('plugin-shell:harness:v1:settings'))).toBeNull();
  await page.evaluate(() => window.__SHELL_TEST__.fault('none'));
  await expect(toggle).toBeChecked(); await expect(toggle).toBeEnabled();
  await expect(header).toBeHidden();
  await expect(page.getByText('Saving header preference…', { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(toggle).toBeChecked(); await expect(header).toBeHidden();
});
