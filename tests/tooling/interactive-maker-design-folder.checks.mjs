import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { designFolderPlan, designFolderStatus } from '../../bin/adapters/design-folder.ts';
import { currentSourceHash } from '../../bin/adapters/design-source.ts';
import { offerDesignFolder } from '../../bin/presentation/design-folder.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { prototypesPlan } from '../../bin/adapters/framework/prototypes.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { sha256 } from '../../scripts/shared/hash.ts';
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const issueDesk = [
  { op: 'page.add', title: 'Issues', as: 'issues' }, { op: 'page.add', title: 'Details', as: 'details' },
  { op: 'component.add', title: 'Issue card', as: 'card' },
  { op: 'page.attach', page: '@issues', components: [{ id: '@card' }, { title: 'Filters' }] },
  { op: 'interaction.add', page: '@issues', title: 'Open issue', as: 'open' },
  { op: 'interaction.action', page: '@issues', id: '@open', action: { kind: 'navigate', target: '@details' } },
];
const generated = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'handoff/HANDOFF.md', 'context/brief.md', 'context/screens.md', 'context/components.md',
  'context/design-tokens.md', 'context/project.json', 'context/obsidian-tokens.json'];
const seeded = ['prototypes/README.md', 'assets/README.md', 'notes/decisions.md', 'handoff/implementation-map.md'];
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'design-folder-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root, path, content) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
const read = (root, path) => readFile(join(root, path), 'utf8');
async function saveProject(root, operations = issueDesk, path = 'design/project.json') {
  const document = runOperations(newDocument('Issue desk'), operations).document;
  await put(root, path, documentText(document));
  return document;
}
const plan = (root, options = {}) => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'prepare', ...options });
async function apply(root, options) { const value = await plan(root, options); await applyPrepared(value, value.planHash); return value; }
const folder = 'docs/design/issue-desk';
test('prepare plans the generated context, agent instructions and design areas, and writes only after approval', async () => scratch(async root => {
  const document = await saveProject(root);
  const first = await plan(root);
  assert.deepEqual(first.plan.changes.map(change => change.path).sort(), [...generated, ...seeded, 'design.manifest.json'].map(path => `${folder}/${path}`).sort());
  assert.ok(first.plan.changes.every(change => change.status === 'create'));
  assert.equal((await plan(root)).planHash, first.planHash);
  await assert.rejects(() => read(root, `${folder}/AGENTS.md`));
  assert.equal((await applyPrepared(first, first.planHash)).status, 'applied');
  const manifest = JSON.parse(await read(root, `${folder}/design.manifest.json`));
  assert.deepEqual(manifest.source, { kind: 'project', path: 'design/project.json', sha256: sha256(await read(root, 'design/project.json')) });
  assert.deepEqual(manifest.managed.map(file => file.path), generated);
  for (const file of manifest.managed) assert.equal(sha256(await read(root, `${folder}/${file.path}`)), file.sha256, file.path);
  assert.deepEqual([manifest.targets, manifest.framework, manifest.brief], [['plugin'], 'nuxtui', null]);
  const agents = await read(root, `${folder}/AGENTS.md`);
  assert.match(agents, /# Issue desk: design agent instructions/);
  assert.match(agents, /node bin\/app design sync --name issue-desk/);
  assert.match(agents, /docs\/design\/issue-desk\/handoff\/implementation-map\.md/);
  for (const name of [...generated, ...seeded].filter(path => path.endsWith('.md'))) assert.doesNotMatch(await read(root, `${folder}/${name}`), /\{\{/, name);
  assert.match(await read(root, `${folder}/CLAUDE.md`), /^@AGENTS\.md$/m);
  const screens = await read(root, `${folder}/context/screens.md`);
  assert.match(screens, /\| `node-1` \| Issues \| `\/issues` \| view \|/);
  assert.match(screens, /Open issue \(`vi-9`\): navigate to Details \(`node-2`\)/);
  assert.match(screens, /Components: Issue card \(`issue-card`\), Filters \(`filters`\)/);
  assert.match(await read(root, `${folder}/context/components.md`), /\| `issue-card` \| Issue card \| Data display \| default \| draft \| Issues \|/);
  assert.equal(await read(root, `${folder}/context/project.json`), documentText(document));
  assert.equal(await read(root, `${folder}/context/obsidian-tokens.json`), await read(frameworkRoot, 'docs/design/obsidian-tokens.json'));
  const tokens = await read(root, `${folder}/context/design-tokens.md`);
  assert.match(tokens, /`--background-primary`/);
  assert.match(tokens, /## Deprecated, do not use[\s\S]*`--interactive-accent-hsl`/);
  assert.match(await read(root, `${folder}/handoff/implementation-map.md`), /\| Details \| `node-2` \| todo \| — \| — \|/);
  const status = await designFolderStatus(root, frameworkRoot);
  assert.equal(status.root, 'docs/design');
  assert.deepEqual(status.folders.map(item => [item.name, item.state, item.edited, item.prototypes, item.implementation]), [['issue-desk', 'current', [], [], { todo: 2 }]]);
}));
test('sync follows the changed project and never touches the design work', async () => scratch(async root => {
  await saveProject(root);
  await apply(root);
  await put(root, `${folder}/prototypes/node-1--compact.html`, '<!doctype html><main data-design-id="node-1"></main>\n');
  await put(root, `${folder}/notes/decisions.md`, '# Decisions\n\nCompact list.\n');
  const map = (await read(root, `${folder}/handoff/implementation-map.md`)).replace('| Issues | `node-1` | todo | — |', '| Issues | `node-1` | ready | prototypes/node-1--compact.html |');
  await put(root, `${folder}/handoff/implementation-map.md`, map);
  await saveProject(root, [...issueDesk, { op: 'page.add', title: 'Settings' }]);
  assert.equal((await designFolderStatus(root, frameworkRoot, 'issue-desk')).folders[0].state, 'stale');
  const sync = await designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' });
  const changed = sync.plan.changes.filter(change => change.status !== 'unchanged').map(change => change.path.slice(folder.length + 1)).sort();
  assert.deepEqual(changed, ['context/brief.md', 'context/project.json', 'context/screens.md', 'design.manifest.json']);
  assert.ok(sync.plan.changes.every(change => !change.path.includes('/prototypes/') && !change.path.includes('/notes/') && !change.path.endsWith('implementation-map.md')));
  await applyPrepared(sync, sync.planHash);
  assert.match(await read(root, `${folder}/context/screens.md`), /## Settings \(`node-\d+`\)/);
  assert.equal(await read(root, `${folder}/handoff/implementation-map.md`), map);
  assert.equal(await read(root, `${folder}/notes/decisions.md`), '# Decisions\n\nCompact list.\n');
  const status = (await designFolderStatus(root, frameworkRoot)).folders[0];
  assert.deepEqual([status.state, status.prototypes, status.implementation], ['current', ['prototypes/node-1--compact.html'], { ready: 1, todo: 1 }]);
  const again = await designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' });
  assert.ok(again.plan.changes.every(change => change.status === 'unchanged'));
  assert.equal((await applyPrepared(again, again.planHash)).status, 'unchanged');
}));
test('hand edits and foreign files at generated paths block the plan; nothing is overwritten', async () => scratch(async root => {
  await saveProject(root);
  await apply(root);
  const edited = (await read(root, `${folder}/context/screens.md`)) + '\nDesigner note.\n';
  await put(root, `${folder}/context/screens.md`, edited);
  await saveProject(root, [...issueDesk, { op: 'page.add', title: 'Settings' }]);
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' }), error => error.code === 'DESIGN_FILE_CONFLICT' && /context\/screens\.md/.test(error.message));
  assert.equal(await read(root, `${folder}/context/screens.md`), edited);
  await unlink(join(root, `${folder}/context/screens.md`));
  const regenerated = await designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' });
  assert.equal(regenerated.plan.changes.find(change => change.path.endsWith('context/screens.md')).status, 'create');
  const other = 'docs/design/other';
  await put(root, `${other}/prototypes/early.html`, '<!doctype html>\n');
  const adopted = await designFolderPlan({ root, frameworkRoot, name: 'other', mode: 'prepare' });
  assert.ok(!adopted.plan.changes.some(change => change.path.endsWith('prototypes/early.html')));
  assert.ok(adopted.plan.changes.some(change => change.path === `${other}/prototypes/README.md`));
  await put(root, `${other}/README.md`, '# Someone else\n');
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'other', mode: 'prepare' }), { code: 'DESIGN_FILE_CONFLICT' });
  assert.deepEqual((await designFolderStatus(root, frameworkRoot)).folders.map(item => [item.name, item.state]), [['issue-desk', 'stale'], ['other', 'unmanaged']]);
}));
test('names, missing folders, manifests and changed sources fail closed', async () => scratch(async root => {
  for (const name of ['../escape', 'Issue', 'a--b', 'prototype', 'x-', '', '1abc', 'a/b']) {
    await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name, mode: 'prepare' }), { code: 'DESIGN_NAME' }, name);
  }
  await assert.rejects(() => plan(root), { code: 'DESIGN_SOURCE_MISSING' });
  await saveProject(root);
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' }), { code: 'DESIGN_FOLDER_MISSING' });
  await assert.rejects(() => plan(root, { package: 'prototypes/none' }), { code: 'DESIGN_BRIEF_MISSING' });
  const reviewed = await plan(root);
  await saveProject(root, [...issueDesk, { op: 'page.add', title: 'Settings' }]);
  await assert.rejects(() => applyPrepared(reviewed, reviewed.planHash), { code: 'MAKER_STALE' });
  await assert.rejects(() => read(root, `${folder}/AGENTS.md`));
  await apply(root);
  const path = `${folder}/design.manifest.json`, manifest = JSON.parse(await read(root, path));
  await put(root, path, JSON.stringify({ ...manifest, managed: [...manifest.managed, { path: 'prototypes/x.html', sha256: 'a'.repeat(64) }] }));
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' }), { code: 'DESIGN_MANIFEST' });
  await put(root, path, JSON.stringify({ ...manifest, kind: 'other' }));
  await assert.rejects(() => designFolderStatus(root, frameworkRoot), { code: 'DESIGN_MANIFEST' });
  await put(root, path, JSON.stringify({ ...manifest, name: 'other' }));
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' }), { code: 'DESIGN_MANIFEST' });
}));
test('the design root is configurable, overlap-checked and moved by the reviewed settings migration', async () => scratch(async root => {
  await saveProject(root);
  await put(root, 'configs/user-settings.json', JSON.stringify({ schemaVersion: 1, paths: { prds: 'docs/design' } }));
  await assert.rejects(() => plan(root), { code: 'DESIGN_ROOT_OVERLAP' });
  await put(root, 'configs/user-settings.json', JSON.stringify({ schemaVersion: 1, paths: { design: 'docs/prds/designs' } }));
  await assert.rejects(() => plan(root), { code: 'SETTINGS_OVERLAP' });
  await rm(join(root, 'configs'), { recursive: true });
  await apply(root);
  const migration = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { design: 'handoff/design' } });
  assert.deepEqual(migration.data.moves.map(move => [move.key, move.from, move.to]), [['design', 'docs/design', 'handoff/design']]);
  await applyPrepared(migration, migration.planHash);
  const status = await designFolderStatus(root, frameworkRoot);
  assert.deepEqual([status.root, status.folders.map(item => [item.folder, item.state])], ['handoff/design', [['handoff/design/issue-desk', 'stale']]]);
  const sync = await designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' });
  assert.deepEqual(sync.plan.changes.filter(change => change.status !== 'unchanged').map(change => change.path), ['handoff/design/issue-desk/README.md', 'handoff/design/issue-desk/AGENTS.md', 'handoff/design/issue-desk/design.manifest.json']);
  await applyPrepared(sync, sync.planHash);
  assert.match(await read(root, 'handoff/design/issue-desk/AGENTS.md'), /`handoff\/design\/issue-desk\/handoff\/implementation-map\.md`/);
  assert.equal((await designFolderStatus(root, frameworkRoot)).folders[0].state, 'current');
}));
test('a managed prototype is the source of its own design folder, following its active variant', async () => scratch(async root => {
  const document = await saveProject(root, issueDesk, 'project.json');
  const created = await prototypesPlan({ command: 'prototypes create', args: ['alpha'], options: { input: 'project.json', name: 'Alpha concept' } }, { root, frameworkRoot });
  await applyFilePlan(created.plan);
  const prepared = await designFolderPlan({ root, frameworkRoot, name: 'alpha', mode: 'prepare' });
  const { source, title } = prepared.data;
  assert.equal(source.kind, 'prototype-variant');
  assert.equal(source.selection.prototypeId, 'alpha');
  assert.equal(source.path, `docs/concepts/alpha/versions/${source.selection.versionId}/variants/${source.selection.variantId}/project.json`);
  assert.equal(source.sha256, sha256(await read(root, source.path)));
  assert.equal(title, 'Alpha concept');
  await applyPrepared(prepared, prepared.planHash);
  assert.equal(await read(root, 'docs/design/alpha/context/project.json'), documentText(document));
  assert.equal((await designFolderStatus(root, frameworkRoot, 'alpha')).folders[0].state, 'current');
  const explicit = await designFolderPlan({ root, frameworkRoot, name: 'alpha', mode: 'sync', project: 'project.json' });
  assert.deepEqual(explicit.data.source, { kind: 'project', path: 'project.json', sha256: sha256(await read(root, 'project.json')) });
}));
const prototypeStep = async (root, command, args, options) => applyFilePlan((await prototypesPlan({ command: `prototypes ${command}`, args, options }, { root, frameworkRoot })).plan);
test('a 48-character prototype slug with long version and variant ids round-trips through prepare, status and sync', async () => scratch(async root => {
  await saveProject(root, issueDesk, 'project.json');
  const id = 'p'.repeat(48), version = 'v'.repeat(48), variant = 'w'.repeat(48);
  await prototypeStep(root, 'create', [id], { input: 'project.json', name: 'Long concept' });
  await prototypeStep(root, 'version', [id], { version, from: 'v1' });
  await prototypeStep(root, 'fork', [id], { version, variant: 'main', as: variant });
  await prototypeStep(root, 'status', [id], { version, variant: 'main', status: 'archived' });
  const prepared = await designFolderPlan({ root, frameworkRoot, name: id, mode: 'prepare' });
  assert.deepEqual(prepared.data.source.selection, { prototypeId: id, versionId: version, variantId: variant });
  await applyPrepared(prepared, prepared.planHash);
  assert.deepEqual((await designFolderStatus(root, frameworkRoot)).folders.map(item => [item.name, item.state]), [[id, 'current']]);
  const sync = await designFolderPlan({ root, frameworkRoot, name: id, mode: 'sync' });
  assert.ok(sync.plan.changes.every(change => change.status === 'unchanged'));
}));
test('the offered folder name always satisfies the folder-name rule, even for a long title that starts with a digit', async () => scratch(async root => {
  await saveProject(root);
  const ui = scriptedAnswers(['y', 'y']);
  const completion = await offerDesignFolder(ui, { root, frameworkRoot, title: '2026 quarterly planning board for the whole product team', project: 'design/project.json' });
  ui.done();
  assert.match(completion ?? ui.transcript.join(''), /Design folder ready: docs\/design\/prototype-2026-quarterly-planning-board-for-the\./);
}));
test('an offered brief outside the root is read bounded and as strict UTF-8; invalid bytes write nothing', async () => scratch(async root => {
  await saveProject(root);
  await writeFile(join(root, 'outside-brief.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
  const ui = scriptedAnswers(['y']);
  assert.equal(await offerDesignFolder(ui, { root, frameworkRoot, title: 'Issue desk', briefFrom: join(root, 'outside-brief.md') }), undefined);
  ui.done();
  assert.match(ui.transcript.join(''), /encoded data was not valid/i);
  await assert.rejects(() => read(root, `${folder}/design.manifest.json`));
}));
test('a missing brief keeps its reference: status reports it and sync fails closed instead of dropping the link', async () => scratch(async root => {
  await saveProject(root);
  await put(root, 'prepared/design-brief.md', '# Brief\n\n## Problem\n\nSlow triage.\n');
  await apply(root, { package: 'prepared' });
  const path = `${folder}/design.manifest.json`, before = await read(root, path);
  await unlink(join(root, 'prepared/design-brief.md'));
  const status = (await designFolderStatus(root, frameworkRoot)).folders[0];
  assert.deepEqual([status.state, status.brief], ['current', { scope: 'root', path: 'prepared/design-brief.md', missing: true }]);
  await assert.rejects(() => designFolderPlan({ root, frameworkRoot, name: 'issue-desk', mode: 'sync' }), { code: 'DESIGN_BRIEF_MISSING' });
  assert.equal(await read(root, path), before);
}));
test('a failure other than an absent source is reported, never relabelled as source-missing or stale', async () => scratch(async root => {
  await saveProject(root, issueDesk, 'project.json');
  await prototypeStep(root, 'create', ['alpha'], { input: 'project.json', name: 'Alpha' });
  const controller = new AbortController(); controller.abort();
  const request = { root, frameworkRoot, name: 'alpha', configuredProject: 'design/project.json', previous: null };
  assert.equal((await currentSourceHash(request)).path.startsWith('docs/concepts/alpha/'), true);
  await assert.rejects(() => currentSourceHash({ ...request, signal: controller.signal }), { code: 'CANCELLED' });
  await saveProject(root);
  await apply(root);
  await put(root, 'design/project.json', '{"kind": broken');
  await assert.rejects(() => designFolderStatus(root, frameworkRoot, 'issue-desk'), error => error.code !== 'DESIGN_SOURCE_MISSING');
  await rm(join(root, 'design/project.json'));
  assert.equal((await designFolderStatus(root, frameworkRoot, 'issue-desk')).folders[0].state, 'source-missing');
}));
test('implementation-map rows whose screen title holds an escaped pipe are counted', async () => scratch(async root => {
  await saveProject(root, [...issueDesk, { op: 'page.add', title: 'Inbox | Archive' }]);
  await apply(root);
  assert.match(await read(root, `${folder}/handoff/implementation-map.md`), /\| Inbox \\\| Archive \| `node-\d+` \| todo \|/);
  assert.deepEqual((await designFolderStatus(root, frameworkRoot)).folders[0].implementation, { todo: 3 });
}));
function scriptedAnswers(answers) {
  let cursor = 0; const transcript = [];
  return { transcript, ask: async prompt => { assert.ok(cursor < answers.length, `Missing answer for ${prompt}`); transcript.push(prompt); return answers[cursor++]; },
    write: line => transcript.push(line), done: () => assert.equal(cursor, answers.length) };
}
