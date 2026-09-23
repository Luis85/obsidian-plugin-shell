import { expect } from '@playwright/test';
import { nativeCommand } from './native-command.mjs';

/** Native-only conformance: remove an owned public-API command while its plugin remains loaded. */
export async function qualifyCommandRemoval(page, report, identity) {
  const probe = await page.evaluate(id => {
    const plugin = window.app.plugins.plugins[id];
    if (!plugin) throw new Error('COMMAND_PROBE_PLUGIN_MISSING');
    const localId = `qualification-${crypto.randomUUID()}`;
    const label = `Template command removal probe ${localId}`;
    const state = { localId, calls: 0 };
    window.__templateCommandRemovalProbe = state;
    const registered = plugin.addCommand({ id: localId, name: label, callback: () => { state.calls++; } });
    return { localId, label, returnedId: registered.id };
  }, identity.id);
  try {
    expect(probe.returnedId).toBe(`${identity.id}:${probe.localId}`);
    await nativeCommand(page, probe.label);
    await expect.poll(() => page.evaluate(() => window.__templateCommandRemovalProbe?.calls)).toBe(1);
    await page.evaluate(({ id, localId }) => { window.app.plugins.plugins[id].removeCommand(localId); }, { id: identity.id, localId: probe.localId });
    await page.keyboard.press('ControlOrMeta+p');
    const input = page.locator('input.prompt-input:visible'); await expect(input).toBeVisible(); await input.fill(probe.label);
    // A zero count before asynchronous suggestions settle is not removal evidence.
    await expect(page.getByText(/^No (?:commands|results) found\.?$/, { exact: true })).toBeVisible();
    await expect(page.locator('.suggestion-item:visible').filter({ hasText: probe.label })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(id => !!window.app.plugins.plugins[id], identity.id)).toBe(true);
    report.checks.push('native-public-command-local-id-removal-before-plugin-unload');
  } finally {
    await page.evaluate(({ id, localId }) => {
      window.app.plugins.plugins[id]?.removeCommand(localId);
      delete window.__templateCommandRemovalProbe;
    }, { id: identity.id, localId: probe.localId });
  }
}
