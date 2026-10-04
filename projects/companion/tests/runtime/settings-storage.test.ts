import { expect, it, vi } from 'vitest';
import { nativeSettingsStorage } from '../../src/infrastructure/obsidian/settings-storage';
import { PluginDataStore } from '../../src/application/plugin-data-store';

function fixture(dir?: string) {
  const reader = { exists: vi.fn(async () => true), read: vi.fn(async () => 'null') };
  const plugin = { manifest: { id: 'fixture', dir }, app: { vault: { configDir: '.custom', adapter: reader } },
    loadData: vi.fn(async () => null), saveData: vi.fn(async (_data: unknown) => undefined) };
  const storage = nativeSettingsStorage(plugin);
  const errors = { report: vi.fn() };
  return { plugin, reader, storage, errors, store: new PluginDataStore(storage, errors) };
}

it('SETTINGS-RAW-01 preserves present null and malformed bytes using the host manifest directory and one writer', async () => {
  for (const bytes of ['null', '{bad JSON']) {
    const f = fixture('.custom/plugins/relocated/'); f.reader.read.mockResolvedValue(bytes);
    await f.store.load();
    expect(f.store.status).toBe('corrupt'); expect(f.store.readonly).toBe(true);
    expect(f.reader.exists).toHaveBeenCalledExactlyOnceWith('.custom/plugins/relocated/data.json');
    expect(f.reader.read).toHaveBeenCalledExactlyOnceWith('.custom/plugins/relocated/data.json');
    expect(f.plugin.loadData).not.toHaveBeenCalled(); expect(f.plugin.saveData).not.toHaveBeenCalled();
    expect(f.errors.report.mock.calls).toEqual([['settings.read', 'settings.load']]);
    f.store.dispose();
  }
  const f = fixture();
  expect(await f.storage.load()).toBeNull();
  await f.storage.save({ reviewed: true });
  expect(f.plugin.saveData).toHaveBeenCalledExactlyOnceWith({ reviewed: true });
});

it('SETTINGS-RAW-02 distinguishes confirmed absence from a file disappearing or becoming inaccessible during read', async () => {
  const absent = fixture(); absent.reader.exists.mockResolvedValue(false);
  await absent.store.load();
  expect(absent.store.status).toBe('absent'); expect(absent.store.readonly).toBe(false);
  expect(absent.reader.exists).toHaveBeenCalledExactlyOnceWith('.custom/plugins/fixture/data.json');
  expect(absent.reader.read).not.toHaveBeenCalled(); expect(absent.plugin.saveData).not.toHaveBeenCalled();
  expect(absent.errors.report).not.toHaveBeenCalled(); absent.store.dispose();
  for (const boundary of ['exists', 'read'] as const) {
    const f = fixture(); f.reader[boundary].mockRejectedValueOnce(new Error('unavailable'));
    await f.store.load();
    expect(f.store.status).toBe('inaccessible'); expect(f.store.readonly).toBe(true);
    expect(f.plugin.saveData).not.toHaveBeenCalled(); expect(f.plugin.loadData).not.toHaveBeenCalled();
    expect(f.errors.report.mock.calls).toEqual([['settings.read', 'settings.load']]); f.store.dispose();
  }
});
