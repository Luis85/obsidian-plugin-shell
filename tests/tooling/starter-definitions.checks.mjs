import { fileSymlink } from './file-symlink.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, symlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadDefinitions, parseDefinition } from '../../scripts/starters/repository.ts';
import { validateDefinition, readProcesses } from '../../scripts/starters/validation.ts';
import { resolveValues, renderFiles, renderProcesses } from '../../scripts/starters/render.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = JSON.parse(await readFile(join(root, 'configs/starters/webapp.json'), 'utf8'));
async function workspace(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'starter-definitions-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function seed(dir, definition = reference, name = definition.id) {
  await mkdir(join(dir, 'configs/starters'), { recursive: true });
  await writeFile(join(dir, 'configs/starters', name + '.json'), JSON.stringify(definition));
}
test('all twelve standalone definitions validate and carry their metadata, source and process contracts', async () => {
  const entries = await loadDefinitions(root); assert.equal(entries.length, 12);
  assert.deepEqual(entries.map(entry => entry.definition.id), entries.map(entry => entry.definition.id).sort());
  for (const { definition, file, sha256 } of entries) { assert.equal(file, `configs/starters/${definition.id}.json`); assert.match(sha256, /^[a-f\d]{64}$/); assert.ok(definition.processes.length); }
  const old = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/catalog.json')));
  for (const item of old.starters) assert.deepEqual(entries.find(entry => entry.definition.id === item.id).definition.generator.document,
    JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters', item.file))), item.id + ' loses no authored design');
});
test('missing and empty folders mean no installed starters, without creating anything', async t => {
  const dir = await workspace(t); assert.deepEqual(await loadDefinitions(dir), []); assert.deepEqual(await readdir(dir), []);
  await mkdir(join(dir, 'configs/starters'), { recursive: true }); assert.deepEqual(await loadDefinitions(dir), []);
});
test('adding, editing and removing just one JSON file changes discovery immediately', async t => {
  const dir = await workspace(t); await seed(dir);
  assert.equal((await loadDefinitions(dir))[0].definition.id, 'webapp');
  const edited = { ...reference, name: 'Edited' }; await seed(dir, edited);
  assert.equal((await loadDefinitions(dir))[0].definition.name, 'Edited');
  await rm(join(dir, 'configs/starters/webapp.json')); assert.deepEqual(await loadDefinitions(dir), []);
});
test('user-settings selects a contained starter folder without overriding other settings', async t => {
  const dir = await workspace(t); await seed(dir); await mkdir(join(dir, 'recipes'));
  const d = { ...reference, id: 'custom' }; await writeFile(join(dir, 'recipes/custom.json'), JSON.stringify(d));
  const text = JSON.stringify({ schemaVersion: 1, paths: { startersFolder: 'recipes', prds: 'docs/prds' }, preferences: { firstRun: 'skip' } });
  await writeFile(join(dir, 'configs/user-settings.json'), text);
  assert.deepEqual((await loadDefinitions(dir)).map(entry => entry.definition.id), ['custom']); assert.equal(await readFile(join(dir, 'configs/user-settings.json'), 'utf8'), text);
});
for (const folder of ['../outside', '/tmp', 'C:\\outside', '.obsidian', 'recipes/../starters', '.framework/starters']) test('rejects unsafe configured path ' + folder, async t => {
  const dir = await workspace(t); await seed(dir); await writeFile(join(dir, 'configs/user-settings.json'), JSON.stringify({ paths: { startersFolder: folder } }));
  await assert.rejects(loadDefinitions(dir), /contained relative folder/);
});
for (const [label, change] of [
  ['future version', d => { d.schemaVersion = 2; }], ['unknown field', d => { d.execute = true; }],
  ['unknown generator', d => { d.generator.kind = 'remote-code'; }], ['code module path', d => { d.generator.module = './evil.js'; }],
  ['duplicate input', d => { d.inputs.push(d.inputs[0]); }], ['missing identity input', d => { d.inputs.shift(); }],
  ['invalid default', d => { d.inputs[0].default = true; }], ['unknown choices', d => { d.inputs[0].choices = []; }],
  ['duplicate path', d => { d.files.push({ ...d.files[0] }); }], ['both content encodings', d => { d.files[0].content = 'bad'; }],
  ['no content', d => { delete d.files[0].json; }], ['escaping output', d => { d.files[0].path = '../outside.json'; }],
  ['absolute output', d => { d.files[0].path = '/outside.json'; }], ['protected output', d => { d.files[0].path = '.git/config'; }],
  ['Windows device', d => { d.files[0].path = 'CON.json'; }], ['case duplicate', d => { d.files.push({ path: 'PACKAGE.json', content: 'x' }); }],
  ['unknown runner', d => { d.processes[0].steps[0].runner = 'bash'; }], ['inline node eval', d => { d.processes[0].steps[0].script = '-e'; }],
  ['outside process cwd', d => { d.processes[0].steps[0].cwd = '..'; }], ['zero timeout', d => { d.processes[0].steps[0].timeout = 0; }],
  ['unknown dependency', d => { d.processes[0].dependsOn = ['missing']; }], ['cycle', d => { d.processes[0].dependsOn = [d.processes[0].id]; }],
  ['unknown first run', d => { d.firstRun = ['missing']; }], ['duplicate process', d => { d.processes.push(d.processes[0]); }],
]) test('rejects ' + label, () => { const d = structuredClone(reference); change(d); assert.throws(() => validateDefinition(d)); });
for (const args of [['publish'], ['install', '-g'], ['ci', '--prefix=../outside'], ['run', '--eval'], ['install', '--globalconfig=/tmp/x']]) test('npm primitive refuses ' + args.join(' '), () => {
  const d = structuredClone(reference); d.processes[0].steps = [{ runner: 'npm', args, cwd: '.', timeout: 1000 }]; assert.throws(() => validateDefinition(d));
});
test('future JSON and unsafe object keys fail before discovery exposes a usable recipe', async t => {
  const dir = await workspace(t); await seed(dir);
  for (const raw of ['{broken', '{"__proto__":{"polluted":true}}', JSON.stringify({ ...reference, schemaVersion: 99 })]) {
    await writeFile(join(dir, 'configs/starters/webapp.json'), raw); await assert.rejects(loadDefinitions(dir));
  }
  assert.equal({}.polluted, undefined);
});
test('file identity must match the ID and filenames must be lower-case regular JSON files', async t => {
  const dir = await workspace(t); await seed(dir, reference, 'different'); await assert.rejects(loadDefinitions(dir), /ID must match/);
  await rm(join(dir, 'configs/starters/different.json')); await seed(dir, reference, 'WebApp'); await assert.rejects(loadDefinitions(dir), /lower-case/);
});
test('valid local edits have a new content hash; hashes are not catalog signatures', async t => {
  const dir = await workspace(t); await seed(dir); const before = (await loadDefinitions(dir))[0].sha256;
  await writeFile(join(dir, 'configs/starters/webapp.json'), JSON.stringify({ ...reference, name: 'Changed' }, null, 2));
  assert.notEqual((await loadDefinitions(dir))[0].sha256, before);
});
test('file and ancestor symlinks are refused', async t => {
  const dir = await workspace(t); await seed(dir);
  await rm(join(dir, 'configs/starters/webapp.json'));
  if (!await fileSymlink(t, join(root, 'configs/starters/webapp.json'), join(dir, 'configs/starters/webapp.json'))) return; await assert.rejects(loadDefinitions(dir));
  await rm(join(dir, 'configs'), { recursive: true }); await symlink(join(root, 'configs'), join(dir, 'configs'), 'junction'); await assert.rejects(loadDefinitions(dir));
});
test('oversized files fail without parsing or execution', async t => {
  const dir = await workspace(t); await seed(dir); await writeFile(join(dir, 'configs/starters/webapp.json'), ' '.repeat(1_048_577)); await assert.rejects(loadDefinitions(dir), /bounded|limit/i);
});
test('rendering structured JSON escapes values while HTML escaping is explicit', () => {
  const d = validateDefinition(reference), values = resolveValues(d, { id: 'test-app', name: 'A "quoted" <App>', description: '<script>bad()</script>' });
  const files = renderFiles(d, values);
  assert.equal(JSON.parse(files.find(file => file.path === 'package.json').content).name, 'test-app');
  const html = files.find(file => file.path === 'index.html').content; assert.ok(html.includes('&lt;App&gt;')); assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>bad()'));
});
test('values reject undeclared/missing/wrongly typed inputs and unresolved template variables', () => {
  const d = validateDefinition(reference);
  for (const values of [{}, { id: 'x', name: 4 }, { id: 'x', name: 'X', hidden: true }]) assert.throws(() => resolveValues(d, values));
  d.files.push({ path: 'extra.txt', content: '{{missing}}' }); assert.throws(() => renderFiles(d, resolveValues(d, { id: 'app', name: 'App' })), /No value/);
});
test('substitution cannot bypass path containment or process-argument policy', () => {
  const d = validateDefinition(reference); d.files = [{ path: '{{id}}.txt', content: 'x' }];
  assert.throws(() => renderFiles(d, resolveValues(d, { id: '../outside', name: 'X' })), /Unsafe/);
  d.processes = [{ id: 'install', label: 'Install', description: 'test', dependsOn: [], steps: [{ runner: 'npm', args: ['install', '{{name}}'], cwd: '.', timeout: 1000 }] }];
  assert.throws(() => readProcesses(renderProcesses(d, { name: '--global' })), /overrides/);
});
