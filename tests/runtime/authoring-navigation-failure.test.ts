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
