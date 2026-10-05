import assert from 'node:assert/strict';
import { readdir, readFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { parseCollectionNote } from '../../bin/adapters/collection-notes.ts';
import { collectionCommandRoots, makerValueOptions } from '../../bin/domain/command-options.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'release-items-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** The real maker parser and dispatcher, exactly as `node bin/app release-item …` routes them. */
const cli = (root, ...argv) => execute(parseArguments(['release-item', ...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot: repository, input: process.stdin });
const item = { title: 'Checkout redesign', summary: 'A two-step checkout replaces the five-step flow.', kind: 'feature', priority: 'high',
  sources: ['prototypes/checkout', 'docs/design/checkout', 'brainstorms/checkout/feature.definition.json', 'docs/prds/checkout.md', 'RISK-0002', 'LRN-0001'], risks: ['RISK-0002'] };
async function json(root, name, value) { await writeFile(join(root, name), JSON.stringify(value)); return name; }
async function create(root, value = item) {
  const file = await json(root, 'new.json', value), plan = await cli(root, 'new', '--input', file);
  return cli(root, 'new', '--input', file, '--apply', plan.planHash);
}
async function update(root, id, value) {
  const file = await json(root, 'changes.json', value), plan = await cli(root, 'update', '--id', id, '--input', file);
  return cli(root, 'update', '--id', id, '--input', file, '--apply', plan.planHash);
}
const read = (root, path) => readFile(join(root, path), 'utf8');
const path = 'docs/releases/items/ITEM-0001-checkout-redesign.md';

test('release item is a collection command root with kind and priority filters and help', async () => {
  assert.equal(collectionCommandRoots['release-item'], 'release-item');
  assert.ok(makerValueOptions.includes('priority') && makerValueOptions.includes('kind'));
  assert.equal(routeArguments(['release-item', 'list']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'release-item']).args, ['release-item', '--help']);
  const help = await execute(parseArguments(['release-item', '--help'], []), { root: repository, frameworkRoot: repository, input: process.stdin });
  assert.match(help.help, /node bin\/app release-item new\|edit --id ITEM-0001\|review/);
  await scratch(async root => {
    await assert.rejects(() => cli(root, 'edit', '--id', 'ITEM-0001'), /release-item edit runs in a terminal/);
    assert.equal((await cli(root, 'model')).folder, 'docs/releases/items');
  });
});

test('new validates source paths and ids, refuses managed status and candidate input, and update keeps the note', async () => scratch(async root => {
  for (const [sources, pattern] of [[['../outside'], /sources must name a project-relative path/], [['.obsidian/plugins'], /sources must name/], [['RSK-0001'], /sources must name/], [['/abs/path'], /sources must name/]])
    await assert.rejects(async () => cli(root, 'new', '--input', await json(root, 'bad.json', { ...item, sources })), pattern, String(sources));
  await assert.rejects(async () => cli(root, 'new', '--input', await json(root, 'bad.json', { ...item, status: 'included' })), /included is set by another tool's reviewed plan/);
  await assert.rejects(async () => cli(root, 'new', '--input', await json(root, 'bad.json', { ...item, candidate: '1.0.0' })), /Unknown input candidate/);
  await assert.rejects(async () => cli(root, 'new', '--input', await json(root, 'bad.json', { ...item, status: 'ready' })), /Missing acceptance \(required while ready\)/);
  await assert.rejects(async () => cli(root, 'new', '--input', await json(root, 'bad.json', { ...item, kind: 'epic' })), /kind must be one of feature, fix, improvement, docs, chore/);
  await assert.rejects(() => readdir(join(root, 'docs')), /ENOENT/, 'refused plans write nothing');
  const created = await create(root);
  assert.deepEqual([created.id, created.path, created.frontmatter.status, created.frontmatter.proposed], ['ITEM-0001', path, 'proposed', '2026-10-04']);
  const authored = (await read(root, path)).replace('schema_version: 1\n', 'schema_version: 1\nepic: "[[Checkout]]"\n') + '\nDesign review notes.\n';
  await writeFile(join(root, path), authored);
  await update(root, 'ITEM-0001', { status: 'ready', acceptance: ['Payment completes in two steps', 'Saved cards still work'], target: '2026-11-01', owner: 'Alex' });
  const updated = await read(root, path), { properties } = parseCollectionNote(updated);
  assert.ok(updated.endsWith('\nDesign review notes.\n') && updated.includes('epic: "[[Checkout]]"'));
  assert.deepEqual([properties.status, properties.acceptance, properties.target, properties.created, properties.id], ['ready', ['Payment completes in two steps', 'Saved cards still work'], '2026-11-01', '2026-10-04', 'ITEM-0001']);
  await assert.rejects(async () => cli(root, 'update', '--id', 'ITEM-0001', '--input', await json(root, 'bad.json', { status: 'shipped' })), /shipped is set by another tool's reviewed plan/);
  await assert.rejects(async () => cli(root, 'update', '--id', 'ITEM-0001', '--input', await json(root, 'bad.json', { acceptance: [] })), /Missing acceptance \(required while ready\)/);
  await update(root, 'ITEM-0001', { status: 'dropped' });
  await assert.rejects(async () => cli(root, 'update', '--id', 'ITEM-0001', '--input', await json(root, 'bad.json', { status: 'ready' })), /dropped → ready is not allowed; from dropped use proposed/);
}));

test('check, list filters and the register cover release items, including a hand-set candidate value', async () => scratch(async root => {
  await create(root);
  await create(root, { title: 'Fix rounding', summary: 'Totals round half up.', kind: 'fix', status: 'ready', acceptance: ['Matches invoices'], target: '2026-09-01' });
  const folder = join(root, 'docs/releases/items');
  const note = (id, extra) => `---\ntype: ReleaseItem\nid: ${id}\ntitle: T\nstatus: ready\ncreated: 2026-10-01\nupdated: 2026-10-01\nproposed: 2026-09-30\nsummary: s\nkind: chore\n${extra}---\nBody.\n`;
  await writeFile(join(folder, 'bad-source.md'), note('ITEM-0003', 'acceptance: [ok]\nsources: [../x]\n'));
  await writeFile(join(folder, 'bad-candidate.md'), note('ITEM-0004', 'acceptance: [ok]\ncandidate: "1.0"\n'));
  await writeFile(join(folder, 'no-acceptance.md'), note('ITEM-0005', ''));
  const checked = await cli(root, 'check');
  assert.deepEqual(checked.issues.map(item => `${item.id}:${item.severity}:${item.code}`).sort(),
    ['ITEM-0002:warning:COLLECTION_OVERDUE', 'ITEM-0003:error:COLLECTION_VALUE', 'ITEM-0004:error:COLLECTION_VALUE', 'ITEM-0005:warning:COLLECTION_OPEN_FIELD']);
  assert.deepEqual((await cli(root, 'list', '--kind', 'fix')).notes.map(item => item.id), ['ITEM-0002']);
  assert.deepEqual((await cli(root, 'list', '--priority', 'high')).notes.map(item => item.id), ['ITEM-0001']);
  assert.deepEqual((await cli(root, 'list', '--status', 'ready', '--overdue')).notes.map(item => item.id), ['ITEM-0002']);
  const plan = await cli(root, 'report', '--base');
  await cli(root, 'report', '--base', '--apply', plan.planHash);
  const register = await read(root, 'docs/releases/items/release-items.md');
  assert.match(register, /^# Release items\n\n<!-- release-item-register:start sha256=[0-9a-f]{64} -->\n/);
  assert.match(register, /\| \[ITEM-0001\]\(<ITEM-0001-checkout-redesign\.md>\) \| Checkout redesign \| Proposed \| Feature \| High \|  \|  \|  \| prototypes\/checkout, docs\/design\/checkout/);
  assert.match(await read(root, 'docs/releases/items/release-items.base'), /note\.type == "ReleaseItem"/);
}));

test('the release-items-demo fake-data preset generates notes that release item check and candidate add accept', async () => scratch(async root => {
  const fake = (...argv) => execute(parseArguments(['fake-data', '--generation', 'release-items-demo', ...argv], []), { root, frameworkRoot: repository, input: process.stdin });
  const plan = await fake();
  await fake('--apply', plan.planHash);
  const checked = await execute(parseArguments(['release-item', 'check', '--as-of', '2026-01-01'], []), { root, frameworkRoot: repository, input: process.stdin });
  assert.deepEqual([checked.status, checked.notes, checked.errors, checked.warnings, checked.ignored], ['ok', 20, 0, 0, []]);
  const listed = await cli(root, 'list');
  assert.ok(new Set(listed.notes.map(item => item.status)).size >= 3, 'the demo covers several statuses');
  const ready = listed.notes.find(item => item.status === 'ready');
  const candidate = argv => execute(parseArguments(['candidate', ...argv, '--as-of', '2026-01-01'], []), { root, frameworkRoot: repository, input: process.stdin });
  await writeFile(join(root, 'c.json'), JSON.stringify({ items: [ready.id] }));
  const created = await candidate(['new', '--version', '0.1.0', '--input', 'c.json']);
  assert.deepEqual(created.moved.map(item => [item.id, item.status]), [[ready.id, 'included']]);
  assert.equal((await create(root)).id, 'ITEM-0021', 'generated ids are reserved');
}));
