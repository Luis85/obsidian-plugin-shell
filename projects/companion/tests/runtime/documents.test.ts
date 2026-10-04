import { describe, it, expect, vi } from 'vitest';
import { parse } from 'yaml';
import { failure, success } from '../../src/domain/outcome';
import { DocumentCreationService } from '../../src/application/document-service';
import { renderMarkdown } from '../../src/infrastructure/markdown';
import { fixture, input, deferred } from './helpers';
describe('DocumentCreationService', () => {
  it('validates the captured projection values without re-reading mutable accessors', () => {
    const { writer, bus } = fixture(); let reads = 0;
    const projected = Object.defineProperty({ title: 'Snapshot', properties: {}, body: 'valid' }, 'body', {
      enumerable: true, get: () => ++reads === 2 ? undefined : 'valid',
    });
    const serialize = vi.fn(() => 'must not serialize invalid captured data');
    const service = new DocumentCreationService<{ sample: void }>({ sample: { project: () => success(projected) } }, writer, bus, serialize, () => 'snapshot-1', () => 'fixed');
    expect(service.prepare('sample', undefined, 'Samples', 'request')).toMatchObject({ ok: false, error: { code: 'validation', key: 'error.entity' } });
    expect(reads).toBe(2); expect(serialize).not.toHaveBeenCalled(); expect(writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-I01] preview produces exact valid YAML and has no write effects', () => {
    const { documents, writer } = fixture();
    const result = documents.prepare('task', input, 'Tasks', 'submit-1');
    expect(result.ok).toBe(true); expect(writer.create).not.toHaveBeenCalled();
    if (!result.ok) throw new Error('preview');
    const yaml = result.value.markdown.split('---')[1];
    expect(parse(yaml ?? '')).toEqual({ type: 'task', id: 'id-1', schema_version: 1, created_at: '2026-09-22T12:00:00.000Z', title: input.title, status: 'todo', tags: ['work', 'release'], due: input.due });
    expect(result.value.markdown).toContain('due: "2026-09-30"');
    expect(result.value.path).toBe('Tasks/Release checklist.md');
    expect(documents.prepare('task', input, 'Tasks', 'submit-1')).toEqual(result);
  });
  it('[DOC-I02] preserves preview identity and commits once under concurrent confirmation', async () => {
    const { documents, writer, bus } = fixture();
    const barrier = deferred<ReturnType<typeof success<void>>>();
    writer.create.mockImplementation(() => barrier.promise);
    const received = vi.fn(); bus.on('documents.created', received);
    const result = documents.prepare('task', input, 'Tasks', 'request'); if (!result.ok) throw new Error('preview');
    const a = documents.commit(result.value, 'Tasks'); const b = documents.commit(result.value, 'Tasks');
    expect(writer.create).toHaveBeenCalledExactlyOnceWith(result.value.path, result.value.markdown); expect(received).not.toHaveBeenCalled();
    barrier.resolve(success(undefined));
    expect(await a).toEqual(await b); expect(received).toHaveBeenCalledTimes(1);
    expect(await documents.commit(result.value, 'Tasks')).toEqual(await a); expect(writer.create).toHaveBeenCalledTimes(1);
  });
  it('[DOC-I03] rejects invalid input, changed request and stale destinations', async () => {
    const { documents, writer } = fixture();
    expect(documents.prepare('task', { ...input, title: '' }, 'Tasks', 'request').ok).toBe(false);
    expect(documents.prepare('task', input, '../Tasks', 'request').ok).toBe(false);
    const result = documents.prepare('task', input, 'Tasks', 'request'); if (!result.ok) throw new Error('preview');
    expect(documents.prepare('task', { ...input, title: 'other' }, 'Tasks', 'request').ok).toBe(false);
    expect((await documents.commit(result.value, 'New')).ok).toBe(false);
    expect((await documents.commit({ ...result.value }, 'Tasks')).ok).toBe(false);
    expect(writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-I04] uncertainty is cached and never emits a created fact or blindly retries', async () => {
    const { documents, writer, bus } = fixture(); const received = vi.fn(); bus.on('documents.created', received);
    writer.create.mockRejectedValueOnce(new Error('disk response lost'));
    const result = documents.prepare('task', input, 'Tasks', 'request'); if (!result.ok) throw new Error('preview');
    expect(await documents.commit(result.value, 'Tasks')).toMatchObject({ ok: false, error: { code: 'uncertain', effect: 'uncertain' } });
    await documents.commit(result.value, 'Tasks'); expect(writer.create).toHaveBeenCalledTimes(1); expect(received).not.toHaveBeenCalled();
  });
  it('[DOC-I05] typed failed writes do not emit success; disposed service blocks new writes', async () => {
    const { documents, writer, bus } = fixture(); const received = vi.fn(); bus.on('documents.created', received);
    writer.create.mockResolvedValueOnce(failure('conflict', 'error.conflict'));
    const result = documents.prepare('task', input, 'Tasks', 'request'); if (!result.ok) throw new Error('preview');
    expect(await documents.commit(result.value, 'Tasks')).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(received).not.toHaveBeenCalled(); documents.dispose();
    expect(documents.prepare('task', input, 'Tasks', 'another').ok).toBe(false);
    expect((await documents.commit(result.value, 'Tasks')).ok).toBe(false);
  });
  it('[DOC-I06] second entity uses the same service and preserves false/zero/string scalars', async () => {
    const { writer, bus } = fixture();
    const service = new DocumentCreationService<{ meeting: { title: string } }>({ meeting: { project: value => success({ title: value.title, properties: { title: value.title, label: 'false: # [note]', archived: false, effort: 0 }, body: '# Meeting' }) } }, writer, bus, renderMarkdown, () => 'meeting-1', () => 'fixed');
    const result = service.prepare('meeting', { title: 'false # [note]' }, 'Meetings', 'r'); if (!result.ok) throw new Error('preview');
    const values = parse(result.value.markdown.split('---')[1] ?? ''); expect(values.title).toBe('false # [note]'); expect(values.label).toBe('false: # [note]'); expect(values.archived).toBe(false); expect(values.effort).toBe(0);
    expect((await service.commit(result.value, 'Meetings')).ok).toBe(true);
  });
  it('[DOC-I07] a failing subscriber cannot relabel a committed write as failure', async () => {
    const { documents, bus, errors } = fixture(); bus.on('documents.created', () => { throw new Error('subscriber'); });
    const p = documents.prepare('task', input, 'Tasks', 'r'); if (!p.ok) throw new Error('preview');
    expect((await documents.commit(p.value, 'Tasks')).ok).toBe(true);
    expect(errors.report).toHaveBeenCalledWith('event.listener', 'event.dispatch');
  });
});

it('[DOC-02-01] abandoning a preview releases only an unattempted request', async () => {
  const f = fixture(); const prepared = f.documents.prepare('task', input, 'Tasks', 'unused');
  if (!prepared.ok) throw new Error('prepare');
  expect(f.documents.discard(prepared.value)).toBe(true);
  expect((await f.documents.commit(prepared.value, 'Tasks')).ok).toBe(false);
  const committed = f.documents.prepare('task', input, 'Tasks', 'committed');
  if (!committed.ok) throw new Error('prepare');
  await f.documents.commit(committed.value, 'Tasks'); expect(f.documents.discard(committed.value)).toBe(false);
  await f.documents.commit(committed.value, 'Tasks'); expect(f.writer.create).toHaveBeenCalledTimes(1);
});
