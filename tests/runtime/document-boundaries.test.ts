import { describe, expect, it, vi } from 'vitest';
import { DocumentCreationService, type DocumentDefinition } from '../../src/application/document-service';
import { success } from '../../src/domain/outcome';
import { renderMarkdown } from '../../src/infrastructure/markdown';
import { fixture, input } from './helpers';
import { unwrap } from './repository-helpers';

describe('Document preparation contract boundaries', () => {
  it('[DOC-03-01] bounds the request ledger and validates external request names', () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) expect(f.documents.prepare('task', input, 'Tasks', `r${i}`).ok).toBe(true);
    expect(f.documents.prepare('task', input, 'Tasks', 'full')).toMatchObject({ ok: false, error: { key: 'error.sessionLimit' } });
    expect(f.documents.prepare('task', input, 'Tasks', '../invalid')).toMatchObject({ ok: false, error: { key: 'error.request' } });
    expect(Reflect.apply(f.documents.prepare, f.documents, ['missing', input, 'Tasks', 'missing'])).toMatchObject({ ok: false, error: { key: 'error.entity' } });
    expect(Reflect.apply(f.documents.prepare, f.documents, ['constructor', input, 'Tasks', 'missing'])).toMatchObject({ ok: false, error: { key: 'error.entity' } });
    expect(f.writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-03-02] validates managed IDs and schema versions before writing', () => {
    const f = fixture();
    const definition = { project: () => success({ title: 'Item', properties: {}, body: '', schemaVersion: 1 }) };
    const invalidId = new DocumentCreationService({ item: definition }, f.writer, f.bus, renderMarkdown, () => '../unsafe', () => 'clock');
    expect(invalidId.prepare('item', {}, 'Items', 'r').ok).toBe(false);
    for (const version of [0, -1, 1.5, NaN]) {
      const service = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: {}, body: '', schemaVersion: version }) } }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock');
      expect(service.prepare('item', {}, 'Items', 'r').ok).toBe(false);
    }
    expect(f.writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-03-03] managed property override and render-size failures cannot create partial files', () => {
    const f = fixture();
    for (const name of ['id', 'type', 'schema_version', 'created_at']) {
      const service = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: { [name]: 'override' }, body: '' }) } }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock');
      expect(service.prepare('item', {}, 'Items', 'r').ok).toBe(false);
    }
    const hugeBody = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: {}, body: 'x'.repeat(1_000_001) }) } }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock');
    expect(hugeBody.prepare('item', {}, 'Items', 'r').ok).toBe(false);
    const hugeEncoded = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: { text: 'x'.repeat(1_000_000) }, body: '' }) } }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock');
    expect(hugeEncoded.prepare('item', {}, 'Items', 'r').ok).toBe(false);
    expect(f.writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-03-04] checked-in render callbacks are captured and their exceptions are contained', () => {
    const f = fixture();
    const definition: DocumentDefinition<object> = { project() { throw new Error('private entity contents'); } };
    const service = new DocumentCreationService({ item: definition }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock', f.errors);
    expect(service.prepare('item', {}, 'Items', 'r')).toMatchObject({ ok: false, error: { code: 'unexpected', effect: 'none' } });
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('document.prepare', 'document.prepare');
    const serialize = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: {}, body: '' }) } }, f.writer, f.bus, () => { throw new Error('render'); }, () => 'id', () => 'clock');
    expect(serialize.prepare('item', {}, 'Items', 'r').ok).toBe(false); expect(f.writer.create).not.toHaveBeenCalled();
  });
  it('[DOC-03-05] publish exceptions cannot erase a committed receipt or trigger another write', async () => {
    const f = fixture(); vi.spyOn(f.bus, 'publish').mockImplementation(() => { throw new Error('listener'); });
    const service = new DocumentCreationService({ item: { project: () => success({ title: 'Item', properties: {}, body: '', schemaVersion: 3 }) } }, f.writer, f.bus, renderMarkdown, () => 'id', () => 'clock', f.errors);
    const plan = unwrap(service.prepare('item', {}, 'Items', 'r'));
    const receipt = unwrap(await service.commit(plan, 'Items'));
    expect(receipt.schemaVersion).toBe(3);
    expect(await service.commit(plan, 'Items')).toEqual(success(receipt));
    expect(f.writer.create).toHaveBeenCalledTimes(1); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('event.publish', 'document.publish');
    expect(service.discard({ ...plan })).toBe(false);
  });
});
