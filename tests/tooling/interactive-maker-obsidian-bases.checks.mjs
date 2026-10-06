import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { parseExpression, tokenize, EXPRESSION_LIMITS } from '../../src/cli/domain/base-expression-parse.ts';
import { evaluateExpression, expressionIssues, formulaNames, truthy } from '../../src/cli/domain/base-expression.ts';
import { NoteScope, propertyId, readBase, requiredFolder, selectView, viewIssues } from '../../src/cli/domain/obsidian-base.ts';
import { collectRecords, compareValues, fieldType } from '../../src/cli/domain/base-collection.ts';

const note = (path, properties = {}, tags = [], size = 10) => ({ path, properties, tags, size });
const code = run => { try { run(); return 'ok'; } catch (error) { return error.code; } };
const scope = (properties = {}, formulas = {}, path = 'Books/Dune.md', tags = ['sci-fi/classic', 'read']) => ({ note: note(path, properties, tags, 42), formula: name => formulas[name] ?? null });
const run = (source, properties, formulas, path) => evaluateExpression(parseExpression(source), scope(properties, formulas, path));
const source = { path: 'Books.base', sha256: 'a'.repeat(64) };

test('[BASES-01] the parser honours precedence, literals, escapes, lists, members, calls and indexing', () => {
  assert.deepEqual(parseExpression('1 + 2 * 3'), { kind: 'binary', operator: '+', left: { kind: 'literal', value: 1 }, right: { kind: 'binary', operator: '*', left: { kind: 'literal', value: 2 }, right: { kind: 'literal', value: 3 } } });
  assert.equal(run('(1 + 2) * 3'), 9);
  assert.equal(run('"a\\"b" + \'c\''), 'a"bc');
  assert.deepEqual(run('[1, "x", true, null, []]'), [1, 'x', true, null, []]);
  assert.equal(run('note.list[1]', { list: ['a', 'b'] }), 'b');
  assert.equal(run('note.meta["k"]', { meta: { k: 'v' } }), 'v');
  assert.equal(run('note.meta.k', { meta: { k: 'v' } }), 'v');
  assert.equal(run('a || b && c', { a: false, b: true, c: 'yes' }), 'yes');
  assert.equal(tokenize('a.b').length, 4);
});

test('[BASES-02] malformed or oversized expressions fail with a position, never a partial tree', () => {
  for (const [input, expected] of [['"open', 'BASE_EXPRESSION'], ['1 +', 'BASE_EXPRESSION'], ['a $ b', 'BASE_EXPRESSION'], ['(1', 'BASE_EXPRESSION'], ['1 2', 'BASE_EXPRESSION'],
    ['note.', 'BASE_EXPRESSION'], ['"\\', 'BASE_EXPRESSION'], ['   ', 'BASE_EXPRESSION'], [')', 'BASE_EXPRESSION'],
    ['x'.repeat(EXPRESSION_LIMITS.characters + 1), 'BASE_LIMIT'], ['('.repeat(45) + '1' + ')'.repeat(45), 'BASE_LIMIT'], ['!'.repeat(45) + 'a', 'BASE_LIMIT'], [Array(210).fill('a').join('+'), 'BASE_LIMIT']]) {
    assert.equal(code(() => parseExpression(input)), expected, input.slice(0, 20));
  }
  assert.throws(() => parseExpression('1 +'), /Unexpected end of expression at character 4/);
});

test('[BASES-03] operators compare strictly, never coerce, and arithmetic outside numbers is empty', () => {
  const cases = [['1 == 1', true], ['"1" == 1', false], ['[1,2] == [1,2]', true], ['1 != 2', true], ['2 > 1', true], ['"b" >= "a"', true], ['1 < "2"', false], ['null <= null', false],
    ['3 <= 3', true], ['2 < 1', false], ['7 % 4', 3], ['8 / 2', 4], ['1 / 0', null], ['5 - 2', 3], ['"n" + 1', 'n1'], ['1 + null', null], ['-note.n', -4], ['!0', true], ['!""', true],
    ['0 || "x"', 'x'], ['"a" && 0', 0], ['"x" + [1]', 'x[1]']];
  for (const [input, expected] of cases) assert.deepEqual(run(input, { n: 4 }), expected, input);
  assert.deepEqual([truthy([]), truthy([0]), truthy({}), truthy({ a: 1 }), truthy(''), truthy(0)], [false, true, false, true, false, false]);
});

test('[BASES-04] note, file and formula namespaces read the note, its file metadata and memoized formulas', () => {
  const props = { status: 'done', tags: ['x'], title: 'Dune' };
  assert.equal(run('status', props), 'done');
  assert.equal(run('note.missing', props), null);
  assert.deepEqual(['name', 'basename', 'path', 'folder', 'ext', 'size'].map(field => run(`file.${field}`, props)), ['Dune.md', 'Dune', 'Books/Dune.md', 'Books', 'md', 42]);
  assert.deepEqual([run('file.folder', {}, {}, 'Root.md'), run('file.ext', {}, {}, 'Books/README'), run('file.basename', {}, {}, 'Books/.hidden')], ['', '', '.hidden']);
  assert.deepEqual(run('file.tags'), ['sci-fi/classic', 'read']);
  assert.deepEqual([run('file.inFolder("Books")'), run('file.inFolder("Books/")'), run('file.inFolder("Book")'), run('file.inFolder("")')], [true, true, false, true]);
  assert.deepEqual([run('file.hasTag("sci-fi")'), run('file.hasTag("#READ")'), run('file.hasTag("classic", "x")'), run('file.hasTag("sci")')], [true, true, false, false]);
  assert.deepEqual([run('file.hasProperty("status")', props), run('file.hasProperty("nope")', props)], [true, false]);
  assert.equal(run('formula.total + 1', {}, { total: 2 }), 3);
  assert.equal(run('file.unknownField'), null);
  assert.equal(code(() => run('note')), 'BASE_EXPRESSION');
  assert.equal(code(() => run('(1)(2)')), 'BASE_EXPRESSION');
});

test('[BASES-05] value methods and if() follow the documented subset', () => {
  const props = { title: '  Dune Messiah ', tags: ['a', 'b'], empty: [], n: 0 };
  const cases = [['note.tags.contains("a")', true], ['note.title.contains("Mess")', true], ['note.tags.containsAny("x", "b")', true], ['note.tags.containsAll("a", "x")', false],
    ['note.title.trim().startsWith("Dune")', true], ['note.title.trim().endsWith("Messiah")', true], ['note.title.lower().trim()', 'dune messiah'], ['note.title.upper().trim()', 'DUNE MESSIAH'],
    ['note.empty.isEmpty()', true], ['note.missing.isEmpty()', true], ['note.n.isEmpty()', false], ['note.tags.length', 2], ['note.title.length', 15], ['note.n.length', null],
    ['note.tags.toString()', '["a","b"]'], ['note.n.toString()', '0'], ['if(note.n, "yes", "no")', 'no'], ['if(1, "yes")', 'yes'], ['if(0, "yes")', null], ['note.tags[9]', null], ['note.n[0]', null]];
  for (const [input, expected] of cases) assert.deepEqual(run(input, props), expected, input);
});

test('[BASES-06] unsupported functions, timestamps, undeclared formulas and namespace calls are issues before evaluation', () => {
  const issues = source => expressionIssues(parseExpression(source), new Set(['known']));
  assert.deepEqual(issues('file.inFolder("a") && formula.known > 1 && if(1, 2)'), []);
  assert.match(issues('now() > 1')[0], /now\(\) is not supported/);
  assert.match(issues('file.mtime > 1')[0], /timestamps/);
  assert.match(issues('file.links')[0], /file\.links is not supported/);
  assert.match(issues('file.asLink()')[0], /file\.asLink\(\) is not supported/);
  assert.match(issues('formula.other')[0], /not declared/);
  assert.match(issues('note.status()')[0], /not a method/);
  assert.match(issues('note.x.reduce()')[0], /\.reduce\(\) is not supported/);
  assert.match(issues('if(1)')[0], /condition, a value/);
  assert.match(issues('(1)(2)')[0], /Only named functions/);
  assert.deepEqual(issues('now() || now()'), ['now() is not supported.']);
  assert.deepEqual(formulaNames(parseExpression('formula.a + formula.b * note.formula')), ['a', 'b']);
});

const definition = (extra = {}) => readBase({
  filters: { and: ['file.inFolder("Books")', { not: ['file.hasTag("draft")'] }] },
  formulas: { score: 'note.rating * 2', label: 'if(formula.score > 5, "great", "ok")' },
  properties: { 'note.title': { displayName: 'Title' }, rating: { displayName: 'Rating' }, 'note.ignored': 'not a mapping' },
  views: [
    { type: 'table', name: 'All', order: ['file.name', 'title', 'rating', 'formula.label'], sort: [{ property: 'rating', direction: 'DESC' }], cardSize: 3 },
    { type: 'cards', name: 'Top', filters: { or: ['rating >= 4', 'file.hasTag("favourite")'] }, limit: 2, groupBy: { property: 'note.genre', direction: 'ASC' }, sort: [{ property: 'title' }] },
    { name: 'Bare' },
  ],
  summaries: { custom: 'values.length' }, ...extra,
});
const notes = [
  note('Books/Dune.md', { title: 'Dune', rating: 5, genre: 'sf' }, ['favourite']),
  note('Books/Emma.md', { title: 'Emma', rating: 3, genre: 'classic' }),
  note('Books/Draft.md', { title: 'Draft', rating: 5, genre: 'sf' }, ['draft']),
  note('Books/Hobbit.md', { title: 'The Hobbit', rating: 4, genre: 'fantasy' }),
  note('Books/Untitled.md', { genre: 'sf' }),
  note('Other/Ulysses.md', { title: 'Ulysses', rating: 5, genre: 'classic' }),
];

test('[BASES-07] a .base file reads into filters, formulas, display names and views; unknown keys are reported, not kept silently', () => {
  const base = definition();
  assert.deepEqual(base.views.map(view => [view.name, view.type, view.limit]), [['All', 'table', null], ['Top', 'cards', 2], ['Bare', 'table', null]]);
  assert.deepEqual(base.views[0].order, ['file.name', 'note.title', 'note.rating', 'formula.label']);
  assert.deepEqual(base.views[1].sort, [{ property: 'note.title', direction: 'ASC' }]);
  assert.deepEqual([base.views[0].ignored, base.ignored], [['cardSize'], ['summaries']]);
  assert.deepEqual(base.displayNames, { 'note.title': 'Title', 'note.rating': 'Rating' });
  assert.deepEqual([...base.formulas.keys()], ['score', 'label']);
  assert.equal(requiredFolder(base.filters), 'Books');
  assert.deepEqual([propertyId('status'), propertyId('file.name'), propertyId('formula.x')], ['note.status', 'file.name', 'formula.x']);
  assert.equal(selectView(base, 'Top').name, 'Top');
  assert.equal(code(() => selectView(base, undefined)), 'BASE_VIEW_REQUIRED');
  assert.equal(code(() => selectView(base, 'Nope')), 'BASE_VIEW_UNKNOWN');
});

test('[BASES-08] malformed .base files are refused with a stable code', () => {
  const view = { name: 'V' };
  const cases = [[[], 'BASE_SHAPE'], [{ views: [] }, 'BASE_VIEW'], [{ views: [view, view] }, 'BASE_VIEW'], [{ views: 'x' }, 'BASE_FIELD'], [{ views: [1] }, 'BASE_VIEW'],
    [{ views: [{ name: '' }] }, 'BASE_FIELD'], [{ views: [view], filters: { xor: [] } }, 'BASE_FILTER'], [{ views: [view], filters: { and: [], or: [] } }, 'BASE_FILTER'], [{ views: [view], filters: 3 }, 'BASE_FILTER'],
    [{ views: [{ ...view, sort: [{ property: 'a', direction: 'UP' }] }] }, 'BASE_SORT'], [{ views: [{ ...view, sort: ['a'] }] }, 'BASE_SORT'], [{ views: [{ ...view, limit: 0 }] }, 'BASE_FIELD'],
    [{ views: [{ ...view, order: ['two words'] }] }, 'BASE_PROPERTY'], [{ views: [view], formulas: { 'bad-name': '1' } }, 'BASE_FORMULAS'], [{ views: [view], formulas: [] }, 'BASE_FORMULAS'],
    [{ views: [view], properties: [] }, 'BASE_PROPERTIES'], [{ views: [view], filters: '1 +' }, 'BASE_EXPRESSION'],
    [{ views: [view], filters: { and: Array(201).fill('true') } }, 'BASE_LIMIT']];
  for (const [value, expected] of cases) assert.equal(code(() => readBase(value)), expected, JSON.stringify(value).slice(0, 60));
  let deep = 'true'; for (let i = 0; i < 22; i++) deep = { and: [deep] };
  assert.equal(code(() => readBase({ views: [view], filters: deep })), 'BASE_LIMIT');
  const empty = readBase({ views: [{ name: 'V', filters: null, groupBy: null, order: null, limit: null }], filters: null, formulas: null, properties: null });
  assert.deepEqual([empty.filters, empty.views[0].filters, empty.views[0].order, requiredFolder(empty.filters)], [null, null, [], null]);
});

test('[BASES-09] a view selects, orders, groups and limits records deterministically, with typed fields', () => {
  const base = definition();
  const all = collectRecords(base, selectView(base, 'All'), notes, source);
  assert.deepEqual(all.records.map(record => record.path), ['Books/Dune.md', 'Books/Hobbit.md', 'Books/Emma.md', 'Books/Untitled.md']);
  assert.deepEqual(all.records[0].values, { 'file.name': 'Dune.md', 'note.title': 'Dune', 'note.rating': 5, 'formula.label': 'great' });
  assert.deepEqual(all.collection.fields, [
    { property: 'file.name', displayName: 'name', type: 'text' }, { property: 'note.title', displayName: 'Title', type: 'text' },
    { property: 'note.rating', displayName: 'Rating', type: 'number' }, { property: 'formula.label', displayName: 'label', type: 'text' }]);
  assert.deepEqual([all.collection.kind, all.collection.folder, all.collection.base, all.matched], ['file-collection', 'Books', { ...source, view: 'All' }, 4]);
  const top = collectRecords(base, selectView(base, 'Top'), notes, source);
  assert.deepEqual(top.records.map(record => [record.group, record.path]), [['fantasy', 'Books/Hobbit.md'], ['sf', 'Books/Dune.md']]);
  assert.equal(top.matched, 2);
  assert.deepEqual(collectRecords(base, selectView(base, 'Bare'), notes, source).records.map(record => Object.keys(record.values)), [['file.name'], ['file.name'], ['file.name'], ['file.name']]);
});

test('[BASES-10] unsupported views are refused as a whole and formula cycles are reported', () => {
  const base = readBase({ formulas: { a: 'formula.b + 1', b: 'formula.a', ok: '1', stamp: 'file.mtime' }, views: [
    { name: 'Cycle', order: ['formula.a'] }, { name: 'Stamp', filters: 'formula.stamp > 0' }, { name: 'Fine', order: ['formula.ok', 'file.name'] },
    { name: 'Missing', order: ['formula.nope'] }, { name: 'File', sort: [{ property: 'file.ctime' }] }] });
  assert.match(viewIssues(base, selectView(base, 'Cycle')).join(' '), /refers to itself/);
  assert.match(viewIssues(base, selectView(base, 'Stamp')).join(' '), /timestamps/);
  assert.deepEqual(viewIssues(base, selectView(base, 'Fine')), []);
  assert.match(viewIssues(base, selectView(base, 'Missing')).join(' '), /formula\.nope is not declared/);
  assert.match(viewIssues(base, selectView(base, 'File')).join(' '), /file\.ctime/);
  assert.equal(code(() => collectRecords(base, selectView(base, 'Cycle'), notes, source)), 'BASE_VIEW_UNSUPPORTED');
  const scoped = new NoteScope(base, note('a.md'));
  assert.equal(code(() => scoped.formula('a')), 'BASE_FORMULA');
  assert.equal(code(() => scoped.formula('undeclared')), 'BASE_FORMULA');
  assert.equal(scoped.formula('ok'), 1); assert.equal(scoped.formula('ok'), 1);
});

test('[BASES-11] ordering is total and field types summarise mixed, empty, date, list and object values', () => {
  const values = [null, 'b', 2, true, [1], 'a', 1, false, { a: 1 }, null];
  assert.deepEqual([...values].sort(compareValues), [1, 2, false, true, 'a', 'b', [1], { a: 1 }, null, null]);
  assert.equal(compareValues('file10', 'file9') > 0, true);
  const cases = [[[null, ''], 'empty'], [['2026-01-02', null], 'date'], [['2026-01-02', 'x'], 'text'], [[1, 'x'], 'mixed'], [[[1]], 'list'], [[{}], 'object'], [[true], 'boolean'], [[1.5], 'number'], [['2026-01-02T10:00:00Z'], 'date']];
  for (const [input, expected] of cases) assert.equal(fieldType(input), expected, JSON.stringify(input));
  const base = readBase({ views: [{ name: 'V', order: ['note.n'], sort: [{ property: 'note.n', direction: 'DESC' }], limit: 3 }] });
  const rows = collectRecords(base, base.views[0], [note('a.md', { n: 1 }), note('b.md', {}), note('c.md', { n: 3 }), note('d.md', { n: 3 }), note('e.md', { n: 2 })], source);
  assert.deepEqual([rows.records.map(record => record.path), rows.matched], [['c.md', 'd.md', 'e.md'], 5]);
  const nulls = collectRecords(base, base.views[0], [note('b.md', {}), note('a.md', { n: 1 })], source);
  assert.deepEqual(nulls.records.map(record => record.path), ['a.md', 'b.md'], 'empty values stay last in descending order');
  assert.equal(requiredFolder(readBase({ views: [{ name: 'V' }], filters: 'file.inFolder("Solo/")' }).filters), 'Solo');
  for (const filters of ['file.inFolder(note.x)', 'file.hasTag("x")', { or: ['file.inFolder("A")'] }, 'other.inFolder("A")', 'note.inFolder("A")', 'file.inFolder("A", "B")'])
    assert.equal(requiredFolder(readBase({ views: [{ name: 'V' }], filters }).filters), null, JSON.stringify(filters));
});
