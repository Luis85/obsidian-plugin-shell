// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { componentFixture, click, input, field, button, settle } from './component-fixture';
import { failure } from '../../src/domain/outcome';
import { deferred } from './helpers';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
let warnings: string[]; let warningSpy: MockInstance;
beforeEach(() => { warnings = []; warningSpy = vi.spyOn(console, 'warn').mockImplementation(message => { warnings.push(String(message)); }); });
afterEach(() => { warningSpy.mockRestore(); document.body.replaceChildren(); expect(warnings, 'Every Vue/console warning is unexpected in these real-component cases').toEqual([]); });
it('[UI-03-01] real panels preview exact Markdown, commit once and retain success after failed opening', async () => {
  const f = await componentFixture();
  try {
    await click(f.root, 'Documents');
    await click(f.root, 'Preview Markdown');
    expect(f.root.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(field(f.root, 'title'));
    await input(field(f.root, 'title'), 'Reusable documents');
    await input(field(f.root, 'due'), '2026-09-30');
    await input(field(f.root, 'tags'), 'work');
    await click(f.root, 'Preview Markdown');
    const preview = f.root.querySelector('[data-testid="markdown-preview"]')?.textContent;
    expect(preview).toContain('Reusable documents'); expect(f.files.size).toBe(0);
    await click(f.root, 'Create Task note');
    expect([...f.files.values()]).toEqual([preview]); expect(f.write).toHaveBeenCalledTimes(1);
    f.native.openDocument = async () => failure('storage', 'error.open');
    await click(f.root, 'Open created note');
    expect(f.root.querySelector('[role="alert"]')).not.toBeNull(); expect(f.write).toHaveBeenCalledTimes(1);
    await click(f.root, 'Create another'); expect(f.root.querySelector('[data-testid="markdown-preview"]')).toBeNull();
    expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
it('[UI-03-08] child render/event failures produce owned fallback and independent caught-defect evidence', async () => {
  const f = await componentFixture();
  try {
    await click(f.root, 'Events & feedback');
    vi.spyOn(f.services.events, 'publish').mockImplementationOnce(() => { throw new Error('child event failed'); });
    await click(f.root, 'Publish a typed event');
    expect(f.root.querySelector('[role="alert"]')?.textContent).toContain('rendering error');
    expect(f.observe.mock.calls.map(([entry]) => entry.code)).toEqual(['vue.render']);
    expect(f.files.size).toBe(0);
  } finally { f.dispose(); }
});
it('[UI-03-09] failed mounting restores theme ownership and a later independent mount remains usable', async () => {
  const f = await componentFixture(); const root = document.createElement('div'); root.className = 'user-owned dark'; document.body.append(root);
  const baseline = f.services.events.size; let mountedListeners = 0;
  const insert = vi.spyOn(root, 'insertBefore').mockImplementation(() => { mountedListeners = f.services.events.size; throw new Error('DOM mount failed'); });
  try {
    expect(() => mountShowcase(root, f.services)).toThrow('DOM mount failed');
    expect(mountedListeners).toBeGreaterThan(baseline); expect(f.services.events.size).toBe(baseline); expect(root.children).toHaveLength(0);
    expect(root.classList.contains('dark')).toBe(true); expect(root.classList.contains('light')).toBe(false); expect(root.classList.contains('user-owned')).toBe(true);
    insert.mockRestore(); const close = mountShowcase(root, f.services); await settle();
    expect(root.querySelector('[data-testid="showcase"]')).not.toBeNull(); close(); close();
  } finally { insert.mockRestore(); root.remove(); f.dispose(); }
});
it('[UI-03-13] closing a sibling view or failed attachment cannot dispose runtime translation or stop another view locale', async () => {
  const f = await componentFixture(); const root = document.createElement('div'); document.body.append(root);
  const runtimeDispose = vi.spyOn(f.services.i18n, 'dispose'); const close = mountShowcase(root, f.services);
  try {
    f.close(); expect(runtimeDispose).not.toHaveBeenCalled();
    const failedRoot = document.createElement('div'); document.body.append(failedRoot);
    const failedInsert = vi.spyOn(failedRoot, 'insertBefore').mockImplementation(() => { throw new Error('failed sibling attachment'); });
    try { expect(() => mountShowcase(failedRoot, f.services)).toThrow('failed sibling attachment'); expect(runtimeDispose).not.toHaveBeenCalled(); }
    finally { failedInsert.mockRestore(); failedRoot.remove(); }
    await f.services.preferences.update({ locale: 'de' }); await settle();
    expect(root.querySelector('[data-testid="showcase"]')?.getAttribute('lang')).toBe('de'); expect(root.textContent).toContain('Dokumente');
    expect(f.services.i18n.global.t('nav.documents')).toBe('Dokumente');
    close(); expect(runtimeDispose).not.toHaveBeenCalled(); expect(f.services.events.size).toBe(0);
  } finally { close(); root.remove(); f.dispose(); f.services.dispose(); }
  expect(runtimeDispose).toHaveBeenCalledOnce(); runtimeDispose.mockRestore();
});
it('[UI-03-10] runtime recovery stays visible inline with a keyboard button and single-flight owner action', async () => {
  const f = await componentFixture(); const available = deferred<boolean>();
  const off = f.services.notifications.registerActions('background', { open: { labelKey: 'doc.open', available: () => available.promise, run: async () => { await f.native.openDocument('Tasks/committed.md'); } } });
  try {
    f.services.notifications.notify({ owner: 'background', operation: 'committed-open', kind: 'error', key: 'error.open', native: true, actions: ['open'] }); await settle();
    const action = button(f.root, 'Open created note'); expect(action.disabled).toBe(false);
    action.click(); await settle(); expect(button(f.root, 'Open created note').disabled).toBe(true);
    available.resolve(true); await settle();
    expect(f.native.openDocument).toHaveBeenCalledExactlyOnceWith('Tasks/committed.md'); expect(f.write).not.toHaveBeenCalled();
    expect(button(f.root, 'Open created note').disabled).toBe(false); expect(f.observe).not.toHaveBeenCalled();
    off(); await settle(); expect(f.root.querySelector('.shell-feedback-item')).toBeNull();
  } finally { off(); f.dispose(); }
});
it('[UI-03-11] actual modal demo actions use canonical services and never mutate notes', async () => {
  const f = await componentFixture();
  try {
    expect(f.services.notices).toBe(f.services.notifications); await click(f.root, 'Events & feedback');
    await click(f.root, 'Confirm an example'); document.querySelector<HTMLButtonElement>('dialog button[type="button"]')?.click(); await settle();
    expect(f.root.textContent).toContain('Example cancelled. No documents changed.');
    await click(f.root, 'Confirm an example'); document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')?.click(); await settle();
    expect(f.root.textContent).toContain('Example confirmed. No documents changed.');
    await click(f.root, 'Try a text prompt'); document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')?.click(); await settle();
    expect(document.querySelector('dialog [role="alert"]')?.textContent).toBe('Enter a short, non-empty value.');
    const input = document.querySelector<HTMLInputElement>('dialog input'); if (!input) throw new Error('MISSING_PROMPT'); input.value = 'Example';
    document.querySelector<HTMLButtonElement>('dialog button[type="submit"]')?.click(); await settle(); expect(document.querySelector('dialog')).toBeNull();
    expect(f.files.size).toBe(0); expect(f.observe).not.toHaveBeenCalled();
    await click(f.root, 'Try a text prompt'); f.close(); await settle(); expect(document.querySelector('dialog')).toBeNull(); expect(f.services.notices.current).toEqual([]);
  } finally { f.dispose(); }
});
it('[UI-03-12] modal opening failures surface through owned feedback and independent diagnostics', async () => {
  const f = await componentFixture();
  try {
    vi.spyOn(f.modalSink, 'open').mockImplementationOnce(() => { throw new Error('dialog unavailable'); });
    await click(f.root, 'Open a native modal'); expect(f.root.querySelector('.shell-feedback-item')?.textContent).toContain('unexpected error');
    expect(f.observe.mock.calls.map(([entry]) => entry.code)).toEqual(['modal.open']); expect(f.files.size).toBe(0);
  } finally { f.dispose(); }
});
it('[UI-03-02] real overview and events panels deliver facts and dismiss owned feedback', async () => {
  const f = await componentFixture();
  try {
    await click(f.root, 'Open a native modal'); expect(document.querySelector('dialog[open]')?.textContent).toContain('One view, two environments');
    document.querySelector<HTMLDialogElement>('dialog')?.close(); await settle();
    await click(f.root, 'Events & feedback');
    await click(f.root, 'Publish a typed event'); expect(f.root.textContent).toContain('showcase.ping');
    await click(f.root, 'Show a native notice'); expect(f.native.notice).toHaveBeenCalledTimes(1);
    await click(f.root, 'Try recoverable feedback'); expect(f.root.querySelector('.shell-feedback [role="status"]')).not.toBeNull();
    f.root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')?.click(); await settle();
    expect(f.root.querySelector('.shell-feedback [role="status"]')).toBeNull();
    await click(f.root, 'Open native modal'); expect(document.querySelector('dialog[open]')?.textContent).toContain('One view, two environments');
    document.querySelector<HTMLDialogElement>('dialog')?.close(); await settle();
    f.services.diagnostics.report('fixture.expected', 'fixture.test'); await settle(); expect(f.root.textContent).toContain('fixture.expected');
    expect(f.observe).toHaveBeenCalledTimes(1);
    f.root.querySelector<HTMLButtonElement>('button[aria-label="View actions"]')?.click(); expect(f.actions).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});
it('[UI-03-03] real document form blocks unsafe retries while persistence is pending or uncertain', async () => {
  const f = await componentFixture(); const barrier = deferred<ReturnType<typeof failure>>();
  try {
    await click(f.root, 'Documents'); await input(field(f.root, 'title'), 'Pending note'); await click(f.root, 'Preview Markdown');
    f.write.mockImplementationOnce(() => barrier.promise); button(f.root, 'Create Task note').click(); await settle();
    expect(field(f.root, 'title').disabled).toBe(true); expect(button(f.root, 'Back to editing').disabled).toBe(true);
    barrier.resolve(failure('uncertain', 'error.uncertain')); await settle();
    expect(field(f.root, 'title').disabled).toBe(true); expect(button(f.root, 'Create Task note').disabled).toBe(true);
    expect(f.write).toHaveBeenCalledTimes(1); expect(f.files.size).toBe(0); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
