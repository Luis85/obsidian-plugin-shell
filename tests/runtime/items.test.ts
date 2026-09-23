// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createItemActions } from '../../src/features/items/actions';
import { defaults } from '../../src/domain/preferences';
import { deferred } from './helpers';
import { unwrap } from './repository-helpers';
import { itemsFixture, modalDecision } from './items-fixture';

describe('Item reference actions and real per-view projections', () => {
  it('persists trimmed CRUD, stable IDs and concurrent preferences through the one writer without note writes or duplicate facts', async () => {
    const f = await itemsFixture(); const first = f.view(); const second = f.view();
    const assertReload = async (expected: readonly { id: string; label: string }[]) => {
      const restored = await itemsFixture(f.raw());
      try {
        const view = restored.view(); await flushPromises(); expect(view.state.loaded).toBe(true);
        expect(view.state.items.map(item => ({ id: item.id, label: item.values.label }))).toEqual(expected);
        expect(restored.storage.save).not.toHaveBeenCalled(); expect(restored.observe).not.toHaveBeenCalled();
      } finally { restored.dispose(); }
    };
    try {
      const facts: string[] = [];
      const stops = (['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted'] as const).map(type => f.services.events.on(type, () => { facts.push(type); }));
      await flushPromises(); expect(first.state.loaded).toBe(true); expect(first.state.items).toEqual([]);
      first.state.createDraft = '  One item  '; second.state.createDraft = 'Other view draft';
      await Promise.all([first.state.create(), f.services.preferences.update({ locale: 'de' })]);
      await flushPromises(); const item = first.state.items[0]; if (!item) throw new Error('Missing item');
      expect(item.values.label).toBe('One item'); expect(second.state.items[0]?.id).toBe(item.id);
      expect(first.state.createDraft).toBe(''); expect(second.state.createDraft).toBe('Other view draft');
      await assertReload([{ id: item.id, label: 'One item' }]);
      first.state.edit(item); first.state.renameDraft = '  Renamed  '; await first.state.rename(); await flushPromises();
      expect(first.state.selected).toMatchObject({ id: item.id, createdAt: item.createdAt, values: { label: 'Renamed' } });
      expect(second.state.items[0]?.values.label).toBe('Renamed');
      await assertReload([{ id: item.id, label: 'Renamed' }]);
      expect(JSON.stringify(f.raw())).toBe(JSON.stringify({ schemaVersion: 1, preferences: { hideObsidianViewHeader: false, locale: 'de', taskFolder: 'Tasks', notifySuccess: true }, pluginEntities: { schemaVersion: 1, collections: { item: { schemaVersion: 1, revision: 2, records: [{ id: item.id, revision: 2, createdAt: item.createdAt, values: { label: 'Renamed' } }] } } } }));
      const late = f.view(); await flushPromises(); expect(late.state.items[0]?.id).toBe(item.id);
      // Locale follows the real preference service; restore English for explicit dialog assertions.
      await f.services.preferences.update({ locale: 'en' });
      const cancelled = first.state.remove(); await modalDecision(false); await cancelled;
      expect(first.state.items).toHaveLength(1); expect(f.storage.save).toHaveBeenCalledTimes(4);
      const deleting = first.state.remove(); await modalDecision(true); await deleting; await flushPromises();
      expect(first.state.items).toEqual([]); expect(second.state.items).toEqual([]); expect(first.state.message).toBe('items.deleted');
      expect(facts).toEqual(['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted']);
      expect(f.storage.save).toHaveBeenCalledTimes(5); expect(f.memory.files.size).toBe(0);
      await assertReload([]);
      for (const stop of stops) stop();
    } finally { f.dispose(); }
  });
  it('rejects invalid labels without writes, keeps failed drafts, and requires explicit stale-snapshot review', async () => {
    const f = await itemsFixture(); const a = f.view(); const b = f.view();
    try {
      for (const label of ['  ', 'x'.repeat(121)]) {
        a.state.createDraft = label; await a.state.create();
        expect(a.state.error).toMatchObject({ key: 'items.invalid', field: 'label' }); expect(a.state.createDraft).toBe(label);
      }
      expect(f.storage.save).not.toHaveBeenCalled();
      a.state.createDraft = 'x'.repeat(120); await a.state.create(); await flushPromises();
      const item = a.state.items[0]; if (!item) throw new Error('Missing item');
      a.state.edit(item); b.state.edit(item); b.state.renameDraft = 'My retained rename';
      a.state.renameDraft = ''; await a.state.rename(); expect(a.state.error?.key).toBe('items.invalid');
      a.state.renameDraft = 'Changed elsewhere'; await a.state.rename(); await flushPromises();
      expect(b.state.selected?.revision).toBe(item.revision); expect(b.state.items[0]?.values.label).toBe('Changed elsewhere');
      await b.state.rename(); expect(b.state.error?.code).toBe('stale'); expect(b.state.message).toBe(''); expect(b.state.renameDraft).toBe('My retained rename');
      expect(f.storage.save).toHaveBeenCalledTimes(2);
      await b.state.reload(); expect(b.state.selected?.values.label).toBe('Changed elsewhere'); expect(b.state.renameDraft).toBe('My retained rename');
      await b.state.rename(); expect(b.state.message).toBe('items.renamed'); expect(f.storage.save).toHaveBeenCalledTimes(3);
    } finally { f.dispose(); }
  });
  it('shows pending state, guards double submission, and locks uncertain saves until a new runtime reads actual bytes', async () => {
    const f = await itemsFixture(); const a = f.view(); const gate = deferred(); const entered = deferred();
    try {
      const persist = f.storage.save.getMockImplementation(); if (!persist) throw new Error('Missing save');
      f.storage.save.mockImplementationOnce(async value => { entered.resolve(); await gate.promise; await persist(value); throw new Error('Acknowledgment lost'); });
      a.state.createDraft = 'Preserved draft'; const saving = a.state.create(); await entered.promise;
      expect(a.state.pending).toBe(true); await a.state.create(); await a.state.reload();
      gate.resolve(); await saving;
      expect(a.state.blocked).toBe(true); expect(a.state.error?.effect).toBe('uncertain'); expect(a.state.message).toBe('');
      expect(a.state.createDraft).toBe('Preserved draft'); await a.state.create(); await a.state.reload();
      expect(f.storage.save).toHaveBeenCalledOnce();
      const recovered = await itemsFixture(f.raw());
      try { const next = recovered.view(); await flushPromises(); expect(next.state.items[0]?.values.label).toBe('Preserved draft'); next.state.createDraft = 'Deliberate next item'; await next.state.create(); expect(recovered.storage.save).toHaveBeenCalledOnce(); }
      finally { recovered.dispose(); }
    } finally { f.dispose(); }
  });
  it('preserves corrupt and future collections and reports no successful action', async () => {
    for (const schemaVersion of [2, 'invalid']) {
      const raw = { schemaVersion: 1, preferences: defaults, pluginEntities: { schemaVersion, collections: {} } };
      const f = await itemsFixture(raw); const a = f.view();
      try {
        await flushPromises(); expect(a.state.error?.key).toBe('error.pluginDataRead');
        a.state.createDraft = 'Kept'; await a.state.create(); expect(a.state.message).toBe(''); expect(a.state.createDraft).toBe('Kept');
        expect(f.storage.save).not.toHaveBeenCalled(); expect(f.raw()).toEqual(raw);
      } finally { f.dispose(); }
    }
  });
  it('ignores older delayed queries, catches independent subscriber failures and releases each view owner', async () => {
    const f = await itemsFixture();
    try {
      const baseline = f.services.events.size;
      const list = f.services.repositories.items.list.bind(f.services.repositories.items);
      const old = await list(); const gate = deferred<typeof old>();
      const spy = vi.spyOn(f.services.repositories.items, 'list').mockReturnValueOnce(gate.promise);
      const a = f.view();
      const stop = f.services.events.on('plugin-data.created', () => { throw new Error('Subscriber failure'); });
      const asyncStop = f.services.events.on('plugin-data.created', async () => { throw new Error('Async subscriber failure'); });
      await f.services.repositories.items.create({ label: 'Newer' }); await flushPromises();
      expect(a.state.items[0]?.values.label).toBe('Newer'); gate.resolve(old); await flushPromises();
      expect(a.state.items[0]?.values.label).toBe('Newer'); expect(f.observe).toHaveBeenCalledTimes(2);
      const b = f.view(); await flushPromises(); a.close(); expect(f.services.events.size).toBe(baseline + 5);
      await f.services.repositories.items.create({ label: 'After close' }); await flushPromises();
      expect(a.state.items).toHaveLength(1); expect(b.state.items).toHaveLength(2);
      b.close(); stop(); asyncStop(); expect(f.services.events.size).toBe(baseline); spy.mockRestore();
    } finally { f.dispose(); }
  });
  it('contains unexpected query/action failures and suppresses late work after view disposal', async () => {
    const f = await itemsFixture(); const a = f.view();
    try {
      await flushPromises(); await a.state.rename(); await a.state.remove();
      const list = vi.spyOn(f.services.repositories.items, 'list').mockRejectedValueOnce(new Error('query'));
      await a.state.reload(); expect(a.state.error?.effect).toBe('none'); await a.state.reload(); expect(a.state.error).toBeUndefined();
      const create = vi.spyOn(f.services.repositories.items, 'create').mockRejectedValueOnce(new Error('action'));
      a.state.createDraft = 'Retained'; await a.state.create(); expect(a.state.blocked).toBe(true); expect(a.state.createDraft).toBe('Retained');
      create.mockRestore(); list.mockRestore();
      a.state.edit(unwrap(await f.services.repositories.items.create({ label: 'Actual' })));
      expect(a.state.selected).toBeUndefined();
      const b = f.view(); await flushPromises(); const gate = deferred(); const entered = deferred();
      f.storage.save.mockImplementationOnce(async () => { entered.resolve(); await gate.promise; });
      b.state.createDraft = 'Closing'; const work = b.state.create(); await entered.promise; b.close(); gate.resolve(); await work;
      expect(b.state.message).toBe(''); await b.state.create(); await b.state.reload(); expect(f.storage.save).toHaveBeenCalledTimes(2);
    } finally { f.dispose(); }
  });
  it('closes a pending confirmation on disposal and preserves a stale deletion result', async () => {
    const f = await itemsFixture(); const a = f.view();
    try {
      const item = unwrap(await f.services.repositories.items.create({ label: 'Delete target' })); await flushPromises(); a.state.edit(item);
      const work = a.state.remove(); await flushPromises(); a.close(); await work;
      expect(document.querySelector('dialog')).toBeNull(); expect(f.storage.save).toHaveBeenCalledOnce();
      const b = f.view(); await flushPromises(); b.state.edit(item);
      const confirmed = b.state.remove(); await flushPromises();
      const button = Array.from(document.querySelectorAll('dialog button')).find(element => element.textContent === 'Delete item');
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing delete confirmation');
      button.click(); b.close(); await confirmed;
      expect(f.storage.save).toHaveBeenCalledOnce(); expect(unwrap(await f.services.repositories.items.list())).toHaveLength(1);
      const actions = createItemActions(f.services.repositories.items, f.services.modals, 'items-test', () => true);
      const deletion = actions.remove(item); await flushPromises(); await actions.rename(item, 'Newer'); await modalDecision(true);
      expect(await deletion).toMatchObject({ ok: false, error: { code: 'stale' } });
      f.services.modals.dispose(); expect(await actions.remove(item)).toMatchObject({ ok: false, error: { code: 'disposed' } });
    } finally { f.dispose(); }
  });
});
