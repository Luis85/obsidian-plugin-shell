import { noteNativePhase } from './native-diagnostic-observer.mjs';
import { expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeCommand } from './native-command.mjs';
import { pendingNativeData } from './native-data.mjs';

/** Serialized into the native renderer; the same driver helper is regression-tested without claiming host execution. */
export function installItemBoundary(id) {
    const plugin = window.app.plugins.plugins[id]; const original = plugin.saveData;
    const state = { calls: 0, completed: 0, failed: 0, active: 0, mode: 'pause', release: undefined };
    plugin.saveData = async function (value) {
      state.calls++; state.active++;
      try {
        if (state.mode === 'pause') await new Promise(resolve => { state.release = resolve; });
        if (state.mode === 'reject') throw new Error('QUALIFICATION_CONTROLLED_SAVE_REJECTION');
        await original.call(this, value); state.completed++;
      } catch (error) { state.failed++; throw error; }
      finally { state.active--; }
    };
    window.__qualificationItemBoundary = { state, restore: () => { state.mode = 'pass'; state.release?.(); plugin.saveData = original; } };
}
/** Actual native views with explicitly controlled persistence boundaries; injected failures are not native disk evidence. */
export async function qualifyItemOwnership(page, report, output, vault, identity) {
  noteNativePhase(report, 'native-items-controlled-adapter-ownership');
  report.itemOwnership = { mode: 'controlled-adapter-in-native-host', nativeDiskFailure: false, status: 'running' };
  let failed = false;
  const path = join(vault, identity.pluginDirectory, 'data.json'); const originalBytes = await readFile(path);
  await page.evaluate(installItemBoundary, identity.id);
  try {
    const first = page.locator(identity.viewSelector).first();
    await first.getByRole('button', { name: 'Documents', exact: true }).click();
    await first.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.locator('.menu-item').filter({ hasText: 'Open showcase in a split' }).click();
    await expect(page.locator(identity.viewSelector)).toHaveCount(2);
    const second = page.locator(identity.viewSelector).nth(1);
    await second.getByRole('button', { name: 'Documents', exact: true }).click();
    await second.getByRole('textbox', { name: 'New item label', exact: true }).fill('Retained sibling draft');
    await first.getByRole('textbox', { name: 'New item label', exact: true }).fill('Commit after native close');
    await first.getByRole('button', { name: 'Create item', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
    await expect(first.getByTestId('items-repository').getByRole('status')).toHaveText('Waiting for this action to finish…');
    await expect.poll(() => page.evaluate(() => window.__qualificationItemBoundary.state.active)).toBe(1);
    expect(await readFile(path)).toEqual(originalBytes);
    await first.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.locator('.menu-item').filter({ hasText: 'Close this view' }).click();
    await expect(page.locator(identity.viewSelector)).toHaveCount(1);
    await page.evaluate(() => { const state = window.__qualificationItemBoundary.state; state.mode = 'pass'; state.release(); });
    const sibling = page.locator(identity.viewSelector).first(); const panel = sibling.getByTestId('items-repository');
    await expect(panel.getByRole('button', { name: 'Edit item: Commit after native close', exact: true })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Retained sibling draft');
    await expect(panel.getByRole('status')).toHaveCount(0);
    await expect.poll(async () => (await pendingNativeData(path))?.pluginEntities?.collections?.item?.records.length).toBe(2);
    expect(await page.evaluate(() => ({ calls: window.__qualificationItemBoundary.state.calls, completed: window.__qualificationItemBoundary.state.completed }))).toEqual({ calls: 1, completed: 1 });
    report.checks.push('native-items-controlled-adapter-pending-owner-close-sibling-commit');

    const beforeFailure = await readFile(path);
    await page.evaluate(() => { window.__qualificationItemBoundary.state.mode = 'reject'; });
    await panel.getByRole('button', { name: 'Create item', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('save outcome is uncertain');
    await expect(panel.getByRole('textbox', { name: 'New item label', exact: true })).toHaveValue('Retained sibling draft');
    await expect(panel.getByRole('button', { name: 'Create item', exact: true })).toBeDisabled();
    await expect(panel.getByRole('status')).toHaveCount(0);
    expect(await readFile(path)).toEqual(beforeFailure);
    const diagnostics = await page.evaluate(id => window.app.plugins.plugins[id].runtime.diagnosticSnapshot(), identity.id);
    expect(diagnostics.map(entry => ({ code: entry.code, operation: entry.operation }))).toEqual([{ code: 'settings.write', operation: 'settings.save' }]);
    report.itemOwnership = { ...report.itemOwnership, status: 'passed',
      counts: await page.evaluate(() => { const { calls, completed, failed } = window.__qualificationItemBoundary.state; return { calls, completed, failed }; }), diagnostics };
    expect(report.itemOwnership.counts).toEqual({ calls: 2, completed: 1, failed: 1 });
    report.checks.push('native-items-controlled-adapter-rejection-retains-draft-no-success');
  } catch (error) {
    failed = true; report.itemOwnership.status = 'failed'; report.itemOwnership.reason = String(error.message);
    await page.screenshot({ path: join(output, 'native-items-boundary-failure.png') }).catch(() => undefined);
    throw error;
  } finally {
    try {
      await page.evaluate(() => { window.__qualificationItemBoundary.restore(); });
      // Releasing a held native call is not completion: drain owned writes before restoring bytes.
      await expect.poll(() => page.evaluate(() => window.__qualificationItemBoundary.state.active), { timeout: 15000 }).toBe(0);
      await page.evaluate(() => { delete window.__qualificationItemBoundary; });
      await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id);
      // Restore only the fixture's exact prior scratch data while its runtime is disabled.
      await writeFile(path, originalBytes);
      await page.evaluate(async id => window.app.plugins.enablePlugin(id), identity.id);
      await nativeCommand(page, 'Open capability showcase');
    } catch (error) {
      report.itemOwnership.status = 'failed'; report.itemOwnership.cleanupFailure = String(error.message);
      if (!failed) throw error;
    }
  }
  expect(await readFile(path)).toEqual(originalBytes);
  await page.locator(identity.viewSelector).first().getByRole('button', { name: 'Overview', exact: true }).click();
}
