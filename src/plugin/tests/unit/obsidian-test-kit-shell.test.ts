// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App } from 'obsidian';
import ShellPlugin from '../../main';
import { createServices } from '../../bootstrap/services';
import { nativeAdapters } from '../../infrastructure/obsidian/adapters';
import { createTestApp, flushObsidian } from '@test/obsidian';
import manifest from '../../../../manifest.json';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const handwritten = '---\ntype: task\nid: handwritten-1\nschema_version: 1\ncreated_at: "2026-09-20T08:00:00.000Z"\ntitle: Handwritten\nstatus: todo\ntags: []\ncustom: keep me\n---\n\n# Handwritten\n\nMy *own* body.\n';

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
