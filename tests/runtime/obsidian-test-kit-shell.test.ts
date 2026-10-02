// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App } from 'obsidian';
import ShellPlugin from '../../src/main';
import { createServices } from '../../src/bootstrap/services';
import { nativeAdapters } from '../../src/infrastructure/obsidian/adapters';
import { SHOWCASE_VIEW, ShowcaseView } from '../../src/infrastructure/obsidian/showcase-view';
import { pluginIdentity } from '../../src/infrastructure/plugin-identity';
import { createTestApp, flushObsidian } from '@test/obsidian';
import manifest from '../../manifest.json';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const dataPath = `.obsidian/plugins/${manifest.id}/data.json`;
const handwritten = '---\ntype: task\nid: handwritten-1\nschema_version: 1\ncreated_at: "2026-09-20T08:00:00.000Z"\ntitle: Handwritten\nstatus: todo\ntags: []\ncustom: keep me\n---\n\n# Handwritten\n\nMy *own* body.\n';

it('loads the real shell entry: commands, ribbon, view, settings and host listeners register and unload cleanly', async () => {
  const app = new App(); const kit = createTestApp({ app, files: { 'Inbox.md': '# Inbox\n' } });
  const plugin = new ShellPlugin(app, manifest);
  await kit.loadPlugin(plugin);
  const ids = kit.commands().map(command => command.id);
  expect(ids).toEqual(expect.arrayContaining(['open-showcase', 'toggle-view-header', 'debug-toggle', 'debug-report'].map(id => `${manifest.id}:${id}`)));
  expect(kit.ribbons()).toHaveLength(1);
  expect(kit.vault.listenerCount('create')).toBe(1); expect(kit.metadataCache.listenerCount('changed')).toBe(1);
  expect(await kit.runCommand('open-showcase')).toBe(true);
  const [leaf, ...others] = kit.workspace.getLeavesOfType(SHOWCASE_VIEW);
  if (!leaf || !(leaf.view instanceof ShowcaseView)) throw new Error('SHOWCASE_VIEW_NOT_OPENED');
  expect(others).toEqual([]);
  expect(leaf.view.containerEl.querySelector('[data-testid="showcase"]')).not.toBeNull();
  await kit.clickRibbon(kit.ribbons()[0]?.title ?? ''); expect(kit.workspace.getLeavesOfType(SHOWCASE_VIEW)).toEqual([leaf]);
  const tab = kit.openSettings(plugin);
  const row = [...tab.containerEl.querySelectorAll('.setting-item')].find(item => item.querySelector('.setting-item-name')?.textContent === 'Hide Obsidian view header');
  const toggle = row?.querySelector<HTMLElement>('.checkbox-container');
  if (!toggle) throw new Error('HEADER_TOGGLE_NOT_RENDERED');
  const write = vi.spyOn(kit.vault.adapter, 'write');
  toggle.click(); await flushObsidian();
  expect(write).toHaveBeenCalledOnce(); expect(write.mock.calls[0]?.[0]).toBe(dataPath);
  expect(toggle.classList.contains('is-enabled')).toBe(true);
  expect(JSON.parse(kit.read(dataPath))).toMatchObject({ preferences: { hideObsidianViewHeader: true } });
  expect(leaf.view.containerEl.classList.contains(pluginIdentity.hiddenHeaderClass)).toBe(true);
  await kit.unloadPlugin(plugin);
  expect(kit.commands()).toEqual([]); expect(kit.ribbons()).toEqual([]); expect(kit.app.setting.pluginTabs).toEqual([]);
  expect(kit.workspace.getLeavesOfType(SHOWCASE_VIEW)).toEqual([leaf]);
  expect(leaf.view).not.toBeInstanceOf(ShowcaseView); expect(document.querySelector('[data-testid="showcase"]')).toBeNull();
  expect(document.querySelector(`.${pluginIdentity.hiddenHeaderClass}`)).toBeNull();
  expect(kit.vault.listenerCount('create')).toBe(0); expect(kit.metadataCache.listenerCount('changed')).toBe(0);
  expect(kit.errors).toEqual([]);
});

it('persists exact task Markdown through the native adapters and preserves unrelated note bytes', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-26T08:00:00.000Z'));
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
  const app = new App(); const kit = createTestApp({ app, files: { 'Tasks/Handwritten.md': handwritten, 'Notes/Unrelated.md': 'Keep\r\n' } });
  const services = await createServices(nativeAdapters(new ShellPlugin(app, manifest)));
  const events: string[] = [];
  for (const name of ['create', 'modify', 'delete', 'rename']) kit.vault.on(name, (file: { path: string }) => events.push(`${name}:${file.path}`));
  try {
    const tasks = services.repositories.task;
    const created = await tasks.create({ title: 'Release checklist', tags: ['work', 'release'], due: '2026-09-30' }, 'kit-request-1');
    if (!created.ok) throw new Error(created.error.key);
    const expected = '---\ntype: "task"\nid: "00000000-0000-4000-8000-000000000001"\nschema_version: 1\ncreated_at: "2026-09-26T08:00:00.000Z"\n'
      + 'title: "Release checklist"\nstatus: "todo"\ntags:\n  - "work"\n  - "release"\ndue: "2026-09-30"\n---\n\n# Release checklist\n\n## Notes\n\n';
    expect(kit.read('Tasks/Release checklist.md')).toBe(expected);
    const listed = await tasks.list(); if (!listed.ok) throw new Error(listed.error.key);
    const own = listed.value.find(row => row.path === 'Tasks/Handwritten.md'); if (!own) throw new Error('HANDWRITTEN_NOT_LISTED');
    expect((await tasks.update(own, { title: 'Handwritten', status: 'done', tags: [] })).ok).toBe(true);
    expect(kit.read('Tasks/Handwritten.md')).toBe(handwritten.replace('status: todo', 'status: done'));
    await flushObsidian();
    expect(kit.metadataCache.getFileCache(kit.file('Tasks/Handwritten.md'))?.frontmatter).toMatchObject({ status: 'done', custom: 'keep me' });
    expect((await tasks.delete(created.value)).ok).toBe(true);
    expect(kit.vault.trashed).toEqual([{ path: 'Tasks/Release checklist.md', system: false, data: expected }]);
    expect(kit.read('.trash/Release checklist.md')).toBe(expected);
    expect(kit.read('Notes/Unrelated.md')).toBe('Keep\r\n');
    expect(events).toEqual(['create:Tasks/Release checklist.md', 'modify:Tasks/Handwritten.md', 'delete:Tasks/Release checklist.md']);
    expect(kit.errors).toEqual([]);
  } finally { services.dispose(); }
});
