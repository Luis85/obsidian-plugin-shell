import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import '../../harness/app/test-api';

async function scan(page: Page) {
  // Native-looking harness frames are excluded; every owned root AND open overlay is included.
  const result = await new AxeBuilder({ page }).include('[data-plugin-ui]').include('dialog[open]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) }));
}
test('[A11Y-01] all real panels in both host themes and an open validation dialog have no scanner findings', async ({ page }) => {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  for (const theme of ['light', 'dark']) {
    await page.locator(`#theme-${theme}`).click();
    for (const name of ['Overview', 'Documents', 'Events & feedback', 'Preferences']) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await scan(page), `${theme}/${name}`).toEqual([]);
    }
  }
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); expect(await scan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Try a text prompt', exact: true });
  await trigger.focus(); await trigger.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});
test('[A11Y-02] scan catches an unlabeled control in a real opened overlay', async ({ page }) => {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Try a text prompt', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').evaluate(dialog => { const button = document.createElement('button'); button.type = 'button'; button.dataset.negativeControl = 'true'; dialog.append(button); });
  expect((await scan(page)).some(item => item.id === 'button-name')).toBe(true);
  await page.locator('[data-negative-control]').evaluate(element => element.remove());
  expect(await scan(page)).toEqual([]); await page.keyboard.press('Escape');
});
test('[A11Y-03] German narrow view, reduced motion and forced colors remain keyboard usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('de');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Einstellungen speichern', exact: true })).toBeVisible();
  const header = page.locator('.shell-form input[type="checkbox"]').first();
  await header.focus(); await expect(header).toBeFocused(); await header.press('Space');
  await expect(header).toBeChecked();
  expect(await scan(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => window.__SHELL_TEST__.faults)).toEqual([]);
});
