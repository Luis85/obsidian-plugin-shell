import { test, expect } from '@playwright/test';
import { instrument, ready, ledger, writes } from './persistence-lifecycle-fixture';
import { retainNativeAction } from '../../scripts/testing/native-recovery-handles.mjs';

test('[RECOVERY-BROWSER] owned recovery completes, cancels and rejects a retained actual action after owner close', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await instrument(page); await ready(page); await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  const owner = page.locator('[data-leaf="secondary"]'); const sibling = page.locator('[data-leaf="primary"]');
  await owner.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await owner.getByRole('button', { name: 'Try owned recovery', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Owned recovery example', exact: true });
  await expect(modal).toBeVisible(); await expect(owner.getByRole('button', { name: 'Try owned recovery', exact: true })).toBeDisabled();
  await expect(page.locator('.harness-native-notice').filter({ hasText: 'Waiting for the example dialog' })).toBeVisible();
  await modal.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Review example result', exact: true }).click();
  await expect(page.locator('.harness-native-notice')).toHaveText('Example reviewed. No files changed.');
  await owner.getByRole('button', { name: 'Try owned recovery', exact: true }).click();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.harness-native-notice')).toHaveCount(0);
  await owner.getByRole('button', { name: 'Try owned recovery', exact: true }).click();
  const retained = await page.getByRole('button', { name: 'Review example result', exact: true }).evaluateHandle(element => {
    if (!(element instanceof HTMLButtonElement) || !element.onclick) throw new Error('MISSING_REAL_ACTION');
    const callback = element.onclick;
    return () => callback.call(element, new PointerEvent('click'));
  });
  let cdp: Awaited<ReturnType<typeof retainNativeAction>> | undefined;
  let primary: unknown; let failed = false;
  try {
    cdp = await retainNativeAction(page, 'Review example result', '.harness-native-notice button');
    await cdp.invoke();
    await expect(page.getByRole('button', { name: 'Review example result', exact: true })).toBeDisabled();
    await retained.evaluate(invoke => { invoke(); invoke(); });
    await page.evaluate(() => window.__SHELL_TEST__.closeSecond());
    await expect(modal).toHaveCount(0); await expect(page.locator('.harness-native-notice')).toHaveCount(0);
    const closed = await page.evaluate(() => window.__SHELL_TEST__.resources());
    expect(closed).toMatchObject({ timers: 0, dialogs: 0, notices: 0, actions: 0, leaves: 1 });
    await retained.evaluate(invoke => invoke());
    await cdp.invoke(); expect(cdp.calls()).toBe(2);
    expect(await page.evaluate(() => window.__SHELL_TEST__.resources())).toEqual(closed);
    await sibling.getByRole('button', { name: 'Events & feedback', exact: true }).click();
    await sibling.getByRole('button', { name: 'Publish a typed event', exact: true }).click();
    await expect(sibling.locator('.shell-event-table')).toContainText('showcase.ping');
    expect(await writes(page, 'settings')).toEqual([]); expect(await writes(page, 'files')).toEqual([]);
    expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({}); await ledger(page); expect(errors).toEqual([]);
  } catch (error) { primary = error; failed = true; }
  finally {
    const cleanup: unknown[] = [];
    for (const result of await Promise.allSettled([retained.dispose(), cdp?.dispose()])) if (result.status === 'rejected') cleanup.push(result.reason);
    if (cleanup.length) {
      const errors = failed ? [primary, ...cleanup] : cleanup;
      throw new AggregateError(errors, errors.map(error => error instanceof Error ? error.message : String(error)).join(' | '));
    }
    if (failed) throw primary;
  }
});
