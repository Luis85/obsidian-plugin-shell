import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { parseCollectionNote } from '../../bin/adapters/collection-notes.ts';
import { settingsPlan } from '../../bin/adapters/user-settings.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { effectivePaths, defaultSettings, readSettings } from '../../bin/domain/user-settings.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'candidates-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** The real maker parser and dispatcher, exactly as `node bin/app <root> …` routes them. */
const run = (root, argv, asOf = '2026-10-04') => execute(parseArguments([...argv, '--as-of', asOf], []), { root, frameworkRoot: repository, input: process.stdin });
const candidate = (root, ...argv) => run(root, ['candidate', ...argv]);
async function json(root, name, value) { await writeFile(join(root, name), JSON.stringify(value)); return name; }
/** Plan, then apply with the reviewed hash. */
async function applied(root, argv, asOf) {
  const plan = await run(root, argv, asOf);
  assert.equal(plan.status, 'planned', argv.join(' '));
  return run(root, [...argv, '--apply', plan.planHash], asOf);
}
const read = (root, path) => readFile(join(root, path), 'utf8');
const readme = '1.0.0/README.md', folder = 'docs/releases/candidates', notes = 'docs/releases/items';
const base = { summary: 'Users notice it.', kind: 'feature', status: 'ready', acceptance: ['It works'], sources: ['prototypes/checkout'] };
async function increment(root, title, extra = {}) {
  return applied(root, ['release-item', 'new', '--input', await json(root, 'release-item.json', { ...base, title, ...extra })]);
}
async function seed(root) {
  await increment(root, 'Checkout redesign', { risks: ['RISK-0001'], priority: 'high' });
  await increment(root, 'Fix rounding', { kind: 'fix', sources: ['brainstorms/rounding/feature.definition.json', 'LRN-0001'] });
  await increment(root, 'Proposal only', { status: 'proposed', acceptance: [] });
}
const property = async (root, path, key) => parseCollectionNote(await read(root, path)).properties[key];

test('candidate is a maker command root with help, version validation and reviewed writes only', async () => {
  assert.equal(routeArguments(['candidate', 'list']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'candidate']).args, ['candidate', '--help']);
  const help = await execute(parseArguments(['candidate', '--help'], []), { root: repository, frameworkRoot: repository, input: process.stdin });
  assert.match(help.help, /node bin\/app candidate status --version 1\.0\.0 --to <draft\|frozen\|qualified\|released\|abandoned> --json/);
  assert.ok(help.commands.includes('candidate') && help.commands.includes('release-item'));
  await scratch(async root => {
    await assert.rejects(() => candidate(root, 'new', '--version', '1.0'), /x\.y\.z or x\.y\.z-rc\.N/);
    await assert.rejects(() => candidate(root, 'new'), /candidate new --version/);
    await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0'), /candidate add --version <x\.y\.z> --item ITEM-0001/);
    await assert.rejects(() => candidate(root, 'publish'), /Use candidate list\|show\|check\|new\|add\|remove\|status\|docs/);
    await assert.rejects(() => candidate(root, 'show', '--version', '9.9.9'), /No release candidate 9\.9\.9/);
    const plan = await candidate(root, 'new', '--version', '1.0.0');
    assert.deepEqual([plan.status, plan.path, plan.candidateStatus], ['planned', `${folder}/${readme}`, 'draft']);
    await assert.rejects(() => readdir(join(root, 'docs')), /ENOENT/, 'planning writes nothing');
    await assert.rejects(() => candidate(root, 'new', '--version', '1.0.0', '--apply', 'f'.repeat(64)), /plan changed/);
    assert.deepEqual((await candidate(root, 'list')).candidates, []);
  });
});

test('new includes chosen ready release items in the same plan; add and remove move one release item note atomically', async () => scratch(async root => {
  await seed(root);
  await assert.rejects(async () => candidate(root, 'new', '--version', '1.0.0', '--input', await json(root, 'c.json', { items: ['ITEM-0003'] })), /ITEM-0003 is proposed; only ready release items/);
  await assert.rejects(async () => candidate(root, 'new', '--version', '1.0.0', '--input', await json(root, 'c.json', { version: '1.1.0' })), /--version 1\.0\.0 and the input version 1\.1\.0 differ/);
  const input = await json(root, 'c.json', { targetDate: '2026-11-01', owner: 'Alex', items: ['ITEM-0001'], goal: 'Ship the faster checkout.' });
  const plan = await candidate(root, 'new', '--version', '1.0.0', '--input', input);
  assert.deepEqual(plan.changes.map(item => [item.path, item.status]), [[`${folder}/${readme}`, 'create'], [`${notes}/ITEM-0001-checkout-redesign.md`, 'update']]);
  assert.deepEqual(plan.moved, [{ id: 'ITEM-0001', path: `${notes}/ITEM-0001-checkout-redesign.md`, status: 'included' }]);
  await candidate(root, 'new', '--version', '1.0.0', '--input', input, '--apply', plan.planHash);
  assert.deepEqual([await property(root, `${notes}/ITEM-0001-checkout-redesign.md`, 'status'), await property(root, `${notes}/ITEM-0001-checkout-redesign.md`, 'candidate')], ['included', '1.0.0']);
  await assert.rejects(() => candidate(root, 'new', '--version', '1.0.0'), /Release candidate 1\.0\.0 already exists/);
  // Add: README and the release item note in one plan; a stale release item note refuses the whole plan.
  const before = await read(root, `${notes}/ITEM-0002-fix-rounding.md`);
  const add = await candidate(root, 'add', '--version', '1.0.0', '--item', 'item-0002');
  assert.deepEqual(add.changes.map(item => item.path), [`${folder}/${readme}`, `${notes}/ITEM-0002-fix-rounding.md`]);
  await writeFile(join(root, `${notes}/ITEM-0002-fix-rounding.md`), before + 'Edited meanwhile.\n');
  await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0', '--item', 'item-0002', '--apply', add.planHash), /plan changed|changed after review|PLAN_STALE/);
  assert.deepEqual((await property(root, `${folder}/${readme}`, 'items')), ['ITEM-0001'], 'a refused plan writes neither file');
  await applied(root, ['candidate', 'add', '--version', '1.0.0', '--item', 'ITEM-0002']);
  const note = await read(root, `${notes}/ITEM-0002-fix-rounding.md`);
  assert.ok(note.endsWith('Edited meanwhile.\n') && note.includes('status: "included"') && note.includes('candidate: "1.0.0"'), 'body bytes are kept');
  assert.deepEqual(await property(root, `${folder}/${readme}`, 'items'), ['ITEM-0001', 'ITEM-0002']);
  await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0', '--item', 'ITEM-0002'), /ITEM-0002 is already in 1\.0\.0/);
  await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0', '--item', 'ITEM-0404'), /No release item note with id ITEM-0404/);
  await assert.rejects(async () => run(root, ['release-item', 'update', '--id', 'ITEM-0002', '--input', await json(root, 'u.json', { status: 'ready' })]), /included → ready is not allowed/);
  // Remove returns the release item to ready without a candidate, again in one plan.
  const removed = await applied(root, ['candidate', 'remove', '--version', '1.0.0', '--item', 'ITEM-0002']);
  assert.deepEqual(removed.changes.map(item => item.status), ['update', 'update']);
  assert.deepEqual([await property(root, `${notes}/ITEM-0002-fix-rounding.md`, 'status'), await property(root, `${notes}/ITEM-0002-fix-rounding.md`, 'candidate')], ['ready', undefined]);
  await assert.rejects(() => candidate(root, 'remove', '--version', '1.0.0', '--item', 'ITEM-0002'), /ITEM-0002 is not in 1\.0\.0; it lists ITEM-0001/);
  assert.equal((await candidate(root, 'check')).status, 'ok');
}));

test('status transitions freeze the release item list, ship release items on release and return them when abandoned', async () => scratch(async root => {
  await seed(root);
  await applied(root, ['candidate', 'new', '--version', '1.0.0', '--input', await json(root, 'c.json', { items: ['ITEM-0001', 'ITEM-0002'] })]);
  await assert.rejects(() => candidate(root, 'status', '--version', '1.0.0', '--to', 'released'), /draft → released is not allowed/);
  const frozen = await applied(root, ['candidate', 'status', '--version', '1.0.0', '--to', 'frozen'], '2026-10-05');
  assert.deepEqual(frozen.changes.map(item => item.path), [`${folder}/${readme}`], 'freezing changes only the README');
  assert.deepEqual([await property(root, `${folder}/${readme}`, 'status'), await property(root, `${folder}/${readme}`, 'frozen')], ['frozen', '2026-10-05']);
  await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0', '--item', 'ITEM-0003'), /1\.0\.0 is frozen; only a draft candidate changes its release items/);
  await assert.rejects(() => candidate(root, 'remove', '--version', '1.0.0', '--item', 'ITEM-0001'), /is frozen/);
  // An inconsistent release item blocks qualification until it is fixed.
  const path = `${notes}/ITEM-0002-fix-rounding.md`, good = await read(root, path);
  await writeFile(join(root, path), good.replace('candidate: "1.0.0"', 'candidate: "2.0.0"'));
  await assert.rejects(() => candidate(root, 'status', '--version', '1.0.0', '--to', 'qualified'), /cannot become qualified while candidate check reports errors: ITEM-0002 is included in 2\.0\.0/);
  await writeFile(join(root, path), good);
  await applied(root, ['candidate', 'status', '--version', '1.0.0', '--to', 'qualified'], '2026-10-06');
  const released = await applied(root, ['candidate', 'status', '--version', '1.0.0', '--to', 'released'], '2026-10-07');
  assert.equal(released.changes.length, 3, 'the README and both release item notes change in one plan');
  assert.deepEqual([await property(root, path, 'status'), await property(root, path, 'shipped'), await property(root, path, 'candidate')], ['shipped', '2026-10-07', '1.0.0']);
  const record = await read(root, `${folder}/${readme}`);
  assert.ok(record.includes('released: "2026-10-07"') && record.includes('- [x] Released:') && record.includes('## [1.0.0] - 2026-10-07'));
  await assert.rejects(() => candidate(root, 'docs', '--version', '1.0.0'), /1\.0\.0 is released; its documents are a record/);
  await assert.rejects(() => candidate(root, 'status', '--version', '1.0.0', '--to', 'draft'), /released → draft is not allowed/);
  // Abandoning another candidate returns its release items to ready.
  await applied(root, ['release-item', 'update', '--id', 'ITEM-0003', '--input', await json(root, 'u.json', { status: 'ready', acceptance: ['Agreed'] })]);
  await applied(root, ['candidate', 'new', '--version', '1.1.0-rc.1', '--input', await json(root, 'c.json', { items: ['ITEM-0003'] })]);
  await applied(root, ['candidate', 'status', '--version', '1.1.0-rc.1', '--to', 'abandoned']);
  assert.deepEqual([await property(root, `${notes}/ITEM-0003-proposal-only.md`, 'status'), await property(root, `${notes}/ITEM-0003-proposal-only.md`, 'candidate')], ['ready', undefined]);
  const listed = await candidate(root, 'list');
  assert.deepEqual(listed.candidates.map(item => [item.version, item.status]), [['1.0.0', 'released'], ['1.1.0-rc.1', 'abandoned']]);
  assert.equal((await candidate(root, 'check')).errors, 0);
}));

test('docs regeneration keeps authored sections and frontmatter, refuses edited generated blocks and follows release item edits', async () => scratch(async root => {
  await seed(root);
  await applied(root, ['candidate', 'new', '--version', '1.0.0', '--input', await json(root, 'c.json', { items: ['ITEM-0001'], goal: 'Faster checkout.' })]);
  const path = `${folder}/${readme}`, original = await read(root, path);
  assert.ok(original.includes('## Goal\n\nFaster checkout.\n') && original.includes('<!-- candidate-checklist:start sha256='));
  const authored = original.replace('schema_version: 1\n', 'schema_version: 1\naliases: [launch]  # kept\n').replace('## Notes\n', '## Notes\n\nDecided in the 2026-10-03 review.\n') + '\n## Appendix\n\nKept.\n';
  await writeFile(join(root, path), authored);
  assert.ok((await candidate(root, 'docs', '--version', '1.0.0')).changes.every(item => item.status === 'unchanged'), 'nothing changed, nothing to write');
  await applied(root, ['release-item', 'update', '--id', 'ITEM-0001', '--input', await json(root, 'u.json', { summary: 'Two steps instead of five.' })]);
  await applied(root, ['candidate', 'docs', '--version', '1.0.0']);
  const regenerated = await read(root, path);
  assert.ok(regenerated.includes('| Two steps instead of five. |') && regenerated.includes('Decided in the 2026-10-03 review.') && regenerated.endsWith('\n## Appendix\n\nKept.\n'));
  assert.match(regenerated, /aliases: \[ launch \] # kept|aliases: \[launch\] {2}# kept/);
  await writeFile(join(root, path), regenerated.replace('| Two steps instead of five. |', '| Hand edit |'));
  await assert.rejects(() => candidate(root, 'docs', '--version', '1.0.0'), /The generated candidate-items block was edited by hand/);
  await assert.rejects(() => candidate(root, 'add', '--version', '1.0.0', '--item', 'ITEM-0002'), /edited by hand/);
  const checked = await candidate(root, 'check');
  assert.deepEqual([checked.status, checked.issues.map(item => `${item.severity}:${item.code}`)], ['failed', ['error:CANDIDATE_DOCS_EDITED', 'warning:CANDIDATE_RISK_MISSING']],
    'ITEM-0001 links RISK-0001, which has no risk note');
  await writeFile(join(root, path), regenerated);
  assert.equal((await candidate(root, 'show', '--version', '1.0.0')).items[0].summary, 'Two steps instead of five.');
}));

test('check reports broken links in both directions, folder mismatches and unreadable candidates without changing files', async () => scratch(async root => {
  await seed(root);
  await applied(root, ['candidate', 'new', '--version', '1.0.0', '--input', await json(root, 'c.json', { items: ['ITEM-0001'] })]);
  const path = `${folder}/${readme}`, good = await read(root, path);
  await writeFile(join(root, path), good.replace('  - "ITEM-0001"\n', '  - "ITEM-0001"\n  - "ITEM-0042"\n'));
  await mkdir(join(root, folder, '2.0'), { recursive: true });
  await writeFile(join(root, folder, '2.0/README.md'), good.replace('version: "1.0.0"', 'version: "2.0.0"').replace(/items:\n(?: {2}- .*\n)+|items: \[.*\]\n/, 'items: []\n'));
  await mkdir(join(root, folder, '3.0.0'), { recursive: true });
  await writeFile(join(root, folder, '3.0.0/README.md'), '---\ntype: ReleaseCandidate\nversion: [\n---\n');
  await writeFile(join(root, folder, 'index.md'), '# Candidates\n');
  await writeFile(join(root, folder, '1.0.0/notes.md'), '# Notes\n');
  const note = `${notes}/ITEM-0002-fix-rounding.md`;
  await writeFile(join(root, note), (await read(root, note)).replace('status: "ready"', 'status: "included"'));
  const before = await Promise.all([path, `${folder}/2.0/README.md`, note].map(item => read(root, item)));
  const checked = await candidate(root, 'check');
  assert.equal(checked.status, 'failed');
  assert.deepEqual(checked.issues.filter(item => item.severity === 'error').map(item => item.code).sort(),
    ['CANDIDATE_FOLDER', 'CANDIDATE_INCREMENT_MISSING', 'CANDIDATE_INCREMENT_ORPHAN', 'CANDIDATE_UNREADABLE']);
  assert.deepEqual(checked.ignored.sort(), [`${folder}/1.0.0/notes.md`, `${folder}/index.md`]);
  assert.deepEqual(await Promise.all([path, `${folder}/2.0/README.md`, note].map(item => read(root, item))), before, 'check never writes');
  const shown = await candidate(root, 'show', '--version', '1.0.0');
  assert.deepEqual([shown.missing, shown.findings.map(item => item.code)], [['ITEM-0042'], ['CANDIDATE_INCREMENT_MISSING', 'CANDIDATE_RISK_MISSING']]);
  await assert.rejects(() => candidate(root, 'status', '--version', '1.0.0', '--to', 'frozen'), /cannot become frozen while candidate check reports errors: ITEM-0042 is listed/);
  const removed = await applied(root, ['candidate', 'remove', '--version', '1.0.0', '--item', 'ITEM-0042']);
  assert.deepEqual(removed.changes.map(item => item.path), [path], 'a missing release item is removed from the README only');
  await assert.rejects(() => candidate(root, 'show', '--version', '3.0.0'), /cannot be changed until it is valid|not found|No release candidate/);
  assert.equal((await candidate(root, 'list')).needsAttention.length, 1);
}));

test('paths.releaseCandidates and paths.releaseItems are optional validated settings paths every command follows', async () => scratch(async root => {
  assert.deepEqual([effectivePaths(defaultSettings.paths).releaseCandidates, effectivePaths(defaultSettings.paths).releaseItems], ['docs/releases/candidates', 'docs/releases/items']);
  assert.equal(defaultSettings.paths.releaseCandidates, undefined);
  for (const releaseCandidates of ['docs/releases/items/rc', '../rc', '.git/rc', 'docs/risks'])
    assert.throws(() => readSettings({ schemaVersion: 1, paths: { releaseCandidates } }), /SETTINGS|overlap|path|protected/i, releaseCandidates);
  await mkdir(join(root, 'configs'), { recursive: true });
  const settings = await settingsPlan(root, { schemaVersion: 1, paths: { releaseCandidates: 'release/candidates', releaseItems: 'release/items' } });
  await applyPrepared(settings, settings.planHash);
  await increment(root, 'Checkout redesign');
  const created = await applied(root, ['candidate', 'new', '--version', '0.1.0', '--input', await json(root, 'c.json', { items: ['ITEM-0001'] })]);
  assert.deepEqual(created.changes.map(item => item.path), ['release/candidates/0.1.0/README.md', 'release/items/ITEM-0001-checkout-redesign.md']);
  assert.match(await read(root, 'release/candidates/0.1.0/README.md'), /\[ITEM-0001\]\(<\.\.\/\.\.\/items\/ITEM-0001-checkout-redesign\.md>\)/);
}));
