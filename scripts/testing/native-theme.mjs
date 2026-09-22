import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { nativeCommand } from './native-command.mjs';
/** Change the real supported Appearance setting; do not invent private theme IDs/commands. */
export async function setNativeTheme(page, context, theme) {
  if (!['light', 'dark'].includes(theme)) throw new Error('INVALID_THEME_TEST');
  let settingsPage;
  for (const candidate of context.pages()) {
    if (await candidate.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Appearance$/i }).count()) settingsPage = candidate;
  }
  if (!settingsPage) await nativeCommand(page, 'Open settings');
  await expect.poll(async () => {
    settingsPage = undefined;
    for (const candidate of context.pages()) {
      if (await candidate.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Appearance$/i }).count()) {
        if (settingsPage) throw new Error('MULTIPLE_SETTINGS_WINDOWS');
        settingsPage = candidate;
      }
    }
    return !!settingsPage;
  }, { timeout: 15000 }).toBe(true);
  await settingsPage.bringToFront();
  await settingsPage.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Appearance$/i }).click();
  // A grouped native setting can contain both scheme and theme selectors. Match the actual options.
  const controls = settingsPage.locator('select:visible');
  writeFileSync('reports/native/theme-controls.json', JSON.stringify(await controls.evaluateAll(elements => elements.map(el => ({ options: Array.from(el.options).map(option => ({ label: option.label, value: option.value })) }))), null, 2));
  const scheme = controls.filter({ has: settingsPage.locator('option').filter({ hasText: /^Dark$/i }) });
  await expect(scheme).toHaveCount(1);
  const value = await scheme.evaluate((el, target) => {
    const matches = Array.from(el.options).filter(option => option.label.trim().toLowerCase() === target);
    if (matches.length !== 1) throw new Error('NATIVE_SCHEME_OPTION_UNAVAILABLE');
    return matches[0].value;
  }, theme);
  // Real keyboard input avoids synthetic cross-realm select events in a native settings window.
  const targetIndex = await scheme.evaluate((el, target) => Array.from(el.options).findIndex(option => option.value === target), value);
  await scheme.focus(); await scheme.press('Home');
  for (let index = 0; index < targetIndex; index++) await scheme.press('ArrowDown');
  await scheme.press('Tab'); await expect(scheme).toHaveValue(value);
  await settingsPage.screenshot({ path: `reports/native/native-appearance-${theme}.png` });
  await expect(page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
  // Retain the real settings window for subsequent transitions. Await the host's paint work
  // rather than closing its realm immediately after a class mutation. It is closed once by
  // normal host controls after the theme scenarios; no errors are ignored.
  await settingsPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (settingsPage === page) {
    await settingsPage.keyboard.press('Escape');
    await expect(settingsPage.locator('.vertical-tab-nav-item:visible').filter({ hasText: /^Appearance$/i })).toHaveCount(0);
  }
  await page.bringToFront();
}
