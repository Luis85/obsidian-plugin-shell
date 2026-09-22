import { expect } from '@playwright/test';
/** Native commands can open their palette in the main window when invoked from a pop-out. */
export async function nativeCommand(page, label) {
  await page.bringToFront();
  const locate = async () => {
    const matches = [];
    for (const candidate of page.context().pages()) {
      if (await candidate.locator('input.prompt-input:visible').count()) matches.push(candidate);
    }
    if (matches.length > 1) throw new Error('MULTIPLE_NATIVE_COMMAND_PALETTES');
    return matches[0];
  };
  let owner = await locate();
  if (!owner) {
    // CDP tab activation is not necessarily OS focus while a separate native Settings
    // window is open. Click the actual palette ribbon; the initial native smoke also
    // verifies the keyboard shortcut before any secondary windows are created.
    let ribbon;
    for (const candidate of page.context().pages()) {
      const control = candidate.locator('[aria-label="Open command palette"]:visible');
      if (await control.count() === 1) { ribbon = control; break; }
    }
    if (ribbon) await ribbon.click();
    else await page.keyboard.press('ControlOrMeta+p');
  }
  await expect.poll(async () => { owner = await locate(); return !!owner; }, { timeout: 15000 }).toBe(true);
  await owner.locator('input.prompt-input:visible').fill(label);
  const option = owner.locator('.suggestion-item:visible').filter({ hasText: label });
  await expect(option).toHaveCount(1);
  await option.click();
  return owner;
}
