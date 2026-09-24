import { expect, it, vi } from 'vitest';
import { DocumentCreationService } from '../../src/application/document-service';
import { failure, success } from '../../src/domain/outcome';
import { fitsUtf8Bytes } from '../../src/domain/utf8';
import { markdownCodec, renderMarkdown } from '../../src/infrastructure/markdown';
import { repositoryFixture, unwrap } from './repository-helpers';

const limit = 1_000_000;
it('[BOUND-62-04] framework-free UTF-8 validation counts scalars, rejects invalid input and stops at exact budgets', () => {
  for (const text of ['', 'ASCII', '\u007f', '\u0080', '\u07ff', '\u0800', '\ud7ff', '\ue000', '\uffff', '😀', 'é中😀', 'e\u0301']) {
    const bytes = Buffer.byteLength(text, 'utf8');
    expect(fitsUtf8Bytes(text, bytes)).toBe(true);
    expect(fitsUtf8Bytes(text, bytes + 1)).toBe(true);
    expect(fitsUtf8Bytes(text, bytes - 1)).toBe(false);
  }
  for (const value of [null, undefined, 123, {}, [], '\ud800', '\udfff', 'before\ud800after', '\ud800\ud800', '\udfff\udfff']) {
    expect(fitsUtf8Bytes(value, 100)).toBe(false);
  }
  for (const maximum of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(fitsUtf8Bytes('', maximum)).toBe(false);
});
function document(body: string) {
  const writer = { create: vi.fn(async () => success(undefined)) };
  const events = { publish: vi.fn() };
  const service = new DocumentCreationService({ journal: { project: () => success({ title: 'Entry', properties: {}, body }) } },
    writer, events, renderMarkdown, () => 'entry-id', () => '2026-09-24T12:00:00.000Z');
  return { writer, events, service };
}

it('[BOUND-62-01] multibyte and malformed bodies fail before preview acquires a write or publishes a fact', () => {
  for (const body of ['é'.repeat(500_001), '中'.repeat(333_334), '😀'.repeat(250_001), '\ud800', '\udfff']) {
    const f = document(body);
    try {
      const result = f.service.prepare('journal', undefined, 'Journal', 'preview');
      expect(result.ok).toBe(false); if (!result.ok) expect(result).toEqual(failure('validation', 'error.entity'));
      expect(f.writer.create).not.toHaveBeenCalled(); expect(f.events.publish).not.toHaveBeenCalled();
    } finally { f.service.dispose(); }
  }
});

it('[BOUND-62-02] ASCII and multibyte complete documents accept the exact UTF-8 boundary and reject one extra byte', async () => {
  const empty = document(''); const overhead = Buffer.byteLength(unwrap(empty.service.prepare('journal', undefined, 'Journal', 'empty')).markdown, 'utf8');
  empty.service.dispose();
  for (const symbol of ['x', 'é', '中', '😀']) {
    const size = Buffer.byteLength(symbol, 'utf8'); const available = limit - overhead;
    const body = symbol.repeat(Math.floor(available / size)) + 'x'.repeat(available % size);
    const f = document(body); const tooLarge = document(body + 'x');
    try {
      const plan = unwrap(f.service.prepare('journal', undefined, 'Journal', 'at-limit'));
      expect(Buffer.byteLength(plan.markdown, 'utf8')).toBe(limit); expect(f.writer.create).not.toHaveBeenCalled();
      expect(markdownCodec.read(plan.markdown).ok).toBe(true);
      expect((await f.service.commit(plan, 'Journal')).ok).toBe(true);
      expect(f.writer.create).toHaveBeenCalledExactlyOnceWith(plan.path, plan.markdown); expect(f.events.publish).toHaveBeenCalledOnce();
      const overflow = tooLarge.service.prepare('journal', undefined, 'Journal', 'over-limit');
      expect(overflow.ok).toBe(false); if (!overflow.ok) expect(overflow).toEqual(failure('validation', 'error.entity'));
      expect(markdownCodec.read(plan.markdown + 'x')).toEqual(failure('validation', 'error.entity'));
      expect(tooLarge.writer.create).not.toHaveBeenCalled(); expect(tooLarge.events.publish).not.toHaveBeenCalled();
    } finally { f.service.dispose(); tooLarge.service.dispose(); }
  }
});

it('[BOUND-62-03] multibyte updates prevalidate complete candidate bytes and preserve original note identity and body', async () => {
  const f = repositoryFixture();
  try {
    const initial = unwrap(await f.tasks.create({ title: 'x' }, 'original'));
    const prefix = f.files.get(initial.path); if (!prefix) throw new Error('Missing original note');
    const available = limit - 10 - Buffer.byteLength(prefix, 'utf8');
    const original = prefix + '中'.repeat(Math.floor(available / 3)) + 'x'.repeat(available % 3);
    f.files.set(initial.path, original); const snapshot = unwrap(await f.tasks.get(initial.path));
    const changed = vi.fn(); f.events.on('documents.updated', changed);
    expect(await f.tasks.update(snapshot, { title: 'é'.repeat(100) })).toEqual(failure('validation', 'error.entity'));
    expect(f.storage.replace).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    expect(f.files.get(initial.path)).toBe(original); expect(unwrap(await f.tasks.get(initial.path)).id).toBe(initial.id);
    expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.tasks.dispose(); f.projects.dispose(); }
});
