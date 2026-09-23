import { expect, it } from 'vitest';
import fc from 'fast-check';
import { defineEntity, fields, defineDocument, defineNoteFeature, heading } from '../../src/features/api';
import { createNoteFeatures } from '../../src/application/note-feature';
import { markdownCodec } from '../../src/infrastructure/markdown';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';
import { failure } from '../../src/domain/outcome';
import { memoryStorage } from './memory-storage';
import { unwrapEntity } from './entity-fixture';

const model = defineEntity('property-record', 1, {
  title: fields.text({ min: 1, max: 100 }),
  amount: fields.number(),
  enabled: fields.boolean(),
  day: fields.date(),
});
const feature = defineNoteFeature({ defaultFolder: 'Properties', document: defineDocument(model, {
  mappings: (['title', 'amount', 'enabled', 'day'] as const).map(field => ({ field, property: field })),
  title: value => value.title, body: value => `# ${heading(value.title)}\n`,
}) });
function fixture() {
  const memory = memoryStorage(); let id = 0;
  const errors: string[] = [];
  const reporter = { report: (code: string) => { errors.push(code); } };
  const events = new TypedEventBus<ShellEvents>(reporter);
  const runtime = createNoteFeatures({ storage: memory.storage, codec: markdownCodec, events,
    newId: () => `property-${++id}`, now: () => '2026-09-23T12:00:00.000Z', errors: reporter,
  }, register => ({ records: register(feature) }));
  return { ...memory, errors, events, repo: runtime.repositories.records, dispose() { runtime.dispose(); events.dispose(); } };
}
const options = { numRuns: 100, seed: 23092026, endOnFailure: false };
const values = fc.record({
  title: fc.array(fc.constantFrom('Title', 'Änderung', 'Überblick', '日本語', '😀', '#', '001'), { minLength: 1, maxLength: 6 }).map(parts => parts.join(' ')),
  amount: fc.integer({ min: -100000, max: 100000 }), enabled: fc.boolean(),
  day: fc.date({ min: new Date('1600-01-01T00:00:00Z'), max: new Date('2400-12-31T00:00:00Z'), noInvalidDate: true }).map(value => value.toISOString().slice(0, 10)),
});
it('[DATA-PROP-01] real Markdown repository round-trips scalar values and preserves unrelated content', async () => {
  await fc.assert(fc.asyncProperty(values, async value => {
    const f = fixture();
    try {
      const prepared = unwrapEntity(f.repo.prepare(value, 'request'));
      expect(prepared.path).toBe(`Properties/${value.title}.md`);
      expect(f.files.size).toBe(0);
      const saved = unwrapEntity(await f.repo.commit(prepared));
      expect(unwrapEntity(await f.repo.get(saved.path))?.values).toEqual(value);
      const original = f.files.get(saved.path);
      expect(original).toBeDefined();
      const external = `${original}\nHandwritten content.\n`;
      f.files.set(saved.path, external);
      expect((await f.repo.update(saved, { ...value, enabled: !value.enabled })).ok).toBe(false);
      expect(f.files.get(saved.path)).toBe(external);
      expect(f.errors).toEqual([]);
    } finally { f.dispose(); }
  }), options);
});
it('[DATA-PROP-02] uncertain writes cannot be retried and failed writes publish no committed fact', async () => {
  await fc.assert(fc.asyncProperty(values, async value => {
    const f = fixture(); let facts = 0;
    f.events.on('documents.created', () => { facts++; });
    f.create.mockImplementation(async () => failure('uncertain', 'error.uncertain'));
    try {
      const prepared = unwrapEntity(f.repo.prepare(value, 'request'));
      expect((await f.repo.commit(prepared)).ok).toBe(false);
      expect((await f.repo.commit(prepared)).ok).toBe(false);
      expect(f.create).toHaveBeenCalledTimes(1); expect(facts).toBe(0);
    } finally { f.dispose(); }
  }), options);
});
it('[DATA-PROP-03] unknown fields and invalid dates are rejected instead of silently persisted', () => {
  fc.assert(fc.property(values, fc.string(), (value, extra) => {
    expect(model.decode({ ...value, unexpected: extra }).ok).toBe(false);
    expect(model.decode({ ...value, day: `${value.day}T00:00:00Z` }).ok).toBe(false);
  }), options);
});
