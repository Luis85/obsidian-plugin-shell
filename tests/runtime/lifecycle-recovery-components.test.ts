// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { defaults } from '../../src/domain/preferences';
import { failure } from '../../src/domain/outcome';
import { button, click, componentFixture, field, input, settle } from './component-fixture';
import { deferred } from './helpers';
import { browserNotification } from '../../harness/app/notification-sink';
import type { NoticeAction } from '../../src/application/ports';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it('[PL-C07] unreadable shared data and future collections disable only their related rendered mutation controls', async () => {
  for (const raw of [{ schemaVersion: 2, preferences: defaults },
    { schemaVersion: 1, preferences: defaults, pluginEntities: { schemaVersion: 2, collections: {} } }]) {
    const shared = raw.schemaVersion === 2; const original = JSON.stringify(raw);
    const f = await componentFixture(raw);
    try {
      await click(f.root, 'Documents');
      expect(button(f.root, 'Create item').disabled).toBe(true);
      expect(field(f.root, 'item-label').disabled).toBe(true);
      expect(f.root.querySelector('[data-testid="items-repository"] [role="alert"]')?.textContent).toContain(shared ? 'Stored plugin data is protected' : 'Stored entity data is invalid');
      await click(f.root, 'Preferences'); expect(button(f.root, 'Save preferences').disabled).toBe(shared);
      expect(JSON.stringify(raw)).toBe(original); expect(f.save).not.toHaveBeenCalled();
      expect(f.observe.mock.calls.map(([entry]) => ({ code: entry.code, operation: entry.operation }))).toEqual(shared ? [{ code: 'settings.read', operation: 'settings.load' }] : []);
    } finally { f.dispose(); }
  }
});

it('[PL-C62] cancelling a preview writes nothing and closing an in-flight real note writer preserves bytes and its live sibling', async () => {
  const f = await componentFixture(); const sibling = document.createElement('div'); document.body.append(sibling);
  const closeSibling = mountShowcase(sibling, f.services); const gate = deferred();
  try {
    await settle(); await click(f.root, 'Documents'); await click(sibling, 'Documents');
    await input(field(sibling, 'title'), 'Independent private draft');
    await input(field(f.root, 'title'), 'Cancelled private note'); await click(f.root, 'Preview Markdown');
    const cancelled = button(f.root, 'Create Task note'); await click(f.root, 'Back to editing'); cancelled.click(); await settle();
    expect(f.write).not.toHaveBeenCalled(); expect([...f.files]).toEqual([]);
    await input(field(f.root, 'title'), 'Committed private note'); await click(f.root, 'Preview Markdown');
    const bytes = f.root.querySelector('[data-testid="markdown-preview"]')?.textContent;
    if (!bytes) throw new Error('Missing actual preview');
    const persist = f.write.getMockImplementation(); if (!persist) throw new Error('Missing real storage');
    f.write.mockImplementationOnce(async (path, markdown) => { await gate.promise; return persist(path, markdown); });
    const submit = button(f.root, 'Create Task note'); await click(f.root, 'Create Task note');
    expect(f.write).toHaveBeenCalledOnce(); expect(f.files.size).toBe(0);
    f.close(); await settle(); const baseline = f.services.events.size; gate.resolve(); await settle(); submit.click(); await settle();
    expect(f.root.children).toHaveLength(0); expect(f.services.events.size).toBe(baseline);
    expect([...f.files]).toEqual([['Tasks/Committed private note.md', bytes]]);
    expect(f.write).toHaveBeenCalledExactlyOnceWith('Tasks/Committed private note.md', bytes);
    expect(field(sibling, 'title').value).toBe('Independent private draft');
    await click(sibling, 'Events & feedback'); expect(sibling.querySelector('.shell-event-table')?.textContent).toContain('documents.created');
    await click(sibling, 'Documents'); await click(sibling, 'Reload notes');
    expect(sibling.textContent).toContain('Committed private note');
    expect(field(sibling, 'title').value).toBe('Independent private draft');
    expect(f.services.notifications.current).toEqual([]); expect(f.observe).not.toHaveBeenCalled();
    expect(f.services.debugging.exportJSON()).not.toContain('private');
  } finally { gate.resolve(); closeSibling(); f.dispose(); }
});

it('[PL-C66] stale and disposed rendered open recovery cannot overwrite a newer draft or create another note', async () => {
  for (const close of [false, true]) {
    const f = await componentFixture(); const gate = deferred<ReturnType<typeof failure>>();
    try {
      await click(f.root, 'Documents'); await input(field(f.root, 'title'), 'Open recovery');
      await click(f.root, 'Preview Markdown'); await click(f.root, 'Create Task note');
      const original = [...f.files]; const open = button(f.root, 'Open created note');
      vi.mocked(f.native.openDocument).mockReturnValueOnce(gate.promise); open.click(); open.click(); await settle();
      expect(f.native.openDocument).toHaveBeenCalledExactlyOnceWith('Tasks/Open recovery.md');
      if (close) f.close();
      else { await click(f.root, 'Create another'); await input(field(f.root, 'title'), 'New independent draft'); await click(f.root, 'Preview Markdown'); }
      gate.resolve(failure('storage', 'error.open')); await settle(); open.click(); await settle();
      expect(f.native.openDocument).toHaveBeenCalledOnce(); expect(f.write).toHaveBeenCalledOnce(); expect([...f.files]).toEqual(original);
      if (close) expect(f.root.children).toHaveLength(0);
      else { expect(field(f.root, 'title').value).toBe('New independent draft'); expect(f.root.querySelector('.shell-document-grid [role="alert"]')).toBeNull(); }
      expect(f.observe).not.toHaveBeenCalled();
    } finally { gate.resolve(failure('storage', 'error.open')); f.dispose(); }
  }
});

it('[PL-C71] disposing runtime recovery invalidates pending and retained sink actions while leaving an unrelated notice intact', async () => {
  const f = await componentFixture(); const pending = deferred<boolean>(); const sinks = new Set<() => void>();
  let retained: readonly NoticeAction[] = []; const run = vi.fn(); const available = vi.fn(() => pending.promise);
  const foreign = document.createElement('div'); foreign.textContent = 'Unrelated owner'; document.body.append(foreign);
  f.native.notification = (text, actions) => {
    retained = actions;
    return browserNotification(text, actions, close => { sinks.add(close); return () => { sinks.delete(close); }; });
  };
  const unregister = f.services.notices.registerActions('recovery-owner', { open: { labelKey: 'doc.open', available, run } });
  try {
    const notice = f.services.notices.error({ owner: 'recovery-owner', operation: 'committed-open', key: 'error.open', actions: ['open'], native: true });
    expect(sinks.size).toBe(1); expect(document.querySelectorAll('.harness-native-notice button')).toHaveLength(1);
    const action = retained[0]; if (!action) throw new Error('Missing actual sink action');
    action.invoke(); action.invoke(); await settle(); expect(available).toHaveBeenCalledOnce(); expect(run).not.toHaveBeenCalled();
    f.close(); await settle(); expect(sinks.size).toBe(1); // Explicit runtime recovery outlives this view.
    f.services.dispose(); unregister(); pending.resolve(true); await settle(); action.invoke(); await settle();
    expect(sinks.size).toBe(0); expect(document.querySelectorAll('.harness-native-notice button')).toHaveLength(0);
    expect(f.services.notices.current).toEqual([]); expect(run).not.toHaveBeenCalled(); expect(available).toHaveBeenCalledOnce();
    expect(notice?.update({ kind: 'success', key: 'feedback.saved' })).toBe(false);
    expect(foreign.isConnected).toBe(true); expect(foreign.textContent).toBe('Unrelated owner'); expect(f.observe).not.toHaveBeenCalled();
  } finally { pending.resolve(true); unregister(); f.dispose(); }
});
