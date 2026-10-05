import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { parseCollectionNote, patchCollectionNote } from '../../bin/adapters/collection-notes.ts';
import { collectionDate, openCollection } from '../../bin/adapters/collection-store.ts';
import { collectionCreatePlan } from '../../bin/adapters/collection-store.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'risk-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** The real maker parser and dispatcher, exactly as `node bin/app risk …` routes them. */
const cli = (root, ...argv) => execute(parseArguments(['risk', ...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot: repository, input: process.stdin });
const risk = { title: 'Vendor API late', description: 'The vendor may ship v2 late.', nextAction: 'Ask for a date', due: '2026-10-20', dimension: 'schedule', category: 'external', probability: 3, impact: 4 };
async function json(root, name, value) { await writeFile(join(root, name), JSON.stringify(value)); return name; }
async function create(root, value = risk) {
  const file = await json(root, 'new.json', value), plan = await cli(root, 'new', '--input', file);
  return cli(root, 'new', '--input', file, '--apply', plan.planHash);
}
const read = (root, path) => readFile(join(root, path), 'utf8');

test('risk is a maker command root with its own options, help and routing', async () => {
  assert.equal(routeArguments(['risk', 'list']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'risk']).args, ['risk', '--help']);
  const args = parseArguments(['risk', 'list', '--status', 'identified', '--dimension', 'cost', '--category', 'external', '--level', 'high', '--overdue', '--id', 'RISK-0001', '--as-of', '2026-01-01'], []);
  assert.deepEqual({ ...args.flags }, { status: 'identified', dimension: 'cost', category: 'external', level: 'high', overdue: true, id: 'RISK-0001', 'as-of': '2026-01-01' });
  const help = await execute(parseArguments(['risk', '--help'], []), { root: repository, frameworkRoot: repository, input: process.stdin });
  assert.match(help.help, /node bin\/app risk report \[--base\] --json/); assert.ok(help.commands.includes('risk'));
  await scratch(async root => {
    await assert.rejects(() => cli(root, 'edit', '--id', 'RISK-0001'), /risk edit runs in a terminal/);
    await assert.rejects(() => cli(root, 'archive'), /Use risk list\|show\|check/);
    await assert.rejects(() => cli(root, 'show'), /risk show --id/);
    await assert.rejects(() => cli(root, 'new'), /MAKER_INPUT_REQUIRED|--input/);
    await assert.rejects(() => execute(parseArguments(['risk', 'list', '--as-of', '2026-13-01'], []), { root, frameworkRoot: repository, input: process.stdin }), /YYYY-MM-DD/);
  });
  assert.match(collectionDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test('new plans one note with the next id and applies only its exact plan hash', async () => scratch(async root => {
  const file = await json(root, 'new.json', risk), plan = await cli(root, 'new', '--input', file);
  assert.equal(plan.status, 'planned'); assert.equal(plan.path, 'docs/risks/RISK-0001-vendor-api-late.md');
  await assert.rejects(() => cli(root, 'new', '--input', file, '--apply', 'f'.repeat(64)), /plan changed/);
  await assert.rejects(() => readdir(join(root, 'docs')), /ENOENT/);
  assert.equal((await cli(root, 'new', '--input', file, '--apply', plan.planHash)).status, 'applied');
  assert.equal(await read(root, plan.path), plan.content);
  // The register and any file name keep their ids reserved even after a note is gone.
  await writeFile(join(root, 'docs/risks/risk-register.md'), 'Retired: RISK-0007\n');
  assert.equal((await create(root, { ...risk, title: 'Second' })).id, 'RISK-0008');
  // Another note created between review and apply makes the reviewed id stale.
  const context = await openCollection(root, 'risk', '2026-10-04'), stale = await collectionCreatePlan(context, { ...risk, title: 'Third' });
  await create(root, { ...risk, title: 'Racing' });
  await assert.rejects(() => applyPrepared(stale, stale.planHash), /changed after review/);
  assert.deepEqual((await readdir(join(root, 'docs/risks'))).sort(), ['RISK-0001-vendor-api-late.md', 'RISK-0008-second.md', 'RISK-0009-racing.md', 'risk-register.md']);
}));

test('updates keep the path, id, creation dates, unrelated properties, comments and body bytes', async () => scratch(async root => {
  const { path } = await create(root);
  const original = await read(root, path);
  const authored = original.replace('schema_version: 1\n', 'schema_version: 1\naliases: [vendor]  # kept\ncustom-score: 7\n') + '\nHand-written notes with --- and {{braces}}.\r\n';
  await writeFile(join(root, path), authored);
  const body = authored.slice(authored.indexOf('\n---\n') + 5);
  const changes = await json(root, 'changes.json', { status: 'mitigating', probability: 5, owner: 'Alex' });
  const plan = await cli(root, 'update', '--id', 'risk-0001', '--input', changes);
  assert.deepEqual([plan.path, plan.noteStatus], [path, 'mitigating']);
  await cli(root, 'update', '--id', 'RISK-0001', '--input', changes, '--apply', plan.planHash);
  const updated = await read(root, path), parts = parseCollectionNote(updated);
  assert.equal(updated.slice(updated.indexOf('\n---\n') + 5), body, 'the body is byte-identical');
  assert.match(updated, /aliases: \[ vendor \] # kept|aliases: \[vendor\] {2}# kept/);
  assert.deepEqual([parts.properties['custom-score'], parts.properties.created, parts.properties.updated, parts.properties.id], [7, '2026-10-04', '2026-10-04', 'RISK-0001']);
  assert.deepEqual([parts.properties.score, parts.properties.level, parts.properties.owner, parts.properties.status], [20, 'critical', 'Alex', 'mitigating']);
  // A refused transition and an unchanged update write nothing.
  await assert.rejects(() => cli(root, 'update', '--id', 'RISK-0001', '--input', changes), /Nothing to change/);
  await assert.rejects(async () => cli(root, 'update', '--id', 'RISK-0001', '--input', await json(root, 'bad.json', { status: 'identified' })), /mitigating → identified is not allowed/);
  await assert.rejects(() => cli(root, 'update', '--id', 'RISK-0404', '--input', changes), /No Risk note with id RISK-0404/);
  assert.equal(await read(root, path), updated);
}));

test('a note edited after review is never overwritten', async () => scratch(async root => {
  const { path } = await create(root), changes = await json(root, 'changes.json', { impact: 5 });
  const plan = await cli(root, 'update', '--id', 'RISK-0001', '--input', changes);
  const edited = (await read(root, path)) + '\nEdited in Obsidian.\n';
  await writeFile(join(root, path), edited);
  await assert.rejects(() => cli(root, 'update', '--id', 'RISK-0001', '--input', changes, '--apply', plan.planHash), /plan changed/);
  assert.equal(await read(root, path), edited);
  const context = await openCollection(root, 'risk', '2026-10-04');
  const { collectionUpdatePlan } = await import('../../bin/adapters/collection-store.ts');
  const prepared = await collectionUpdatePlan(context, 'RISK-0001', { impact: 2 });
  await writeFile(join(root, path), edited + 'Again.\n');
  await assert.rejects(() => applyPrepared(prepared, prepared.planHash), /PLAN_STALE/);
  assert.equal(await read(root, path), edited + 'Again.\n');
}));

test('check reports malformed, future, invalid and duplicate notes, ignores other Markdown and changes nothing', async () => scratch(async root => {
  await create(root);
  const folder = join(root, 'docs/risks');
  const files = {
    'broken.md': '---\ntype: Risk\nid: [unclosed\n---\nbody\n',
    'alias.md': '---\nbase: &a x\ntype: Risk\nid: *a\n---\n',
    'future.md': '---\ntype: Risk\nid: RISK-0050\nschema_version: 2\n---\nNewer.\n',
    'invalid.md': '---\ntype: Risk\nid: RISK-0002\ntitle: Bad\nstatus: identified\ncreated: 2026-10-01\nupdated: 2026-10-01\ndescription: d\nidentified: 2026-10-01\ndimension: weather\ncategory: external\nprobability: 3\nimpact: 4\nscore: 11\n---\n',
    'copy.md': (await read(root, 'docs/risks/RISK-0001-vendor-api-late.md')),
    'readme.md': '# Not a risk\n', 'task.md': '---\ntype: Task\n---\n',
  };
  for (const [name, content] of Object.entries(files)) await writeFile(join(folder, name), content);
  await mkdir(join(folder, 'archive/.hidden'), { recursive: true }); await writeFile(join(folder, 'archive/.hidden/x.md'), '---\ntype: Risk\n---\n');
  await writeFile(join(folder, 'binary.md'), Buffer.from([0xff, 0xfe, 0x00]));
  const result = await cli(root, 'check');
  assert.equal(result.status, 'failed');
  const codes = result.issues.map(item => `${item.path.slice('docs/risks/'.length)}:${item.code}`).sort();
  assert.deepEqual(codes, ['alias.md:COLLECTION_NOTE_UNREADABLE', 'binary.md:COLLECTION_NOTE_UNREADABLE', 'broken.md:COLLECTION_NOTE_UNREADABLE', 'copy.md:COLLECTION_DUPLICATE_ID',
    'future.md:COLLECTION_FUTURE', 'invalid.md:COLLECTION_DERIVED', 'invalid.md:COLLECTION_OPEN_FIELD', 'invalid.md:COLLECTION_OPEN_FIELD', 'invalid.md:COLLECTION_VALUE']);
  assert.deepEqual(result.ignored, ['docs/risks/readme.md', 'docs/risks/task.md']);
  for (const [name, content] of Object.entries(files)) assert.equal(await read(root, 'docs/risks/' + name), content, name);
  const listed = await cli(root, 'list');
  assert.deepEqual(listed.notes.map(item => item.id), ['RISK-0001', 'RISK-0001'], 'both readable copies are listed; check reports the duplicate');
  assert.equal(listed.needsAttention.length, 5);
  await assert.rejects(async () => cli(root, 'update', '--id', 'RISK-0050', '--input', await json(root, 'c.json', { impact: 1 })), /cannot be changed until it is valid/);
  await assert.rejects(async () => cli(root, 'update', '--id', 'RISK-0001', '--input', await json(root, 'c.json', { impact: 1 })), /RISK-0001 is used by/);
  assert.equal((await cli(root, 'show', '--id', 'RISK-0050')).state, 'future');
  assert.equal((await create(root, { ...risk, title: 'After future' })).id, 'RISK-0051', 'future and unreadable ids stay reserved');
}));

test('list filters and show reads one note with its derived values and overdue state', async () => scratch(async root => {
  await create(root);
  await create(root, { ...risk, title: 'Cost overrun', dimension: 'cost', probability: 1, impact: 2, due: '2026-09-01', status: 'assessed' });
  const all = await cli(root, 'list');
  assert.deepEqual(all.notes.map(item => [item.id, item.level, item.overdue]), [['RISK-0001', 'high', false], ['RISK-0002', 'low', true]]);
  assert.deepEqual((await cli(root, 'list', '--dimension', 'cost')).notes.map(item => item.id), ['RISK-0002']);
  assert.deepEqual((await cli(root, 'list', '--overdue')).notes.map(item => item.id), ['RISK-0002']);
  assert.deepEqual((await cli(root, 'list', '--status', 'identified', '--level', 'high')).count, 1);
  await assert.rejects(() => cli(root, 'list', '--level', 'severe'), /level must be one of/);
  const shown = await cli(root, 'show', '--id', 'RISK-0002');
  assert.deepEqual([shown.title, shown.values.score, shown.overdue, shown.issues], ['Cost overrun', 2, true, []]);
  const model = await cli(root, 'model');
  assert.deepEqual([model.source, model.folder, model.definition.type], ['builtin', 'docs/risks', 'Risk']);
}));

test('report writes the register and Bases file, preserves authored text and refuses edited generated blocks', async () => scratch(async root => {
  await create(root);
  const plan = await cli(root, 'report', '--base');
  assert.deepEqual(plan.changes.map(item => [item.path, item.status]), [['docs/risks/risk-register.md', 'create'], ['docs/risks/risks.base', 'create']]);
  await cli(root, 'report', '--base', '--apply', plan.planHash);
  const register = await read(root, 'docs/risks/risk-register.md');
  assert.match(register, /^# Risk register\n\n<!-- risk-register:start sha256=[0-9a-f]{64} -->\n/);
  assert.match(await read(root, 'docs/risks/risks.base'), /note\.type == "Risk"/);
  assert.ok((await cli(root, 'report', '--base')).changes.every(item => item.status === 'unchanged'), 'a rerun is unchanged');
  const authored = register.replace('# Risk register\n', '# Risk register\n\nOur appetite: low.\n') + '\n## Decisions\n\nKept.\n';
  await writeFile(join(root, 'docs/risks/risk-register.md'), authored);
  await create(root, { ...risk, title: 'Second risk' });
  const next = await cli(root, 'report');
  await cli(root, 'report', '--apply', next.planHash);
  const merged = await read(root, 'docs/risks/risk-register.md');
  assert.ok(merged.startsWith('# Risk register\n\nOur appetite: low.\n') && merged.endsWith('\n## Decisions\n\nKept.\n') && merged.includes('RISK-0002'));
  await writeFile(join(root, 'docs/risks/risk-register.md'), merged.replace('| Identified |', '| Hand edit |'));
  await assert.rejects(() => cli(root, 'report'), /edited by hand/);
  await writeFile(join(root, 'docs/risks/risks.base'), 'views: []\n');
  await writeFile(join(root, 'docs/risks/risk-register.md'), merged);
  await assert.rejects(() => cli(root, 'report', '--base'), /risks.base already exists/);
}));

test('the folder comes from paths.risks; projects may replace the definition, and a broken one fails closed', async () => scratch(async root => {
  await mkdir(join(root, 'configs'), { recursive: true });
  await writeFile(join(root, 'configs/user-settings.json'), JSON.stringify({ schemaVersion: 1, paths: { risks: 'registers/risks' } }));
  assert.equal((await create(root)).path, 'registers/risks/RISK-0001-vendor-api-late.md');
  const custom = JSON.parse(await readFile(join(repository, 'configs/collections/risk.json'), 'utf8'));
  custom.vocabularies.dimension.push({ id: 'reputation', label: 'Reputation' });
  custom.model.levels[3].min = 20;
  await mkdir(join(root, 'configs/collections'), { recursive: true });
  await writeFile(join(root, 'configs/collections/risk.json'), JSON.stringify(custom));
  const second = await create(root, { ...risk, title: 'Press coverage', dimension: 'reputation', probability: 4, impact: 4 });
  assert.match(second.content, /level: "high"/);
  assert.equal((await cli(root, 'model')).source, 'project');
  custom.model.levels[3].min = 99;
  await writeFile(join(root, 'configs/collections/risk.json'), JSON.stringify(custom));
  await assert.rejects(() => cli(root, 'list'), /configs\/collections\/risk.json: model: thresholds must cover/);
  await writeFile(join(root, 'configs/collections/risk.json'), JSON.stringify({ ...custom, hook: 'risk.unknown' }));
  await assert.rejects(() => cli(root, 'list'), /unknown hook risk.unknown/);
  await writeFile(join(root, 'configs/collections/risk.json'), JSON.stringify({ ...custom, id: 'other' }));
  await assert.rejects(() => cli(root, 'list'), /must be named other.json/);
}));

test('the parser keeps unrelated YAML intact and refuses unsafe frontmatter', () => {
  assert.equal(parseCollectionNote('# No frontmatter\n'), null);
  for (const unsafe of ['---\na: 1\na: 2\n---\n', '---\n- list\n---\n', '---\nx: !!binary aGk=\n---\n', '---\n__proto__: 1\n---\n', '---\nunclosed: true\n', '---\n---\n'])
    assert.throws(() => parseCollectionNote(unsafe), /COLLECTION_NOTE_YAML|Frontmatter|frontmatter/, unsafe);
  assert.throws(() => parseCollectionNote('x'.repeat(1_000_001)), /under 1 MB/);
  const note = '---\r\n# leading comment\ntype: Risk\nlist:\n  - a\nstatus: identified\n---\r\nBody\r\n';
  const patched = patchCollectionNote(note, { status: 'closed', closed: '2026-10-04', type: 'Risk' }, ['missing', 'list']);
  assert.equal(patched, '---\n# leading comment\ntype: Risk\nstatus: "closed"\nclosed: "2026-10-04"\n---\nBody\r\n');
  assert.throws(() => patchCollectionNote('No frontmatter', {}, []), /lost its frontmatter/);
});
