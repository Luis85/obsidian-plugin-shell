import { describe, expect, it, vi } from 'vitest';
import { createServices } from '../../src/bootstrap/services';
import { browserDocumentStorage } from '../../harness/app/document-storage';
import { host } from './helpers';

describe('Real runtime repository composition', () => {
  it('registers Task and Project with one storage contract, preferences folder and independent definitions', async () => {
    let files: Record<string, string> = {}; let sequence = 0;
    const save = vi.fn(async (_value: unknown): Promise<void> => undefined);
    const services = await createServices({
      settings: { load: async () => null, save }, local: { get: () => null, set() {} }, host: host(),
      documents: browserDocumentStorage(() => ({ ...files }), value => { files = value; }, () => false),
      newId: () => `entity-${++sequence}`, now: () => '2026-09-22T12:00:00.000Z',
      scheduler: { after(ms, callback) { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); } },
    });
    try {
      const task = await services.repositories.task.create({ title: 'A Task' }, 'task-request');
      const project = await services.repositories.project.create({ name: 'A Project', budget: 0, archived: false }, 'project-request');
      if (!task.ok || !project.ok) throw new Error('Creation failed');
      expect(task.value.path.startsWith('Tasks/')).toBe(true); expect(project.value.path.startsWith('Projects/')).toBe(true);
      expect(project.value.values).toEqual({ name: 'A Project', budget: 0, archived: false });
      expect(files[project.value.path]).toContain('budget: 0\narchived: false\n');
      expect(save).not.toHaveBeenCalled();
      const updated = await services.repositories.project.update(project.value, { name: 'Revised', budget: 10, archived: true });
      if (!updated.ok) throw new Error('Update failed');
      expect(updated.value.id).toBe(project.value.id); expect(updated.value.path).toBe(project.value.path);
      expect((await services.repositories.project.delete(updated.value)).ok).toBe(true);
      expect(await services.repositories.project.list()).toEqual({ ok: true, value: [] });
      const tasks = await services.repositories.task.list(); expect(tasks.ok && tasks.value.length).toBe(1);
      await services.preferences.update({ taskFolder: 'Work/Tasks' });
      expect(await services.repositories.task.list()).toEqual({ ok: true, value: [] });
      const next = await services.repositories.task.create({ title: 'Moved folder' }, 'next-request');
      expect(next.ok && next.value.path.startsWith('Work/Tasks/')).toBe(true);
      expect(files[task.value.path]).toBeDefined();
    } finally { services.dispose(); }
    expect(await services.repositories.task.list()).toMatchObject({ ok: false, error: { code: 'disposed' } });
    expect(await services.repositories.project.list()).toMatchObject({ ok: false, error: { code: 'disposed' } });
  });
});
