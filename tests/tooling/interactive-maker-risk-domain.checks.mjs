import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readCollectionDefinition, collectionInputName } from '../../src/cli/domain/collection-definition.ts';
import { collectionCreate, collectionUpdate, collectionValue, isCollectionDate, nextCollectionId, readCollectionRecord } from '../../src/cli/domain/collection-record.ts';
import { collectionCheck, collectionReviewQueue, collectionRow, filterCollection, sortCollection } from '../../src/cli/domain/collection-query.ts';
import { collectionBase, collectionRegister, collectionTableText, mergeCollectionRegister } from '../../src/cli/domain/collection-register.ts';
import { riskMatrix, riskScore, riskScoringHook, riskScoringModel } from '../../src/cli/domain/risk-scoring.ts';
import { collectionHooks } from '../../src/cli/domain/collection-hooks.ts';
const repository = resolve(import.meta.dirname, '../..');
const shipped = JSON.parse(await readFile(join(repository, 'configs/collections/risk.json'), 'utf8'));
const definition = readCollectionDefinition(structuredClone(shipped));
const hook = riskScoringHook;
const edit = change => { const value = structuredClone(shipped); change(value); return value; };
const input = { title: 'Vendor late', description: 'The vendor may ship late.', nextAction: 'Call the vendor', due: '2026-10-20', dimension: 'schedule', category: 'external', probability: 3, impact: 4 };
const stored = (extra = {}) => ({ type: 'Risk', id: 'RISK-0001', title: 'Vendor late', status: 'identified', created: '2026-10-01', updated: '2026-10-01', description: 'd',
  'next-action': 'Call', due: '2026-10-20', identified: '2026-10-01', dimension: 'schedule', category: 'external', probability: 3, impact: 4, ...extra });
const record = (extra = {}) => readCollectionRecord(definition, hook, stored(extra)).record;
const digest = text => String(text.length).padStart(64, '0');

test('the shipped risk collection is valid data with a registered, validated scoring hook', () => {
  assert.equal(collectionHooks[definition.hook], riskScoringHook);
  assert.deepEqual([definition.type, definition.pathKey, definition.idPrefix, definition.idDigits, definition.initialStatus], ['Risk', 'risks', 'RISK-', 4, 'identified']);
  assert.deepEqual(definition.statuses.map(item => item.id), ['identified', 'assessed', 'mitigating', 'accepted', 'closed']);
  assert.equal(definition.fields.find(item => item.key === 'next-action').input, 'nextAction');
  assert.equal(collectionInputName('schema_version'), 'schemaVersion');
  const model = riskScoringModel(definition);
  assert.deepEqual(model.levels, [{ level: 'low', min: 1 }, { level: 'medium', min: 5 }, { level: 'high', min: 10 }, { level: 'critical', min: 15 }]);
});

test('definitions fail closed on unknown, unsafe or inconsistent shapes', () => {
  for (const [change, pattern] of [
    [value => { value.extra = 1; }, /Unknown fields/],
    [value => { value.pathKey = 'prds'; }, /pathKey must be one of risks/],
    [value => { value.idPrefix = 'risk-'; }, /idPrefix/],
    [value => { value.statuses[0].transitions.push('archived'); }, /transitions must name other statuses/],
    [value => { value.statuses[0].transitions.push('identified'); }, /transitions must name other statuses/],
    [value => { value.statuses[4].stamp = 'due'; }, /stamp must name a stamp field/],
    [value => { value.initialStatus = 'open'; }, /initialStatus/],
    [value => { value.fields.push({ key: 'title', label: 'Again', kind: 'text' }); }, /field keys must be unique/],
    [value => { value.fields.push({ key: 'status', label: 'Status', kind: 'text' }); }, /engine-owned/],
    [value => { value.fields.push({ key: '__proto__', label: 'x', kind: 'text' }); }, /valid identifier/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'script' }); }, /kind must be/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'choice' }); }, /needs a vocabulary/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'integer', vocabulary: 'dimension' }); }, /whole-number ids/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'text', default: 'today' }); }, /dates only/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'date', frontmatter: false }); }, /body-only/],
    [value => { value.fields.push({ key: 'x', label: 'x', kind: 'date', source: 'stamp', required: true }); }, /optional date/],
    [value => { delete value.hook; }, /Derived fields need a hook/],
    [value => { value.body += '{{secret}}'; }, /unknown input secret/],
    [value => { value.titleField = 'owner'; }, /titleField/],
    [value => { value.report.columns.push('mitigation'); }, /report.columns/],
    [value => { value.report.file = '../escape.md'; }, /report.file/],
    [value => { value.report.sort = [{ key: 'level', order: 'up' }]; }, /report.sort/],
    [value => { value.review.match = [{ key: 'owner', in: ['x'] }]; }, /review.match/],
    [value => { value.review.stamp = 'due'; }, /review.stamp/],
    [value => { delete value.wizards.new; }, /wizards.new is required/],
    [value => { value.vocabularies.level.push({ id: 'low', label: 'Again' }); }, /ids must be unique/],
    [value => { value.schemaVersion = 2; }, /schemaVersion 1/],
  ]) assert.throws(() => readCollectionDefinition(edit(change)), pattern);
});

test('the scoring model validates its factors, levels and coverage, and derives score and level', () => {
  for (const [change, pattern] of [
    [value => { value.model.levels[3].min = 30; }, /cover scores 1–25/],
    [value => { value.model.levels[2].min = 5; }, /rise strictly/],
    [value => { value.model.levels.pop(); }, /every level/],
    [value => { value.model.factors = ['probability']; }, /two different factors/],
    [value => { value.model.factors = ['probability', 'owner']; }, /input integer field/],
    [value => { value.model.score = 'level'; }, /derived integer/],
    [value => { value.model.level = 'score'; }, /derived choice/],
    [value => { value.model.extra = true; }, /Unknown fields/],
    [value => { value.vocabularies.impact[0].id = '0'; }, /start at 1/],
  ]) assert.throws(() => riskScoringModel(readCollectionDefinition(edit(change))), pattern);
  const model = riskScoringModel(definition);
  const cases = [[1, 1, 1, 'low'], [2, 2, 4, 'low'], [1, 5, 5, 'medium'], [3, 3, 9, 'medium'], [2, 5, 10, 'high'], [2, 7, 14, 'high'], [3, 5, 15, 'critical'], [5, 5, 25, 'critical']];
  for (const [probability, impact, score, level] of cases) assert.deepEqual(riskScore(model, { probability, impact }), { score, level }, `${probability}×${impact}`);
  assert.deepEqual(riskScore(model, { probability: 3 }), {});
});

test('stored notes are validated without exceptions; other types are ignored and newer schemas are future', () => {
  assert.deepEqual(readCollectionRecord(definition, hook, { type: 'Task', id: 'x' }), { kind: 'ignored' });
  assert.equal(readCollectionRecord(definition, hook, stored({ schema_version: 2 })).kind, 'future');
  const good = readCollectionRecord(definition, hook, stored({ schema_version: 1, unrelated: [1, 2] }));
  assert.deepEqual(good.issues, []);
  assert.deepEqual([good.record.values.score, good.record.values.level, good.record.title], [12, 'high', 'Vendor late'], 'absent derived values are computed');
  const codes = props => readCollectionRecord(definition, hook, props).issues.map(item => `${item.severity}:${item.code}`);
  assert.deepEqual(codes(stored({ id: 'RISK-1', status: 'open', created: '2026-02-30' })), ['error:COLLECTION_ID', 'error:COLLECTION_STATUS', 'error:COLLECTION_VALUE']);
  assert.deepEqual(codes(stored({ probability: 9, dimension: 'weather', due: 'soon', title: 'two\nlines' })).length, 4);
  assert.deepEqual(codes(stored({ score: 11, level: 'high' })), ['error:COLLECTION_DERIVED']);
  assert.deepEqual(codes(stored({ description: undefined })), ['error:COLLECTION_REQUIRED']);
  assert.deepEqual(codes(stored({ 'next-action': undefined, due: null })), ['warning:COLLECTION_OPEN_FIELD', 'warning:COLLECTION_OPEN_FIELD']);
  assert.deepEqual(codes(stored({ status: 'closed', 'next-action': undefined, due: undefined })), [], 'closed notes need no next action');
  assert.deepEqual(codes(stored({ schema_version: '1' })), ['error:COLLECTION_VERSION']);
  assert.ok(isCollectionDate('2028-02-29') && !isCollectionDate('2027-02-29') && !isCollectionDate(20260101));
  const list = { key: 'tags', input: 'tags', label: 'Tags', kind: 'list', source: 'input', maxLength: 20, required: false, requiredWhenOpen: false, frontmatter: true, multiline: false, overdue: false };
  assert.deepEqual(collectionValue(definition, list, ['a', 'a', 'b']), ['a', 'b']);
  assert.throws(() => collectionValue(definition, list, 'a'), /list/);
});

test('a new note gets defaults, a status stamp, derived values, ordered frontmatter and the rendered body', () => {
  const created = collectionCreate(definition, hook, { ...input, owner: 'Alex', mitigation: 'Fallback adapter.\n\nSecond paragraph.' }, 'RISK-0007', '2026-10-04');
  assert.deepEqual(Object.keys(created.frontmatter), ['type', 'id', 'title', 'status', 'created', 'updated', 'description', 'next-action', 'due', 'identified', 'dimension', 'category', 'probability', 'impact', 'score', 'level', 'owner', 'schema_version']);
  assert.deepEqual([created.frontmatter.identified, created.frontmatter.score, created.frontmatter.level], ['2026-10-04', 12, 'high']);
  assert.equal(created.body, '# Vendor late\n\n## Description\n\nThe vendor may ship late.\n\n## Mitigation\n\nFallback adapter.\n\nSecond paragraph.\n\n## Notes\n');
  assert.match(collectionCreate(definition, hook, input, 'RISK-0001', '2026-10-04').body, /_No mitigation planned yet._/);
  const closed = collectionCreate(definition, hook, { ...input, status: 'closed', nextAction: '', due: '' }, 'RISK-0002', '2026-10-04').frontmatter;
  assert.deepEqual([closed.closed, closed['next-action']], ['2026-10-04', undefined]);
  assert.throws(() => collectionCreate(definition, hook, { ...input, nextAction: '' }, 'RISK-0003', '2026-10-04'), /Missing nextAction \(required while identified\)/);
  assert.throws(() => collectionCreate(definition, hook, { ...input, score: 25 }, 'RISK-0003', '2026-10-04'), /Unknown input score/);
  assert.throws(() => collectionCreate(definition, hook, { ...input, owner: null }, 'RISK-0003', '2026-10-04'), /cannot be null/);
  assert.throws(() => collectionCreate(definition, hook, { ...input, status: 'open' }, 'RISK-0003', '2026-10-04'), /status must be one of/);
  assert.throws(() => collectionCreate(definition, hook, { ...input, probability: '3' }, 'RISK-0003', '2026-10-04'), /probability must be one of 1, 2, 3, 4, 5/);
});

test('updates check transitions, stamp and clear dates, recompute derived values and refuse no-ops', () => {
  const moved = collectionUpdate(definition, hook, record(), { status: 'mitigating', probability: 5 }, '2026-10-05');
  assert.deepEqual([moved.values.status, moved.values.updated, moved.values.created, moved.values.score, moved.values.level], ['mitigating', '2026-10-05', '2026-10-01', 20, 'critical']);
  assert.throws(() => collectionUpdate(definition, hook, record({ status: 'accepted' }), { status: 'identified' }, '2026-10-05'), /accepted → identified is not allowed; from accepted use assessed, mitigating, closed/);
  const closed = collectionUpdate(definition, hook, record(), { status: 'closed' }, '2026-10-05');
  assert.equal(closed.values.closed, '2026-10-05');
  const reopened = collectionUpdate(definition, hook, record({ status: 'closed', closed: '2026-10-05' }), { status: 'identified' }, '2026-10-06');
  assert.deepEqual([reopened.values.closed, reopened.removed], [undefined, ['closed']]);
  const reviewed = collectionUpdate(definition, hook, record(), {}, '2026-10-07', true);
  assert.equal(reviewed.values.reviewed, '2026-10-07');
  assert.deepEqual(collectionUpdate(definition, hook, record({ owner: 'Alex' }), { owner: null }, '2026-10-07').removed, ['owner']);
  assert.throws(() => collectionUpdate(definition, hook, record(), { probability: 3, title: 'Vendor late' }, '2026-10-07'), /Nothing to change/);
  assert.throws(() => collectionUpdate(definition, hook, record(), { description: null }, '2026-10-07'), /required and cannot be removed/);
  assert.throws(() => collectionUpdate(definition, hook, record(), { nextAction: '' }, '2026-10-07'), /Missing nextAction/);
  assert.throws(() => collectionUpdate(definition, hook, record(), { mitigation: 'x' }, '2026-10-07'), /Unknown input mitigation/);
  assert.throws(() => collectionUpdate({ ...definition, review: undefined }, hook, record(), {}, '2026-10-07', true), /defines no review/);
});

test('ids are one above the highest id mentioned anywhere, padded, and never reuse a gap', () => {
  assert.equal(nextCollectionId(definition, []), 'RISK-0001');
  assert.equal(nextCollectionId(definition, ['docs/risks/RISK-0002-a.md', 'RISK-0009', 'register lists RISK-0012 and RISK-0003']), 'RISK-0013');
  assert.equal(nextCollectionId(definition, ['RISK-12345']), 'RISK-12346');
  assert.throws(() => nextCollectionId(definition, ['RISK-999999999']), /No identifiers left/);
});

test('queries sort by level and score, filter strictly, queue reviews and check duplicates and overdue notes', () => {
  const a = record({ id: 'RISK-0001', probability: 2, impact: 2, due: '2026-09-01' }), b = record({ id: 'RISK-0002', probability: 5, impact: 4 }), c = record({ id: 'RISK-0003', probability: 3, impact: 4, owner: 'Zoe' });
  const d = record({ id: 'RISK-0004', status: 'closed', probability: 5, impact: 5, due: '2026-01-01' });
  assert.deepEqual(sortCollection(definition, [a, c, d, b]).map(item => item.id), ['RISK-0004', 'RISK-0002', 'RISK-0003', 'RISK-0001']);
  assert.deepEqual(filterCollection(definition, [a, b, c, d], { level: 'high' }, false, '2026-10-04').map(item => item.id), ['RISK-0003']);
  assert.deepEqual(filterCollection(definition, [a, b, c, d], {}, true, '2026-10-04').map(item => item.id), ['RISK-0001'], 'closed notes are never overdue');
  assert.deepEqual(filterCollection(definition, [a, b, c, d], { status: 'closed' }, false, '2026-10-04').map(item => item.id), ['RISK-0004']);
  assert.throws(() => filterCollection(definition, [a], { owner: 'Zoe' }, false, '2026-10-04'), /not a status or choice field/);
  assert.throws(() => filterCollection(definition, [a], { level: 'extreme' }, false, '2026-10-04'), /level must be one of low, medium, high, critical/);
  assert.deepEqual(collectionReviewQueue(definition, [a, b, c, d], '2026-10-04').map(item => item.id), ['RISK-0002', 'RISK-0003', 'RISK-0001']);
  assert.deepEqual(collectionReviewQueue({ ...definition, review: undefined }, [b], '2026-10-04'), []);
  const issues = collectionCheck(definition, [{ path: 'a.md', record: a, issues: [] }, { path: 'b.md', record: { ...b, id: 'risk-0001' }, issues: [{ severity: 'warning', code: 'X', message: 'x' }] }, { path: 'bad.md', issues: [] }], '2026-10-04');
  assert.deepEqual(issues.map(item => [item.code, item.path]), [['X', 'b.md'], ['COLLECTION_OVERDUE', 'a.md'], ['COLLECTION_DUPLICATE_ID', 'b.md']]);
  const row = collectionRow(definition, { path: 'p.md', record: c, issues: [] }, '2026-10-04');
  assert.deepEqual(row, { id: 'RISK-0003', title: 'Vendor late', status: 'identified', level: 'high', score: 12, due: '2026-10-20', owner: 'Zoe', 'next-action': 'Call', path: 'p.md', overdue: false, issues: 0 });
});

test('the register renders a table, the matrix and overdue list, and merges only between intact markers', () => {
  const a = record({ id: 'RISK-0001', title: 'Pipe | name', due: '2026-09-01' }), b = record({ id: 'RISK-0002', status: 'closed', probability: 5, impact: 5 });
  const rows = [{ record: a, href: 'RISK-0001 a.md' }, { record: b, href: 'RISK-0002-b.md' }];
  const inner = collectionRegister(definition, rows, '2026-10-04', ['docs/risks/broken.md'], riskMatrix(definition, riskScoringModel(definition), [a, b]));
  assert.match(inner, /\| \[RISK-0001\]\(<RISK-0001 a\.md>\) \| Pipe \\\| name \| Identified \| High \| 12 \|/);
  assert.match(inner, /\| 3 Possible \| 3 Low \| 6 Medium \| 9 Medium \| 12 High: RISK-0001 \| 15 Critical \|/);
  assert.match(inner, /\| 5 Almost certain \| 5 Medium \| 10 High \| 15 Critical \| 20 Critical \| 25 Critical \|/, 'closed risks stay out of the matrix');
  assert.match(inner, /### Overdue\n\n- \[RISK-0001\]\(<RISK-0001 a\.md>\) Pipe \\\| name — due 2026-09-01\n/);
  assert.match(inner, /### Needs attention\n\n- `docs\/risks\/broken.md`/);
  assert.match(collectionRegister(definition, [], '2026-10-04', []), /_No notes yet._[\s\S]*_None._/);
  assert.equal(collectionTableText(' a\n|b\\ '), 'a \\|b\\\\');
  const created = mergeCollectionRegister(definition, null, inner, digest);
  assert.ok(created.startsWith('# Risk register\n\n<!-- risk-register:start sha256='));
  const authored = `Intro by hand.\n\n${created.slice(created.indexOf('<!--'))}\nOutro by hand.\n`;
  const next = mergeCollectionRegister(definition, authored, 'new block\n', digest);
  assert.ok(next.startsWith('Intro by hand.\n\n<!-- risk-register:start') && next.endsWith('<!-- risk-register:end -->\n\nOutro by hand.\n') && next.includes('new block\n'));
  assert.equal(mergeCollectionRegister(definition, 'Only prose', 'x\n', digest), `Only prose\n\n<!-- risk-register:start sha256=${digest('x\n')} -->\nx\n<!-- risk-register:end -->\n`);
  assert.throws(() => mergeCollectionRegister(definition, next.replace('new block', 'edited block'), inner, digest), /edited by hand/);
  assert.throws(() => mergeCollectionRegister(definition, next + next, inner, digest), /exactly one/);
  assert.throws(() => mergeCollectionRegister(definition, 'text <!-- risk-register:end -->', inner, digest), /exactly one/);
  const base = collectionBase(definition);
  assert.deepEqual(base.filters.and, ['file.folder == this.file.folder', 'file.ext == "md"', 'note.type == "Risk"']);
  assert.ok(!base.views[0].order.includes('note.next-action') && base.views[0].order.includes('note.level'));
  assert.equal(riskMatrix(definition, { ...riskScoringModel(definition), factors: [] }, []), '');
});
