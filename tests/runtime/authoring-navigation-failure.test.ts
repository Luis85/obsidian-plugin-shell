// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
vi.mock('../../src/bootstrap/authoring', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/bootstrap/authoring')>();
  return { ...original, authoringPanels: [{ id: 'review-panel', titleKey: 'app.title', component: {}, props: () => ({}) }] };
});
import { App, Plugin } from 'obsidian';
import { initializePlugin } from '../../src/bootstrap/plugin-runtime';
import { CommandService } from '../../src/application/command-service';
import { StructuredLogger, type LogRecord } from '../../src/application/logging';
import { NotificationService } from '../../src/application/notification-service';
import { hostState } from './host-fixture';
import manifest from '../../manifest.json';
class FixturePlugin extends Plugin {}

it('native view opening failures remain failed generated commands', async () => {
  hostState.reset(); const dispatched = vi.spyOn(CommandService.prototype, 'execute');
  const plugin = new FixturePlugin(new App(), manifest); const runtime = await initializePlugin(plugin);
  try {
    vi.mocked(plugin.app.workspace.getLeaf('tab').setViewState).mockRejectedValueOnce(new Error('Native open failed'));
    hostState.commands.get('review-panel-open-view')?.callback?.();
    const result = dispatched.mock.results[0];
    if (!result || result.type !== 'return') throw new Error('No command dispatched');
    expect(await result.value).toMatchObject({ ok: false });
  } finally { runtime.dispose(); vi.restoreAllMocks(); }
});
it('native header toggles preserve failed-save outcomes and log failure with one feedback delivery', async () => {
  hostState.reset(); const dispatched = vi.spyOn(CommandService.prototype, 'execute');
  const delivered = vi.spyOn(NotificationService.prototype, 'show'); const records: LogRecord[] = [];
  const disposeLogger = StructuredLogger.prototype.dispose;
  vi.spyOn(StructuredLogger.prototype, 'dispose').mockImplementation(function(this: StructuredLogger) {
    records.push(...this.current); disposeLogger.call(this);
  });
  const plugin = new FixturePlugin(new App(), manifest); const runtime = await initializePlugin(plugin);
  try {
    vi.mocked(plugin.saveData).mockRejectedValueOnce(new Error('Save response lost'));
    hostState.commands.get('toggle-view-header')?.callback?.();
    const result = dispatched.mock.results[0]; if (!result || result.type !== 'return') throw new Error('No command dispatched');
    expect(await result.value).toMatchObject({ ok: false, error: { effect: 'uncertain', key: 'error.settingsWrite' } });
    expect(delivered).toHaveBeenCalledExactlyOnceWith('command:toggle-view-header', 'error', 'error.settingsWrite', true, 'runtime');
    runtime.dispose();
    expect(records.filter(record => record.operation === 'commands.toggle-view-header').map(record => record.code)).toEqual(['commands.failed']);
  } finally { runtime.dispose(); vi.restoreAllMocks(); }
});
