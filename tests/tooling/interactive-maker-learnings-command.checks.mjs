import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { parseCollectionNote } from '../../bin/adapters/collection-notes.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { settingsPlan } from '../../bin/adapters/user-settings.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { defaultSettings, effectivePaths, readSettings, settingsSchema, withoutImplicitPaths } from '../../bin/domain/user-settings.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'learnings-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** The real maker parser and dispatcher, exactly as `node bin/app learning …` routes them. */
const cli = (root, ...argv) => execute(parseArguments(['learning', ...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot: repository, input: process.stdin });
const learning = { title: 'Pin the toolchain', context: 'CI broke after a silent npm upgrade.', insight: 'Pin exact Node and npm versions.', category: 'tooling', impact: 'high', tags: ['ci', 'dependencies'] };
async function json(root, name, value) { await writeFile(join(root, name), JSON.stringify(value)); return name; }
async function create(root, value = learning) {
  const file = await json(root, 'new.json', value), plan = await cli(root, 'new', '--input', file);
  return cli(root, 'new', '--input', file, '--apply', plan.planHash);
}
async function update(root, id, value) {
  const file = await json(root, 'changes.json', value), plan = await cli(root, 'update', '--id', id, '--input', file);
  return cli(root, 'update', '--id', id, '--input', file, '--apply', plan.planHash);
}
const read = (root, path) => readFile(join(root, path), 'utf8');

test('learning is its own maker command root beside the learn courses, with filters and help', async () => {
  assert.equal(routeArguments(['learning', 'list']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'learning']).args, ['learning', '--help']);
  const args = parseArguments(['learning', 'list', '--status', 'validated', '--category', 'tooling', '--impact', 'high', '--overdue'], []);
  assert.deepEqual({ ...args.flags }, { status: 'validated', category: 'tooling', impact: 'high', overdue: true });
  const help = await execute(parseArguments(['learning', '--help'], []), { root: repository, frameworkRoot: repository, input: process.stdin });
  assert.match(help.help, /node bin\/app learning report \[--base\] --json/);
  assert.match(help.help, /node bin\/app learn list --json/, 'the course runner keeps its own help');
  assert.ok(help.commands.includes('learning') && help.commands.includes('learn'));
  await scratch(async root => {
    await assert.rejects(() => cli(root, 'edit', '--id', 'LRN-0001'), /learning edit runs in a terminal/);
    await assert.rejects(() => cli(root, 'complete-step'), /Use learning list\|show\|check/);
    await assert.rejects(() => cli(root, 'show'), /learning show --id/);
  });
});

test('new plans one note in docs/learnings and update keeps id, path, creation date, other properties and body', async () => scratch(async root => {
  const file = await json(root, 'new.json', { ...learning, relatedRisks: ['RISK-0002'] }), plan = await cli(root, 'new', '--input', file);
  assert.deepEqual([plan.status, plan.id, plan.path], ['planned', 'LRN-0001', 'docs/learnings/LRN-0001-pin-the-toolchain.md']);
  await assert.rejects(() => readdir(join(root, 'docs')), /ENOENT/, 'planning writes nothing');
  await assert.rejects(() => cli(root, 'new', '--input', file, '--apply', 'f'.repeat(64)), /plan changed/);
  await cli(root, 'new', '--input', file, '--apply', plan.planHash);
  const path = plan.path, original = await read(root, path);
  assert.equal(original, plan.content);
  const authored = original.replace('schema_version: 1\n', 'schema_version: 1\naliases: [toolchain]  # kept\nreviewers: 2\n') + '\nNotes added in Obsidian.\r\n';
  await writeFile(join(root, path), authored);
  const body = authored.slice(authored.indexOf('\n---\n') + 5);
  const changes = { status: 'validated', followUp: 'Add an engines check', due: '2026-10-20', owner: 'Alex', relatedRisks: ['RISK-0002', 'RISK-0005'] };
  const planned = await cli(root, 'update', '--id', 'lrn-0001', '--input', await json(root, 'changes.json', changes));
  assert.deepEqual([planned.path, planned.noteStatus], [path, 'validated']);
  await update(root, 'LRN-0001', changes);
  const updated = await read(root, path), { properties } = parseCollectionNote(updated);
  assert.equal(updated.slice(updated.indexOf('\n---\n') + 5), body, 'the body is byte-identical');
  assert.match(updated, /aliases: \[ toolchain \] # kept|aliases: \[toolchain\] {2}# kept/);
  assert.deepEqual([properties.id, properties.created, properties.updated, properties.reviewers, properties.status, properties['follow-up']], ['LRN-0001', '2026-10-04', '2026-10-04', 2, 'validated', 'Add an engines check']);
  assert.deepEqual(properties['related-risks'], ['RISK-0002', 'RISK-0005']);
  // Malformed references, no-op updates and refused transitions write nothing.
  await assert.rejects(async () => cli(root, 'update', '--id', 'LRN-0001', '--input', await json(root, 'bad.json', { status: 'draft', relatedRisks: ['RSK-1'] })), /related-risks must name ids like RISK-0001/);
  await assert.rejects(() => cli(root, 'update', '--id', 'LRN-0001', '--input', 'changes.json'), /Nothing to change/);
  await assert.rejects(() => cli(root, 'update', '--id', 'LRN-0404', '--input', 'changes.json'), /No Learning note with id LRN-0404/);
  assert.equal(await read(root, path), updated);
  await update(root, 'LRN-0001', { status: 'applied' });
  const applied = await read(root, path);
  assert.match(applied, /status: "applied"/); assert.match(applied, /applied: "2026-10-04"/);
  await assert.rejects(async () => cli(root, 'update', '--id', 'LRN-0001', '--input', await json(root, 'bad.json', { status: 'draft' })), /applied → draft is not allowed; from applied use validated, superseded, archived/);
  assert.equal(await read(root, path), applied);
}));

test('check reports risk-id format, vocabulary, validated-without-follow-up and overdue problems and changes nothing', async () => scratch(async root => {
  await create(root);
  const folder = join(root, 'docs/learnings');
  const note = (id, extra) => `---\ntype: Learning\nid: ${id}\ntitle: T\nstatus: validated\ncreated: 2026-10-01\nupdated: 2026-10-01\nobserved: 2026-09-30\ncontext: c\ninsight: i\ncategory: process\ntags: [ci]\nimpact: low\n${extra}---\nBody.\n`;
  const files = {
    'bad-risk.md': note('LRN-0002', 'follow-up: f\ndue: 2026-10-30\nrelated-risks: [RISK-2]\n'),
    'no-follow-up.md': note('LRN-0003', ''),
    'late.md': note('LRN-0004', 'follow-up: f\ndue: 2026-09-01\n'),
    'bad-tag.md': note('LRN-0005', 'follow-up: f\ndue: 2026-10-30\ntags: [gardening]\n').replace('tags: [ci]\n', ''),
    'risk.md': '---\ntype: Risk\nid: RISK-0001\n---\n', 'readme.md': '# Lessons\n',
  };
  for (const [name, content] of Object.entries(files)) await writeFile(join(folder, name), content);
  const result = await cli(root, 'check');
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.issues.map(item => `${item.path.slice('docs/learnings/'.length)}:${item.severity}:${item.code}`).sort(), ['bad-risk.md:error:COLLECTION_VALUE', 'bad-tag.md:error:COLLECTION_VALUE',
    'late.md:warning:COLLECTION_OVERDUE', 'no-follow-up.md:warning:COLLECTION_OPEN_FIELD', 'no-follow-up.md:warning:COLLECTION_OPEN_FIELD']);
  assert.deepEqual([result.errors, result.warnings], [2, 3]);
  assert.deepEqual(result.ignored, ['docs/learnings/readme.md', 'docs/learnings/risk.md']);
  for (const [name, content] of Object.entries(files)) assert.equal(await read(root, 'docs/learnings/' + name), content, name);
  const listed = await cli(root, 'list');
  assert.deepEqual([listed.notes.map(item => item.id), listed.needsAttention.length], [['LRN-0001', 'LRN-0003', 'LRN-0004'], 2]);
  assert.deepEqual((await cli(root, 'list', '--overdue')).notes.map(item => item.id), ['LRN-0004']);
  assert.deepEqual((await cli(root, 'list', '--impact', 'high')).notes.map(item => item.id), ['LRN-0001']);
  assert.deepEqual((await cli(root, 'list', '--status', 'validated', '--category', 'process')).count, 2);
  await assert.rejects(() => cli(root, 'list', '--impact', 'critical'), /impact must be one of low, medium, high/);
  const shown = await cli(root, 'show', '--id', 'LRN-0002');
  assert.deepEqual([shown.state, shown.issues[0].message], ['note', 'related-risks must name ids like RISK-0001.']);
  assert.equal((await create(root, { ...learning, title: 'Next' })).id, 'LRN-0006', 'ids of invalid notes stay reserved');
}));

test('report writes learnings.md and learnings.base, keeps authored text and refuses an edited generated block', async () => scratch(async root => {
  await create(root);
  await create(root, { ...learning, title: 'Review smaller PRs', category: 'process', impact: 'medium', tags: ['review'], status: 'validated', followUp: 'Cap PR size', due: '2026-09-01', relatedRisks: ['RISK-0001'] });
  const plan = await cli(root, 'report', '--base');
  assert.deepEqual(plan.changes.map(item => [item.path, item.status]), [['docs/learnings/learnings.md', 'create'], ['docs/learnings/learnings.base', 'create']]);
  await cli(root, 'report', '--base', '--apply', plan.planHash);
  const register = await read(root, 'docs/learnings/learnings.md');
  assert.match(register, /^# Learnings\n\n<!-- learning-register:start sha256=[0-9a-f]{64} -->\n/);
  assert.ok(register.indexOf('[LRN-0001]') < register.indexOf('[LRN-0002]'), 'drafts sort before validated learnings');
  assert.match(register, /\| \[LRN-0002\]\(<LRN-0002-review-smaller-prs\.md>\) \| Review smaller PRs \| Validated \| Medium \| Process \| review \| 2026-10-04 \|  \| RISK-0001 \|  \| 2026-09-01 \| Cap PR size \|/);
  assert.match(register, /### Overdue\n\n- \[LRN-0002\]/);
  assert.match(await read(root, 'docs/learnings/learnings.base'), /note\.type == "Learning"/);
  assert.ok((await cli(root, 'report', '--base')).changes.every(item => item.status === 'unchanged'), 'a rerun is unchanged');
  const authored = register.replace('# Learnings\n', '# Learnings\n\nShared in the monthly retro.\n') + '\n## Themes\n\nKept.\n';
  await writeFile(join(root, 'docs/learnings/learnings.md'), authored);
  await update(root, 'LRN-0002', { status: 'applied' });
  const next = await cli(root, 'report');
  await cli(root, 'report', '--apply', next.planHash);
  const merged = await read(root, 'docs/learnings/learnings.md');
  assert.ok(merged.startsWith('# Learnings\n\nShared in the monthly retro.\n') && merged.endsWith('\n## Themes\n\nKept.\n') && merged.includes('| Applied |'));
  await writeFile(join(root, 'docs/learnings/learnings.md'), merged.replace('| Applied |', '| Done |'));
  await assert.rejects(() => cli(root, 'report'), /edited by hand/);
}));

test('paths.learnings is an optional, validated settings path that every learning command and migration follows', async () => scratch(async root => {
  assert.equal(effectivePaths(defaultSettings.paths).learnings, 'docs/learnings');
  assert.equal(defaultSettings.paths.learnings, undefined, 'existing settings keep their exact path set');
  assert.ok(settingsSchema.properties.paths.properties.learnings);
  for (const learnings of ['docs/prds/lessons', '../lessons', '.obsidian/lessons', 'docs/risks', 'docs/design'])
    assert.throws(() => readSettings({ schemaVersion: 1, paths: { learnings } }), /SETTINGS|overlap|path|protected/i, learnings);
  const shown = readSettings({ schemaVersion: 1, paths: { learnings: 'docs/learnings' } });
  assert.equal(withoutImplicitPaths(shown, defaultSettings).paths.learnings, undefined, 'an untouched default shown by the form is not written');
  await mkdir(join(root, 'configs'), { recursive: true });
  const settings = await settingsPlan(root, { schemaVersion: 1, paths: { learnings: 'knowledge/lessons' } });
  await applyPrepared(settings, settings.planHash);
  assert.equal((await create(root)).path, 'knowledge/lessons/LRN-0001-pin-the-toolchain.md');
  assert.equal((await cli(root, 'model')).folder, 'knowledge/lessons');
  const migration = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { learnings: 'team/learnings' } });
  assert.deepEqual(migration.data.moves.map(move => [move.key, move.from, move.to]), [['learnings', 'knowledge/lessons', 'team/learnings']]);
  await applyPrepared(migration, migration.planHash);
  assert.deepEqual((await cli(root, 'list')).notes.map(item => item.path), ['team/learnings/LRN-0001-pin-the-toolchain.md']);
}));

test('the learnings-demo fake-data preset generates notes that learning check and report accept', async () => scratch(async root => {
  const fake = (...argv) => execute(parseArguments(['fake-data', '--config', 'learnings-demo', ...argv], []), { root, frameworkRoot: repository, input: process.stdin });
  const plan = await fake();
  await fake('--apply', plan.planHash);
  const checked = await execute(parseArguments(['learning', 'check', '--as-of', '2026-01-01'], []), { root, frameworkRoot: repository, input: process.stdin });
  assert.deepEqual([checked.status, checked.notes, checked.errors, checked.warnings, checked.ignored], ['ok', 20, 0, 0, []]);
  const listed = await cli(root, 'list');
  assert.ok(new Set(listed.notes.map(item => item.status)).size >= 3, 'the demo covers several statuses');
  assert.equal((await create(root)).id, 'LRN-0021', 'generated ids are reserved');
  assert.equal((await cli(root, 'report')).notes, 21);
}));
