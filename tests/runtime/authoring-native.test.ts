// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
vi.mock('../../src/bootstrap/authoring', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/bootstrap/authoring')>();
  const { defineComponent, h } = await import('vue');
  const { defineStore } = await import('pinia');
  const useDraft = defineStore('native-authoring-fixture', { state: () => ({ draft: '' }) });
  const component = defineComponent({ setup() {
    const draft = useDraft();
    return () => h('input', { 'aria-label': 'Fixture draft', value: draft.draft, onInput: (event: Event) => { const target = event.target; if (target instanceof HTMLInputElement) draft.draft = target.value; } });
  } });
  const panels = [{ id: 'fixture-panel', titleKey: 'app.title', component, props: () => ({}) }];
  return { ...original, authoringPanels: panels, createAuthoringPanels: () => original.assembleAuthoringPanels(panels, {}) };
});
import { App, Plugin, WorkspaceLeaf } from 'obsidian';
import { initializePlugin } from '../../src/bootstrap/plugin-runtime';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { createServices } from '../../src/bootstrap/services';
import { nativeAdapters } from '../../src/infrastructure/obsidian/adapters';
import { ShowcaseView } from '../../src/infrastructure/obsidian/showcase-view';
import { authoringViewDefinitions, authoringViewCommands } from '../../src/bootstrap/authoring-views';
import { hostState } from './host-fixture';
import { settle } from './component-fixture';
import { defaults } from '../../src/domain/preferences';
import manifest from '../../manifest.json';
class FixturePlugin extends Plugin {}
beforeEach(() => { hostState.reset(); });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it('registers an exact native view and command with isolated drafts and owned lifetime', async () => {
  const plugin = new FixturePlugin(new App(), manifest); const runtime = await initializePlugin(plugin);
  const type = `${manifest.id}-view-fixture-panel`; const factory = hostState.views.get(type);
  if (!factory) throw new Error('AUTHORING_NATIVE_FACTORY_MISSING');
  const open = hostState.commands.get('fixture-panel-open-view');
  expect(open?.name).toBe(`${manifest.name}: ${manifest.name}`);
  open?.callback?.(); await settle();
  expect(plugin.app.workspace.getLeaf('tab').setViewState).toHaveBeenCalledWith({ type, active: true });
  const first = factory(new WorkspaceLeaf()); const second = factory(new WorkspaceLeaf());
  if (!(first instanceof ShowcaseView) || !(second instanceof ShowcaseView)) throw new Error('EXPECTED_SHARED_NATIVE_ADAPTER');
  expect(first.containerEl.dataset.type).toBe(type); expect(second.containerEl.dataset.type).toBe(type);
  expect(first.containerEl.dataset.initialTitle).toBe(manifest.name);
  await first.onOpen(); await second.onOpen(); await settle();
  expect(first.getViewType()).toBe(type); expect(first.getDisplayText()).toBe(manifest.name);
  const input = first.contentEl.querySelector('input'); const other = second.contentEl.querySelector('input');
  if (!input || !other) throw new Error('PANEL_NOT_MOUNTED');
  input.value = 'One owner'; input.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  expect(other.value).toBe('');
  expect(first.contentEl.querySelector('[data-testid="showcase"]')).toBeNull();
  expect(first.containerEl.getAttribute('data-plugin-view-owner')).toBe(manifest.id);
  runtime.dispose(); runtime.dispose();
  expect(first.contentEl.querySelector('input')).toBeNull(); expect(second.contentEl.querySelector('input')).toBeNull();
  expect(first.containerEl.hasAttribute('data-plugin-view-owner')).toBe(false);
  expect(first.leaf.detach).not.toHaveBeenCalled(); expect(hostState.commands.size).toBe(0);
});
it('keeps localized selected mounts owned and fails unknown selections before attachment', async () => {
  const plugin = new FixturePlugin(new App(), manifest);
  vi.mocked(plugin.loadData).mockResolvedValueOnce({ schemaVersion: 1, preferences: { ...defaults, locale: 'de' } });
  const services = await createServices(nativeAdapters(plugin)); const root = document.createElement('div'); document.body.append(root);
  try {
    const close = mountShowcase(root, services, undefined, undefined, 'fixture-panel'); await settle();
    expect(root.querySelector('main')?.lang).toBe('de'); close(); close(); expect(root.children).toHaveLength(0);
    expect(() => mountShowcase(root, services, undefined, undefined, 'missing')).toThrow('AUTHORING_VIEW_NOT_REGISTERED');
    expect(root.children).toHaveLength(0);
  } finally { services.dispose(); }
});
it('validates exact panel IDs and shares command execution with native navigation', async () => {
  const panel = { id: 'example', titleKey: 'app.title' }; const open = vi.fn(async () => undefined);
  expect(authoringViewDefinitions([panel])[0]?.type).toBe(`${manifest.id}-view-example`);
  expect(() => authoringViewDefinitions([panel, panel])).toThrow('AUTHORING_VIEW_ID');
  expect(() => authoringViewDefinitions([{ ...panel, id: '../escape' }])).toThrow('AUTHORING_VIEW_ID');
  expect(() => authoringViewDefinitions([{ ...panel, id: 'a'.repeat(55) }])).toThrow('AUTHORING_VIEW_ID');
  await authoringViewCommands([panel], open).commands[0]?.execute(); expect(open).toHaveBeenCalledExactlyOnceWith('example');
});
