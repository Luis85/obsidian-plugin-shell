// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', async () => (await import('./host-fixture')).hostModule);
import { App, WorkspaceLeaf, Plugin } from 'obsidian';
import { createServices } from '../../src/bootstrap/services';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { browserModalSink } from '../../harness/app/modal-sink';
import { memoryStorage } from './memory-storage';
import { host, deferred } from './helpers';
import { click, input, field, settle } from './component-fixture';
import { initializePlugin } from '../../src/bootstrap/plugin-runtime';
import { ShowcaseView, SHOWCASE_VIEW } from '../../src/infrastructure/obsidian/showcase-view';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import { hostState } from './host-fixture';
import manifest from '../../manifest.json';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
async function fixture() {
  const timers = new Set<() => void>(); const issuedTimers: (() => void)[] = [];
  const hostRefs = new Set<() => void>(); const notices = new Set<() => void>();
  const native = host(); let sequence = 0; const errors = vi.fn();
  native.notice = () => { const close = () => { notices.delete(close); }; notices.add(close); return close; };
  const save = vi.fn(async (_value: unknown): Promise<void> => undefined);
  const services = await createServices({ documents: memoryStorage().storage, host: native, modals: browserModalSink(),
    settings: { load: async () => null, save }, local: { get: () => null, set() {} },
    newId: () => `resources-${++sequence}`, now: () => '2026-09-23T00:00:00.000Z', observeError: errors,
    scheduler: { after(_delay, callback) { timers.add(callback); issuedTimers.push(callback); return () => { timers.delete(callback); }; } } });
  const roots: HTMLElement[] = []; const closers: (() => void)[] = [];
  const mount = () => {
    const root = document.createElement('div'); document.body.append(root); roots.push(root);
    // Counts the same per-view owner observer boundary that native mount wires to host EventRefs.
    const close = mountShowcase(root, services, undefined, refresh => { hostRefs.add(refresh); return () => { hostRefs.delete(refresh); }; });
    closers.push(close); return { root, close };
  };
  const counts = () => ({ bus: services.events.size, hostRefs: hostRefs.size, timers: timers.size, notices: notices.size,
    dialogs: document.querySelectorAll('dialog').length, feedback: services.notices.current.length });
  return { services, save, mount, counts, issuedTimers, errors,
    dispose() { for (const close of closers) close(); services.dispose(); for (const root of roots) root.remove(); } };
}

it('[RESOURCE-20] twenty full real-view cycles return every measured owner resource to the live sibling baseline', async () => {
  const f = await fixture();
  try {
    const runtimeBus = f.services.events.size;
    const sibling = f.mount(); await settle(); await click(sibling.root, 'Events & feedback');
    const baseline = f.counts(); expect(baseline.bus).toBeGreaterThan(0); expect(baseline.hostRefs).toBe(1);
    const runtimeDispose = vi.spyOn(f.services, 'dispose');
    for (let cycle = 0; cycle < 20; cycle++) {
      const view = f.mount(); await settle(); await click(view.root, 'Events & feedback');
      await click(view.root, 'Show a native notice'); await click(view.root, 'Confirm an example');
      expect(f.counts()).toEqual({ bus: baseline.bus + baseline.bus - runtimeBus, hostRefs: 2, timers: 1, notices: 1, dialogs: 1, feedback: 1 });
      view.close(); view.close(); await settle();
      expect(view.root.children.length).toBe(0); expect(f.counts()).toEqual(baseline);
      // Late adapter delivery cannot resurrect feedback, dialogs or already-disposed scopes.
      for (const callback of f.issuedTimers) callback(); await settle();
      expect(f.counts()).toEqual(baseline);
      await click(sibling.root, 'Publish a typed event');
      expect(sibling.root.querySelector('.shell-event-table')?.textContent).toContain(String(cycle + 1).padStart(3, '0'));
      expect(f.counts()).toEqual(baseline); expect(runtimeDispose).not.toHaveBeenCalled();
    }
    expect(f.errors).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RESOURCE-PENDING] closing the writing view suppresses late UI work while its committed fact reaches the live sibling', async () => {
  const f = await fixture(); const pending = deferred();
  try {
    const sibling = f.mount(); const writer = f.mount(); await settle();
    await click(sibling.root, 'Documents'); await click(writer.root, 'Documents');
    await input(field(sibling.root, 'item-label'), 'Sibling draft');
    await input(field(writer.root, 'item-label'), 'Committed after close');
    f.save.mockImplementationOnce(() => pending.promise); await click(writer.root, 'Create item');
    expect(writer.root.textContent).toContain('Waiting for this action');
    writer.close(); await settle(); const baseline = f.counts();
    pending.resolve(); await settle();
    expect(writer.root.children.length).toBe(0); expect(f.counts()).toEqual(baseline);
    expect(sibling.root.textContent).toContain('Committed after close');
    expect(field(sibling.root, 'item-label').value).toBe('Sibling draft');
    expect(f.save).toHaveBeenCalledOnce(); expect(f.errors).not.toHaveBeenCalled();
    await click(sibling.root, 'Create item'); expect(f.save).toHaveBeenCalledTimes(2);
    expect(sibling.root.textContent).toContain('Item created.');
  } finally { pending.resolve(); f.dispose(); }
});

it('[RESOURCE-FAILURE] an uncertain late native-boundary double failure is independently observed and cannot announce success', async () => {
  const f = await fixture(); const pending = deferred();
  try {
    const sibling = f.mount(); const writer = f.mount(); await settle();
    await click(sibling.root, 'Documents'); await click(writer.root, 'Documents');
    await input(field(writer.root, 'item-label'), 'Uncertain after close');
    f.save.mockImplementationOnce(() => pending.promise); await click(writer.root, 'Create item'); writer.close(); await settle();
    const baseline = f.counts(); pending.reject(new Error('controlled adapter failure')); await settle();
    expect(f.counts()).toEqual(baseline); expect(writer.root.children.length).toBe(0);
    expect(sibling.root.textContent).not.toContain('Uncertain after close');
    expect(f.errors).toHaveBeenCalledExactlyOnceWith({ code: 'settings.write', operation: 'settings.save', sequence: 1 });
    await input(field(sibling.root, 'item-label'), 'Deliberate attempt'); await click(sibling.root, 'Create item');
    expect(f.save).toHaveBeenCalledOnce(); expect(sibling.root.textContent).not.toContain('Item created.');
  } finally { pending.resolve(); f.dispose(); }
});

it('[RESOURCE-HOST-20] actual native registration wiring releases per-view EventRefs for twenty cycles without stopping its runtime bridge', async () => {
  hostState.reset();
  class FixturePlugin extends Plugin {}
  const plugin = new FixturePlugin(new App(), manifest); const runtime = await initializePlugin(plugin);
  hostState.ready.forEach(callback => callback());
  const factory = hostState.views.get(SHOWCASE_VIEW); if (!factory) throw new Error('VIEW_FACTORY_MISSING');
  const sibling = factory(new WorkspaceLeaf()); if (!(sibling instanceof ShowcaseView)) throw new Error('VIEW_TYPE');
  const refs = () => Array.from(hostState.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
  const bridgeBaseline = refs(); expect(bridgeBaseline).toBe(8);
  const disposeBus = vi.spyOn(TypedEventBus.prototype, 'dispose');
  try {
    await sibling.onOpen(); await settle(); await click(sibling.contentEl, 'Events & feedback');
    const baseline = refs(); expect(baseline).toBe(bridgeBaseline + 3);
    for (let cycle = 0; cycle < 20; cycle++) {
      const view = factory(new WorkspaceLeaf()); if (!(view instanceof ShowcaseView)) throw new Error('VIEW_TYPE');
      await view.onOpen(); await settle(); expect(refs()).toBe(baseline + 3);
      await view.onClose(); await view.onClose(); await settle(); expect(refs()).toBe(baseline);
      expect(view.contentEl.children.length).toBe(0); expect(view.leaf.detach).not.toHaveBeenCalled();
      await click(sibling.contentEl, 'Publish a typed event');
      expect(sibling.contentEl.querySelector('.shell-event-table')?.textContent).toContain(String(cycle + 1).padStart(3, '0'));
      expect(disposeBus).not.toHaveBeenCalled(); view.containerEl.remove();
    }
    expect(runtime.diagnosticSnapshot()).toEqual([]);
    await sibling.onClose(); expect(refs()).toBe(bridgeBaseline);
  } finally { runtime.dispose(); }
  expect(refs()).toBe(0); expect(disposeBus).toHaveBeenCalledOnce();
});
