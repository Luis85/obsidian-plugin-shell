import { expect } from '@playwright/test';
import { join } from 'node:path';
import { noteNativePhase } from './native-diagnostic-observer.mjs';
import { nativeCommand } from './native-command.mjs';
import { attachRuntimeObservation, assertIndependentObservation, observedResources } from './native-runtime-observation.mjs';
import { retainNativeAction, startAndCloseRecovery } from './native-recovery-handles.mjs';
import { foreignNoticeCommands } from './native-foreign-notice.mjs';

/** Exact installed plugin bytes; public UI/native resources, no global resource sweeps. */
export async function qualifyResourceOwnership(page, report, output, identity, witnessId) {
  noteNativePhase(report, 'native-resource-ownership');
  report.resourceOwnership = { status: 'running', mode: 'native-public-ui', unexecuted: [] };
  const observation = await page.evaluateHandle(attachRuntimeObservation, identity.id);
  const read = () => observation.evaluate(handle => handle.read());
  let foreign; let initiating; let ownNotice; let siblingNotice; let retainedAction; let failed = false; let disabled = false;
  try {
    assertIndependentObservation(await read());
    await nativeCommand(page, foreignNoticeCommands.create);
    const foreignNotice = page.locator('.notice').filter({ hasText: 'Independent qualification owner' });
    await expect(foreignNotice).toHaveCount(1); await expect(foreignNotice).toBeVisible(); foreign = await foreignNotice.elementHandle();
    expect(await foreign.evaluate(element => element.isConnected)).toBe(true);
    const original = page.locator(identity.viewSelector).first();
    await original.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.locator('.menu-item').filter({ hasText: 'Open showcase in a split' }).click();
    await expect(page.locator(identity.viewSelector)).toHaveCount(2);
    await original.getByRole('button', { name: 'Events & feedback', exact: true }).click();
    await original.evaluate(startAndCloseRecovery); await expect(page.locator(identity.viewSelector)).toHaveCount(1);
    const cancelledProgress = await read(); assertIndependentObservation(cancelledProgress); expect(observedResources(cancelledProgress)).toEqual([]);
    report.resourceOwnership.cancelledProgress = cancelledProgress;
    const delayed = cancelledProgress.events.filter(event => event.kind === 'lifecycle' && event.entry.resource === 'timer' && event.entry.operation === 'progress');
    expect(delayed.map(event => event.entry.phase)).toEqual(['acquired', 'released']);
    expect(cancelledProgress.events.filter(event => event.kind === 'lifecycle' && event.entry.resource === 'notice' && event.entry.operation === 'progress')).toEqual([]);
    report.checks.push('native-delayed-progress-cancelled-before-display-on-owner-close');
    const sibling = page.locator(identity.viewSelector).first();
    await sibling.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.locator('.menu-item').filter({ hasText: 'Open showcase in a split' }).click();
    await expect(page.locator(identity.viewSelector)).toHaveCount(2);
    const first = page.locator(identity.viewSelector).nth(1);
    await first.getByRole('button', { name: 'Events & feedback', exact: true }).click();
    await sibling.getByRole('button', { name: 'Events & feedback', exact: true }).click();
    initiating = await first.evaluateHandle(element => {
      const leaf = window.app.workspace.getLeavesOfType(element.dataset.type).find(candidate => candidate.view.containerEl === element);
      if (!leaf) throw new Error('INITIATING_NATIVE_LEAF_MISSING');
      return leaf;
    });
    const nativeNotices = page.locator('.notice').filter({ hasText: 'This notice came through the host adapter.' });
    await first.getByRole('button', { name: 'Show a native notice', exact: true }).click();
    await expect(nativeNotices).toHaveCount(1); ownNotice = await nativeNotices.first().elementHandle();
    const firstResources = observedResources(await read());
    const firstNotice = firstResources.find(entry => entry.resource === 'notice');
    expect(firstNotice).toBeDefined();
    expect(firstResources.filter(entry => entry.resource === 'timer' && entry.owner === firstNotice.owner)).toHaveLength(1);
    await sibling.getByRole('button', { name: 'Show a native notice', exact: true }).click();
    await expect(nativeNotices).toHaveCount(2);
    siblingNotice = await page.evaluateHandle(owned => Array.from(document.querySelectorAll('.notice'))
      .find(element => element !== owned && element.textContent.includes('This notice came through the host adapter.')), ownNotice);
    await first.getByRole('button', { name: 'Try owned recovery', exact: true }).click();
    const modal = page.locator('.modal').filter({ hasText: 'Owned recovery example' }); await expect(modal).toBeVisible();
    retainedAction = await retainNativeAction(page, 'Review example result');
    await retainedAction.invoke(); await retainedAction.invoke();
    await expect(page.locator('.notice').getByRole('button', { name: 'Review example result', exact: true })).toBeDisabled();
    await expect(page.locator('.notice').filter({ hasText: 'Waiting for the example dialog' })).toBeVisible();
    const opened = await read(); const resources = observedResources(opened);
    report.resourceOwnership.opened = opened;
    expect(resources.filter(entry => entry.resource === 'modal')).toHaveLength(1);
    expect(resources.filter(entry => entry.resource === 'notice')).toHaveLength(4);
    expect(resources.filter(entry => entry.resource === 'timer')).toHaveLength(2);
    expect(resources.filter(entry => entry.resource === 'action')).toHaveLength(1);
    expect(resources.filter(entry => entry.resource === 'availability')).toHaveLength(1);
    const recoveryOwner = resources.find(entry => entry.resource === 'availability').owner;
    expect(opened.events.filter(event => event.kind === 'lifecycle' && event.entry.resource === 'availability' && event.entry.owner === recoveryOwner && event.entry.phase === 'acquired')).toHaveLength(1);
    await initiating.evaluate(leaf => leaf.detach());
    await expect(page.locator(identity.viewSelector)).toHaveCount(1); await expect(modal).toHaveCount(0);
    await expect.poll(() => ownNotice.evaluate(element => element.isConnected)).toBe(false);
    expect(await siblingNotice.evaluate(element => element.isConnected)).toBe(true);
    expect(await foreign.evaluate(element => element.isConnected)).toBe(true);
    const closed = await read(); assertIndependentObservation(closed);
    report.resourceOwnership.closed = closed;
    const remaining = observedResources(closed);
    expect(remaining.map(entry => entry.resource).sort()).toEqual(['notice', 'timer']);
    expect(remaining.every(entry => entry.owner !== firstNotice.owner)).toBe(true);
    const pendingCalls = retainedAction.calls(); await retainedAction.invoke();
    const replayed = await read(); assertIndependentObservation(replayed); expect(replayed).toEqual(closed);
    report.resourceOwnership.replayed = replayed;
    const retainedActionCalls = { pending: pendingCalls, afterClose: retainedAction.calls() - pendingCalls };
    report.resourceOwnership.retainedActionCalls = retainedActionCalls;
    expect(retainedActionCalls).toEqual({ pending: 2, afterClose: 1 });
    await expect(page.locator('.notice').filter({ hasText: 'Waiting for the example dialog' })).toHaveCount(0);
    await expect(page.locator('.notice').filter({ hasText: 'Example reviewed. No files changed.' })).toHaveCount(0);
    report.checks.push('native-pending-recovery-action-closed-owner-rejects-retained-native-handler');
    await page.locator(identity.viewSelector).first().getByRole('button', { name: 'Publish a typed event', exact: true }).click();
    await expect(page.locator(identity.viewSelector).first().locator('.shell-event-table')).toContainText('showcase.ping');
    report.checks.push('native-owned-notice-modal-expiry-timer-close-preserves-live-sibling-and-foreign-notice');
    await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id); disabled = true;
    await expect.poll(() => siblingNotice.evaluate(element => element.isConnected)).toBe(false);
    const unloaded = await read(); assertIndependentObservation(unloaded); expect(observedResources(unloaded)).toEqual([]);
    report.resourceOwnership.unloaded = unloaded;
    await nativeCommand(page, foreignNoticeCommands.update);
    expect(await foreign.evaluate(element => element.isConnected && element.textContent.includes('Independent qualification owner remains usable'))).toBe(true);
    await expect(page.locator('.notice').filter({ hasText: 'Independent qualification owner remains usable' })).toBeVisible();
    expect(await ownNotice.evaluate(element => element.isConnected)).toBe(false);
    report.resourceOwnership = { ...report.resourceOwnership, status: 'passed', cancelledProgress, opened, closed, replayed, unloaded, retainedActionCalls };
    report.checks.push('native-unload-releases-observed-plugin-handles-with-independent-zero-fault-ledger-and-retains-foreign-notice');
  } catch (error) {
    failed = true; report.resourceOwnership.status = 'failed'; report.resourceOwnership.reason = String(error.message);
    await page.screenshot({ path: join(output, 'native-resource-ownership-failure.png') })
      .catch(failure => { report.resourceOwnership.screenshotFailure = String(failure.message); });
    throw error;
  } finally {
    const cleanupFailures = [];
    try {
      report.resourceOwnership.finalObservation = await read();
      if (!failed) assertIndependentObservation(report.resourceOwnership.finalObservation);
    } catch (error) { cleanupFailures.push(String(error.message)); }
    try { await observation.evaluate(handle => handle.stop()); } catch (error) { cleanupFailures.push(String(error.message)); }
    try {
      await page.evaluate(async id => window.app.plugins.disablePlugin(id), witnessId);
      if (foreign) await expect.poll(() => foreign.evaluate(element => element.isConnected)).toBe(false);
    } catch (error) { cleanupFailures.push(String(error.message)); }
    try { await retainedAction?.dispose(); } catch (error) { cleanupFailures.push(String(error.message)); }
    for (const handle of [observation, foreign, initiating, ownNotice, siblingNotice]) {
      try { await handle?.dispose(); } catch (error) { cleanupFailures.push(String(error.message)); }
    }
    try {
      if (disabled) { await page.evaluate(async id => window.app.plugins.enablePlugin(id), identity.id); await nativeCommand(page, 'Open capability showcase'); }
    } catch (error) { cleanupFailures.push(String(error.message)); }
    if (cleanupFailures.length) {
      report.resourceOwnership.status = 'failed'; report.resourceOwnership.cleanupFailures = cleanupFailures;
      if (!failed) throw new Error(`NATIVE_RESOURCE_CLEANUP: ${cleanupFailures.join('; ')}`);
    }
  }
  await page.locator(identity.viewSelector).first().getByRole('button', { name: 'Overview', exact: true }).click();
}
