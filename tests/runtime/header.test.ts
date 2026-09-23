// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenceService } from '../../src/application/preference-service';
import { bindViewHeader, SHOWCASE_VIEW } from '../../src/infrastructure/obsidian/view-header';
import { defaults, parsePreferences } from '../../src/domain/preferences';
import { fixture, deferred } from './helpers';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
const marker = pluginIdentity.hiddenHeaderClass;
function setup(raw: unknown = null) {
  const f = fixture(); const save = vi.fn(async (_value: unknown): Promise<void> => undefined);
  return { ...f, save, service: new PreferenceService({ load: async () => raw, save }, f.bus, f.errors) };
}
function leaf(type: string = SHOWCASE_VIEW, owner = document) {
  const el = owner.createElement('section'); el.dataset.type = type;
  const header = owner.createElement('div'); header.className = 'view-header';
  header.style.height = '37px'; header.setAttribute('aria-label', 'Host-owned title');
  const content = owner.createElement('div'); content.className = 'view-content';
  el.append(header, content); owner.body.append(el); return el;
}
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
describe('Iteration 02 header ownership and settings', () => {
  it('[HDR-02-01] migrates old schema-one preferences without a write; validates the new boolean', async () => {
    const old = { locale: 'de', taskFolder: 'Projects/Tasks', notifySuccess: false };
    const f = setup({ schemaVersion: 1, preferences: old }); await f.service.load();
    expect(f.service.current).toEqual({ ...old, hideObsidianViewHeader: false });
    expect(f.save).not.toHaveBeenCalled(); expect(f.service.readonly).toBe(false);
    for (const value of [null, 1, 'true', {}]) expect(parsePreferences({ ...defaults, hideObsidianViewHeader: value }).ok).toBe(false);
  });
  it('[HDR-02-02] updates all owned leaves and newly opened leaves without touching unrelated DOM', async () => {
    const f = setup(); const first = leaf(); const second = leaf(); const other = leaf('markdown');
    const original = other.outerHTML; const a = bindViewHeader(first, f.service, f.errors); const b = bindViewHeader(second, f.service, f.errors);
    expect(first.classList.contains(marker)).toBe(false);
    await f.service.update({ hideObsidianViewHeader: true });
    expect([first, second].every(el => el.classList.contains(marker))).toBe(true);
    expect(other.outerHTML).toBe(original);
    const later = leaf(); const c = bindViewHeader(later, f.service, f.errors); expect(later.classList.contains(marker)).toBe(true);
    await f.service.update({ hideObsidianViewHeader: false });
    expect([first, second, later].every(el => !el.classList.contains(marker))).toBe(true);
    expect(f.errors.report).not.toHaveBeenCalled(); a(); b(); c();
  });
  it('[HDR-02-03] repeated toggle/dispose restores host attributes and does not revive disposed leaves', async () => {
    const f = setup(); const el = leaf(); el.classList.add('theme-owned');
    const original = el.outerHTML; const stop = bindViewHeader(el, f.service, f.errors);
    for (let i = 0; i < 12; i++) await f.service.toggleViewHeader();
    expect(el.outerHTML).toBe(original);
    await f.service.toggleViewHeader(); stop(); stop(); expect(el.outerHTML).toBe(original);
    await f.service.toggleViewHeader(); await f.service.toggleViewHeader(); expect(el.outerHTML).toBe(original);
  });
  it('[HDR-02-04] fails closed for a foreign owner, unsupported DOM and adapter initialization failure', async () => {
    const f = setup(); const foreign = leaf('markdown');
    expect(() => bindViewHeader(foreign, f.service, f.errors)).toThrow('HEADER_OWNER_MISMATCH');
    const el = leaf(); el.querySelector('.view-header')?.remove();
    const stop = bindViewHeader(el, f.service, f.errors); await f.service.toggleViewHeader();
    expect(el.classList.contains(marker)).toBe(false); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('header.unsupported', 'view.header'); stop();
    const broken = leaf(); const original = broken.outerHTML;
    vi.spyOn(broken, 'querySelector').mockImplementation(() => { throw new Error('host failure'); });
    expect(() => bindViewHeader(broken, f.service, f.errors)).toThrow('host failure');
    await f.service.toggleViewHeader(); expect(broken.outerHTML).toBe(original);
  });
  it('[HDR-02-05] persisted state survives a new runtime; failed writes never hide the header', async () => {
    const f = setup(); const el = leaf(); const stop = bindViewHeader(el, f.service, f.errors);
    f.save.mockRejectedValueOnce(new Error('write'));
    expect((await f.service.toggleViewHeader()).ok).toBe(false); expect(el.classList.contains(marker)).toBe(false);
    expect((await f.service.toggleViewHeader()).ok).toBe(true);
    const stored = f.save.mock.calls.at(-1)?.[0]; stop(); f.service.dispose();
    const restarted = setup(stored); await restarted.service.load();
    const restored = bindViewHeader(el, restarted.service, restarted.errors); expect(el.classList.contains(marker)).toBe(true); restored();
  });
  it('[HDR-02-06] functional toggles serialize; queued patches are snapshots and late commits do not publish', async () => {
    const f = setup(); const barrier = deferred(); f.save.mockImplementationOnce(async () => barrier.promise);
    const first = f.service.toggleViewHeader(); const second = f.service.toggleViewHeader();
    const patch = { taskFolder: 'Safe' }; const third = f.service.update(patch); patch.taskFolder = 'Mutated';
    await Promise.resolve(); expect(f.save).toHaveBeenCalledTimes(1); barrier.resolve();
    await Promise.all([first, second, third]); expect(f.service.current).toMatchObject({ hideObsidianViewHeader: false, taskFolder: 'Safe' });
    const late = deferred(); f.save.mockImplementationOnce(async () => late.promise);
    const event = vi.fn(); f.bus.on('preferences.changed', event); const work = f.service.toggleViewHeader();
    await Promise.resolve(); f.service.dispose(); late.resolve(); expect((await work).ok).toBe(true); expect(event).not.toHaveBeenCalled();
  });
  it('[HDR-02-07] uses the owning document and preserves pre-existing namespaced state', async () => {
    const f = setup(); const frame = document.createElement('iframe'); document.body.append(frame);
    const owner = frame.contentDocument; if (!owner) throw new Error('NO_IFRAME_DOCUMENT');
    const el = leaf(SHOWCASE_VIEW, owner); el.classList.add(marker);
    const stop = bindViewHeader(el, f.service, f.errors); await f.service.toggleViewHeader();
    expect(el.classList.contains(marker)).toBe(true); stop(); expect(el.classList.contains(marker)).toBe(true);
  });
});
