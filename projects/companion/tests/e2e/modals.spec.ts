import { test, expect } from '@playwright/test';
import '../../harness/app/test-api';
test('[MODAL-E2E-01] real service dialogs validate, contain keyboard focus, cancel and restore their trigger without writes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  const confirmTrigger = page.getByRole('button', { name: 'Confirm an example', exact: true });
  await confirmTrigger.focus(); await confirmTrigger.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Confirm an example', exact: true }); await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Confirm', exact: true })).toBeFocused();
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); expect(await confirm.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(confirm).toHaveCount(0); await expect(confirmTrigger).toBeFocused();
  await expect(page.getByText('Example cancelled. No documents changed.', { exact: true })).toBeVisible();
  await confirmTrigger.press('Enter'); await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(confirmTrigger).toBeFocused();
  const promptTrigger = page.getByRole('button', { name: 'Try a text prompt', exact: true }); await promptTrigger.click();
  const prompt = page.getByRole('dialog', { name: 'Try a text prompt', exact: true }); const field = prompt.getByRole('textbox', { name: 'Example text', exact: true });
  await expect(field).toBeFocused(); await field.press('Enter'); await expect(prompt.getByRole('alert')).toHaveText('Enter a short, non-empty value.');
  await expect(field).toHaveAttribute('aria-invalid', 'true'); await expect(field).toBeFocused(); await field.fill('<synthetic value>'); await field.press('Enter');
  await expect(prompt).toHaveCount(0); await expect(promptTrigger).toBeFocused();
  await expect(page.getByText('Example confirmed. No documents changed.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({}); expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]); expect(errors).toEqual([]);
});
