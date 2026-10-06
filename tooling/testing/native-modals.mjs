import { noteNativePhase } from './native-diagnostic-observer.mjs';
import { expect } from '@playwright/test';
import { join } from 'node:path';
import { assertDiagnostics } from './native-header-checks.mjs';
/** Actual native Modal keyboard/owner behavior; no DOM substitute or test service. */
export async function qualifyModals(page, report, output, identity) {
  const owned = page.locator(identity.viewSelector).first(); noteNativePhase(report, 'native-modal-services');
  const infoTrigger = owned.getByRole('button', { name: 'Open native modal', exact: true }); await infoTrigger.focus(); await infoTrigger.press('Enter');
  const info = page.locator('.modal').filter({ hasText: 'One view, two environments' }); await expect(info).toBeVisible();
  await page.keyboard.press('Escape'); await expect(info).toHaveCount(0); await expect(infoTrigger).toBeFocused();
  report.checks.push('native-modal-opens-and-dismisses');
  const confirmTrigger = owned.getByRole('button', { name: 'Confirm an example', exact: true }); await confirmTrigger.focus(); await confirmTrigger.press('Enter');
  const confirmation = page.locator('.modal').filter({ hasText: 'Confirm an example' }); await expect(confirmation).toBeVisible();
  await expect(confirmation.locator('button[type="submit"]')).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab'); expect(await confirmation.evaluate(el => el.contains(el.ownerDocument.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await expect(confirmation).toHaveCount(0); await expect(confirmTrigger).toBeFocused();
  await expect(owned.getByText('Example cancelled. No documents changed.', { exact: true })).toBeVisible();
  await confirmTrigger.press('Enter'); await confirmation.locator('button[type="submit"]').press('Enter');
  await expect(confirmation).toHaveCount(0); await expect(confirmTrigger).toBeFocused();
  report.checks.push('native-modal-confirmation-keyboard-containment-cancellation-and-focus-return');
  const promptTrigger = owned.getByRole('button', { name: 'Try a text prompt', exact: true }); await promptTrigger.click();
  const prompt = page.locator('.modal').filter({ hasText: 'Try a text prompt' }); const input = prompt.getByRole('textbox', { name: 'Example text', exact: true });
  await expect(input).toBeFocused(); await input.press('Enter'); await expect(prompt.getByRole('alert')).toHaveText('Enter a short, non-empty value.');
  await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(input).toBeFocused();
  await input.fill('Synthetic native prompt'); await prompt.screenshot({ path: join(output, 'native-modal-prompt.png') }); await input.press('Enter');
  await expect(prompt).toHaveCount(0); await expect(promptTrigger).toBeFocused();
  await expect(owned.getByText('Example confirmed. No documents changed.', { exact: true })).toBeVisible();
  report.checks.push('native-modal-prompt-validation-confirmation-and-owned-focus-return');
  await assertDiagnostics(page, identity);
}
