import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readCollectionDefinition } from '../../bin/domain/collection-definition.ts';
import { collectionCreate, collectionUpdate, nextCollectionId, readCollectionRecord } from '../../bin/domain/collection-record.ts';
import { collectionCheck, collectionReviewQueue, collectionRow, filterCollection, sortCollection } from '../../bin/domain/collection-query.ts';
import { collectionBase, collectionRegister } from '../../bin/domain/collection-register.ts';
import { collectionPathDefaults, collectionPathKeys } from '../../bin/domain/user-settings.ts';
import { collectionCommandRoots, makerCommandIds, makerValueOptions } from '../../bin/domain/command-options.ts';
const repository = resolve(import.meta.dirname, '../..');
const shipped = JSON.parse(await readFile(join(repository, 'configs/collections/learning.json'), 'utf8'));
const definition = readCollectionDefinition(structuredClone(shipped));
const edit = change => { const value = structuredClone(shipped); change(value); return value; };
const input = { title: 'Pin the toolchain', context: 'CI broke after a silent npm upgrade.', insight: 'Pin exact Node and npm versions.', category: 'tooling', impact: 'high', tags: ['ci', 'dependencies'] };
const stored = (extra = {}) => ({ type: 'Learning', id: 'LRN-0001', title: 'Pin the toolchain', status: 'draft', created: '2026-10-01', updated: '2026-10-01', observed: '2026-09-30',
  context: 'CI broke.', insight: 'Pin versions.', category: 'tooling', tags: ['ci'], impact: 'high', ...extra });
const record = (extra = {}) => readCollectionRecord(definition, undefined, stored(extra)).record;
const codes = props => readCollectionRecord(definition, undefined, props).issues.map(item => `${item.severity}:${item.code}`);
const validated = { status: 'validated', 'follow-up': 'Add an engines check', due: '2026-10-20' };

test('the shipped learning collection is plain data: no hook, its own folder key and a root that is not learn', () => {
  assert.deepEqual([definition.type, definition.pathKey, definition.idPrefix, definition.idDigits, definition.initialStatus, definition.hook], ['Learning', 'learnings', 'LRN-', 4, 'draft', undefined]);
  assert.deepEqual(definition.statuses.map(item => [item.id, item.open]), [['draft', false], ['validated', true], ['applied', false], ['superseded', false], ['archived', false]]);
  assert.deepEqual([definition.forms, definition.wizards], [{ edit: 'learning', review: 'learning-review' }, { new: 'learning-new', edit: 'learning-edit', review: 'learning-review' }]);
  assert.deepEqual(definition.fields.filter(item => item.idPrefix).map(item => [item.key, item.input, item.idPrefix]), [['related-risks', 'relatedRisks', 'RISK-'], ['superseded-by', 'supersededBy', 'LRN-']]);
  assert.deepEqual(definition.review, { stamp: 'reviewed', match: [{ key: 'impact', in: ['high'] }], overdue: true });
  assert.equal(collectionPathDefaults.learnings, 'docs/learnings');
  assert.ok(collectionPathKeys.includes('learnings'));
  assert.equal(collectionCommandRoots.learning, 'learning');
  assert.ok(makerCommandIds.includes('learn') && makerCommandIds.includes('learning'), 'courses (learn) and lessons learned (learning) are separate roots');
  assert.ok(makerValueOptions.includes('impact') && makerValueOptions.includes('category'));
});

test('learning definitions fail closed, including the generic idPrefix reference option', () => {
  for (const [change, pattern] of [
    [value => { value.pathKey = 'lessons'; }, /pathKey must be one of risks, learnings/],
    [value => { value.idPrefix = 'lrn-'; }, /idPrefix/],
    [value => { value.statuses[0].transitions.push('done'); }, /transitions must name other statuses/],
    [value => { value.initialStatus = 'new'; }, /initialStatus/],
    [value => { value.fields[12].idPrefix = 'risk-'; }, /fields\[12\]\.idPrefix is upper-case letters/],
    [value => { value.fields[12].idPrefix = 'RISK'; }, /idPrefix is upper-case letters/],
    [value => { value.fields[1].idPrefix = 'RISK-'; }, /idPrefix applies to frontmatter text and list fields/],
    [value => { value.fields[5].idPrefix = 'RISK-'; }, /without a vocabulary/],
    [value => { value.fields[16].idPrefix = 'RISK-'; }, /idPrefix applies to frontmatter/],
    [value => { value.fields[12].pattern = '.*'; }, /Unknown fields/],
    [value => { value.body += '{{relatedRisk}}'; }, /unknown input relatedRisk/],
    [value => { value.review.match = [{ key: 'tags', in: ['ci'] }]; }, /review.match/],
    [value => { value.report.columns.push('evidence'); }, /report.columns/],
    [value => { value.fields.push({ key: 'score', label: 'Score', kind: 'integer', source: 'derived' }); }, /Derived fields need a hook/],
  ]) assert.throws(() => readCollectionDefinition(edit(change)), pattern);
});

test('stored learnings are validated as data: risk references, vocabularies and open follow-up gaps are issues', () => {
  assert.deepEqual(readCollectionRecord(definition, undefined, { type: 'Risk', id: 'RISK-0001' }), { kind: 'ignored' });
  assert.equal(readCollectionRecord(definition, undefined, stored({ schema_version: 2 })).kind, 'future');
  assert.deepEqual(codes(stored({ 'related-risks': ['RISK-0001', 'RISK-12345'], 'superseded-by': 'LRN-0002', 'applies-to': ['CI'], unrelated: true })), []);
  assert.deepEqual(codes(stored({ 'related-risks': ['RISK-1'] })), ['error:COLLECTION_VALUE']);
  assert.deepEqual(codes(stored({ 'related-risks': ['risk-0001'] })), ['error:COLLECTION_VALUE']);
  assert.deepEqual(codes(stored({ 'related-risks': 'RISK-0001' })), ['error:COLLECTION_VALUE'], 'a list field needs a list');
  assert.deepEqual(codes(stored({ 'superseded-by': 'RISK-0001' })), ['error:COLLECTION_VALUE']);
  assert.match(readCollectionRecord(definition, undefined, stored({ 'related-risks': ['R-1'] })).issues[0].message, /related-risks must name ids like RISK-0001/);
  assert.deepEqual(codes(stored({ tags: ['ci', 'gardening'], impact: 'severe', category: 'luck' })), ['error:COLLECTION_VALUE', 'error:COLLECTION_VALUE', 'error:COLLECTION_VALUE']);
  assert.deepEqual(codes(stored({ tags: undefined, insight: undefined })), ['error:COLLECTION_REQUIRED', 'error:COLLECTION_REQUIRED']);
  // Validated learnings owe a follow-up with a due date; drafts and applied learnings do not.
  assert.deepEqual(codes(stored({ status: 'validated' })), ['warning:COLLECTION_OPEN_FIELD', 'warning:COLLECTION_OPEN_FIELD']);
  assert.deepEqual(codes(stored(validated)), []);
  assert.deepEqual(codes(stored({ status: 'applied' })), []);
});

test('a new learning gets an observed date, the draft status, ordered frontmatter and the rendered body', () => {
  const created = collectionCreate(definition, undefined, { ...input, relatedRisks: ['RISK-0003', 'RISK-0003'], appliesTo: ['CI', 'setup'], source: 'PR #65', evidence: 'Build log.\n\nSecond line.' }, 'LRN-0004', '2026-10-04');
  assert.deepEqual(Object.keys(created.frontmatter), ['type', 'id', 'title', 'status', 'created', 'updated', 'observed', 'context', 'insight', 'category', 'tags', 'impact', 'source', 'applies-to', 'related-risks', 'schema_version']);
  assert.deepEqual([created.frontmatter.status, created.frontmatter.observed, created.frontmatter['related-risks']], ['draft', '2026-10-04', ['RISK-0003']]);
  assert.equal(created.body, '# Pin the toolchain\n\n## Context\n\nCI broke after a silent npm upgrade.\n\n## Insight\n\nPin exact Node and npm versions.\n\n## Evidence\n\nBuild log.\n\nSecond line.\n\n## Follow-up\n\n_No follow-up planned yet._\n');
  assert.match(collectionCreate(definition, undefined, { ...input, followUp: 'Add engines' }, 'LRN-0005', '2026-10-04').body, /## Evidence\n\n_No evidence recorded yet._\n\n## Follow-up\n\nAdd engines\n$/);
  const applied = collectionCreate(definition, undefined, { ...input, status: 'applied' }, 'LRN-0006', '2026-10-04').frontmatter;
  assert.equal(applied.applied, '2026-10-04', 'entering applied stamps the date');
  assert.throws(() => collectionCreate(definition, undefined, { ...input, status: 'validated' }, 'LRN-0007', '2026-10-04'), /Missing followUp, due \(required while validated\)/);
  assert.throws(() => collectionCreate(definition, undefined, { ...input, relatedRisks: ['RISK-7'] }, 'LRN-0007', '2026-10-04'), /related-risks must name ids like RISK-0001/);
  assert.throws(() => collectionCreate(definition, undefined, { ...input, tags: ['gardening'] }, 'LRN-0007', '2026-10-04'), /tags items must be offered values/);
  assert.throws(() => collectionCreate(definition, undefined, { ...input, tags: [] }, 'LRN-0007', '2026-10-04'), /Missing tags/);
  assert.throws(() => collectionCreate(definition, undefined, { ...input, observed: '04.10.2026' }, 'LRN-0007', '2026-10-04'), /observed must be a date/);
  assert.equal(nextCollectionId(definition, ['docs/learnings/LRN-0002-a.md', 'register lists LRN-0009 and RISK-0040']), 'LRN-0010');
});

test('status transitions follow draft → validated → applied, stamp applied and keep superseded and archived reversible', () => {
  assert.throws(() => collectionUpdate(definition, undefined, record(), { status: 'validated' }, '2026-10-05'), /Missing followUp, due \(required while validated\)/);
  const valid = collectionUpdate(definition, undefined, record(), { status: 'validated', followUp: 'Add engines', due: '2026-10-20' }, '2026-10-05');
  assert.deepEqual([valid.values.status, valid.values['follow-up'], valid.values.updated, valid.values.created], ['validated', 'Add engines', '2026-10-05', '2026-10-01']);
  assert.throws(() => collectionUpdate(definition, undefined, record(), { status: 'applied' }, '2026-10-05'), /draft → applied is not allowed; from draft use validated, archived/);
  const applied = collectionUpdate(definition, undefined, record(validated), { status: 'applied' }, '2026-10-06');
  assert.equal(applied.values.applied, '2026-10-06');
  const superseded = collectionUpdate(definition, undefined, record({ ...validated, status: 'applied', applied: '2026-10-06' }), { status: 'superseded', supersededBy: 'LRN-0002' }, '2026-10-07');
  assert.deepEqual([superseded.values.applied, superseded.values['superseded-by'], superseded.removed], [undefined, 'LRN-0002', ['applied']]);
  assert.throws(() => collectionUpdate(definition, undefined, record({ status: 'archived' }), { status: 'validated' }, '2026-10-07'), /archived → validated is not allowed; from archived use draft/);
  assert.equal(collectionUpdate(definition, undefined, record({ status: 'archived' }), { status: 'draft' }, '2026-10-07').status, 'draft');
  assert.throws(() => collectionUpdate(definition, undefined, record(validated), { followUp: '' }, '2026-10-07'), /Missing followUp/);
  assert.throws(() => collectionUpdate(definition, undefined, record(), { relatedRisks: ['RISK-0001x'] }, '2026-10-07'), /related-risks must name ids/);
  assert.throws(() => collectionUpdate(definition, undefined, record(), { evidence: 'x' }, '2026-10-07'), /Unknown input evidence/);
  assert.equal(collectionUpdate(definition, undefined, record(validated), {}, '2026-10-08', true).values.reviewed, '2026-10-08');
});

test('queries list, filter and review validated high-impact or overdue learnings; drafts are never overdue', () => {
  const a = record({ id: 'LRN-0001', ...validated, impact: 'low', due: '2026-09-01' }), b = record({ id: 'LRN-0002', ...validated, impact: 'high', observed: '2026-09-01' });
  const c = record({ id: 'LRN-0003', ...validated, impact: 'medium' }), d = record({ id: 'LRN-0004', impact: 'high', due: '2026-01-01' }), e = record({ id: 'LRN-0005', status: 'applied', impact: 'high' });
  assert.deepEqual(sortCollection(definition, [e, a, c, d, b]).map(item => item.id), ['LRN-0004', 'LRN-0002', 'LRN-0003', 'LRN-0001', 'LRN-0005']);
  assert.deepEqual(collectionReviewQueue(definition, [a, b, c, d, e], '2026-10-04').map(item => item.id), ['LRN-0002', 'LRN-0001']);
  assert.deepEqual(filterCollection(definition, [a, b, c, d, e], { impact: 'high' }, false, '2026-10-04').map(item => item.id), ['LRN-0002', 'LRN-0004', 'LRN-0005']);
  assert.deepEqual(filterCollection(definition, [a, b, c, d, e], {}, true, '2026-10-04').map(item => item.id), ['LRN-0001']);
  assert.throws(() => filterCollection(definition, [a], { tags: 'ci' }, false, '2026-10-04'), /not a status or choice field/);
  assert.throws(() => filterCollection(definition, [a], { impact: 'severe' }, false, '2026-10-04'), /impact must be one of low, medium, high/);
  const issues = collectionCheck(definition, [{ path: 'a.md', record: a, issues: [] }, { path: 'd.md', record: d, issues: [] }], '2026-10-04');
  assert.deepEqual(issues.map(item => [item.code, item.id]), [['COLLECTION_OVERDUE', 'LRN-0001']]);
  assert.deepEqual(collectionRow(definition, { path: 'b.md', record: b, issues: [] }, '2026-10-04'), { id: 'LRN-0002', title: 'Pin the toolchain', status: 'validated', impact: 'high',
    category: 'tooling', observed: '2026-09-01', due: '2026-10-20', owner: null, 'follow-up': 'Add an engines check', path: 'b.md', overdue: false, issues: 0 });
});

test('the register lists labels, tags and risk references and the Bases file selects type Learning', () => {
  const a = record({ id: 'LRN-0001', ...validated, due: '2026-09-01', tags: ['ci', 'release'], 'related-risks': ['RISK-0001', 'RISK-0002'] });
  const inner = collectionRegister(definition, [{ record: a, href: 'LRN-0001-pin.md' }], '2026-10-04', []);
  assert.match(inner, /^_Generated by `node bin\/app learning report` for 2026-10-04 from 1 note\(s\)\./);
  assert.match(inner, /\| ID \| Title \| Status \| Impact \| Category \| Tags \| Observed \| Source \| Related risks \| Owner \| Due \| Follow-up \|/);
  assert.match(inner, /\| \[LRN-0001\]\(<LRN-0001-pin\.md>\) \| Pin the toolchain \| Validated \| High \| Tooling \| ci, release \| 2026-09-30 \|  \| RISK-0001, RISK-0002 \|  \| 2026-09-01 \| Add an engines check \|/);
  assert.match(inner, /### Overdue\n\n- \[LRN-0001\]\(<LRN-0001-pin\.md>\) Pin the toolchain — due 2026-09-01\n/);
  const base = collectionBase(definition);
  assert.deepEqual(base.filters.and, ['file.folder == this.file.folder', 'file.ext == "md"', 'note.type == "Learning"']);
  assert.ok(base.views[0].order.includes('note.impact') && !base.views[0].order.includes('note.related-risks'));
});
