import { describe, expect, it } from 'vitest';
import { defineDocument, defineEntity, defineNoteFeature, fields, heading } from '../../src/features/api';
import { createNoteFeatures } from '../../src/application/note-feature';
import { taskFeature } from '../../src/features/tasks/definition';
import { projectFeature } from '../../src/features/projects/definition';
import { markdownCodec } from '../../src/infrastructure/markdown';
import type { Result } from '../../src/domain/outcome';
import { entityFixture, unwrapEntity as unwrap } from './entity-fixture';

// A downstream author's third feature imports only the public author facade.
const meeting = defineEntity('meeting', 1, {
  subject: fields.text({ trim: true, min: 1, max: 120 }),
  attendees: fields.defaulted(fields.textList(), []),
  confirmed: fields.defaulted(fields.boolean(), false),
});
const meetingFeature = defineNoteFeature({
  defaultFolder: 'Meetings',
  document: defineDocument(meeting, {
    mappings: [{ field: 'subject', property: 'subject' }, { field: 'attendees', property: 'attendees' }, { field: 'confirmed', property: 'confirmed' }],
    title: value => value.subject,
    body: value => `# ${heading(value.subject)}\n\n## Decisions\n`,
  }),
});
function dependencies() {
  const fixture = entityFixture(); let id = 0;
  return { ...fixture, shared: { storage: fixture.storage, codec: markdownCodec, events: fixture.events, errors: fixture.errors,
    newId: () => `meeting-${++id}`, now: () => '2026-09-22T12:00:00.000Z' } };
}

describe('Author-facing feature extension', () => {
  it('[FEATURE-03-01] one third-feature registration supplies real typed CRUD without adapter edits', async () => {
    const f = dependencies();
    const features = createNoteFeatures(f.shared, register => ({
      task: register(taskFeature),
      project: register(projectFeature),
      meeting: register(meetingFeature),
    }));
    expect(f.storage.create).not.toHaveBeenCalled();
    const repository = features.repositories.meeting;
    const preview = unwrap(repository.prepare({ subject: 'Release review', attendees: ['Ada', 'Lin'] }, 'submission'));
    expect(preview.path).toBe('Meetings/Release review.md');
    expect(preview.markdown).toContain('confirmed: false'); expect(f.files.size).toBe(0);
    const created = unwrap(await repository.commit(preview));
    expect(created.values).toEqual({ subject: 'Release review', attendees: ['Ada', 'Lin'], confirmed: false });
    expect(f.files.get(created.path)).toBe(preview.markdown);
    expect(unwrap(await repository.list())).toHaveLength(1);
    expect(unwrap(await repository.get(created.path)).values).toEqual(created.values);
    const changed = unwrap(await repository.update(created, { subject: 'Final review', attendees: ['Ada'], confirmed: true }));
    expect(changed.values.confirmed).toBe(true); expect(changed.id).toBe(created.id); expect(changed.path).toBe(created.path);
    expect(f.files.get(changed.path)).toContain('## Decisions');
    expect((await repository.delete(changed)).ok).toBe(true); expect(f.files.has(created.path)).toBe(false);
    expect(unwrap(await repository.list())).toEqual([]);
    features.dispose(); expect((await features.repositories.task.list()).ok).toBe(false);
    expect((await features.repositories.project.list()).ok).toBe(false);
    expect((await repository.list()).ok).toBe(false);
  });
  it('[FEATURE-03-02] feature-owned defaults and a live folder override are captured safely', async () => {
    const f = dependencies(); let folder = 'Work/Meetings';
    const features = createNoteFeatures(f.shared, register => ({ meeting: register(meetingFeature, () => folder) }));
    const preview = unwrap(features.repositories.meeting.prepare({ subject: 'Meeting' }, 'request'));
    folder = 'Other/Meetings';
    expect((await features.repositories.meeting.commit(preview)).ok).toBe(false); expect(f.files.size).toBe(0);
    const created = unwrap(await features.repositories.meeting.create({ subject: 'Meeting' }, 'new'));
    expect(created.path).toMatch(/^Other\/Meetings\//);
    const descriptor = { document: meetingFeature.document, defaultFolder: 'Original' };
    const feature = defineNoteFeature(descriptor); descriptor.defaultFolder = 'Changed';
    expect(feature.defaultFolder).toBe('Original'); expect(Object.isFrozen(feature)).toBe(true);
    expect(() => defineNoteFeature({ document: meetingFeature.document, defaultFolder: '../unsafe' })).toThrow('Invalid feature default folder');
  });
  it('[FEATURE-03-03] failed duplicate registration disposes already constructed repositories', async () => {
    const f = dependencies();
    const retained: { list(): Promise<Result<readonly unknown[]>> }[] = [];
    expect(() => createNoteFeatures(f.shared, register => {
      const repository = register(meetingFeature); retained.push(repository);
      return { meeting: repository, duplicate: register(meetingFeature) };
    })).toThrow('Duplicate document registration');
    expect(await retained[0]?.list()).toMatchObject({ ok: false, error: { code: 'disposed' } });
    expect(f.storage.create).not.toHaveBeenCalled();
  });
  it('[FEATURE-03-04] registration is sealed after composition and callback failure also cleans up', async () => {
    const f = dependencies(); let late: (() => unknown) | undefined;
    const successful = createNoteFeatures(f.shared, register => { late = () => register(meetingFeature); return { meeting: register(meetingFeature) }; });
    expect(() => late?.()).toThrow('Feature registration is closed'); successful.dispose();
    const retained: { list(): Promise<Result<readonly unknown[]>> }[] = [];
    expect(() => createNoteFeatures(f.shared, register => { retained.push(register(meetingFeature)); throw new Error('Feature composition failed'); })).toThrow('Feature composition failed');
    expect(await retained[0]?.list()).toMatchObject({ ok: false, error: { code: 'disposed' } });
  });
  it('[FEATURE-03-05] entities without document recipes require neither registration nor persistence', () => {
    const totals = defineEntity('totals', 1, { count: fields.number({ min: 0 }), ready: fields.boolean() });
    expect(unwrap(totals.parse({ count: 0, ready: false }))).toEqual({ count: 0, ready: false });
    expect(totals.decode({ count: -1, ready: false }).ok).toBe(false);
  });
  it('[FEATURE-03-06] untyped asynchronous registration fails closed and observes rejection', async () => {
    const f = dependencies(); const retained: { list(): Promise<Result<readonly unknown[]>> }[] = [];
    type Register = Parameters<Parameters<typeof createNoteFeatures>[1]>[0];
    const callback = async (register: Register) => { retained.push(register(meetingFeature)); throw new Error('private failure'); };
    expect(() => Reflect.apply(createNoteFeatures, undefined, [f.shared, callback])).toThrow('Feature registration must be synchronous');
    expect(await retained[0]?.list()).toMatchObject({ ok: false, error: { code: 'disposed' } });
    await Promise.resolve(); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('feature.registration', 'feature.compose');
    expect(() => createNoteFeatures(f.shared, () => ({ unregistered: { dispose() {} } }))).toThrow('Feature registry must contain its registered repositories');
  });
});
