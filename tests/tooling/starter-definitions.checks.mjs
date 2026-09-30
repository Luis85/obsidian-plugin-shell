import { fileSymlink } from './file-symlink.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, symlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { STARTER_MAX_BYTES } from '../../scripts/starters/browser.ts';
import { loadDefinitions, parseDefinition } from '../../scripts/starters/repository.ts';
import { validateDefinition, readProcesses } from '../../scripts/starters/validation.ts';
import { resolveValues, renderFiles, renderProcesses } from '../../scripts/starters/render.ts';
import { angularPackages } from '../../scripts/compiler/domain/project-starter.ts';
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
test('all twenty-five standalone definitions validate and carry their metadata, source and process contracts', async () => {
  const entries = await loadDefinitions(root); assert.equal(entries.length, 25);
  assert.deepEqual(entries.map(entry => entry.definition.id), entries.map(entry => entry.definition.id).sort());
  assert.equal(entries.filter(entry => entry.definition.generator.kind === 'project').length, 11, 'eight former presets, two hybrid frameworks and the Angular setup');
  for (const { definition, file, sha256 } of entries) {
    assert.equal(file, `configs/starters/${definition.id}.json`); assert.match(sha256, /^[a-f\d]{64}$/);
    // Project starters hand their process work to the generated package scripts after the prototype interview.
    if (definition.generator.kind === 'project') assert.deepEqual([definition.inputs, definition.files, definition.processes, definition.firstRun], [[], [], [], []]);
    else assert.ok(definition.processes.length);
  }
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
const project = JSON.parse(await readFile(join(root, 'configs/starters/plugin-angular.json'), 'utf8'));
test('project generator kind is strict data: no identity inputs, payloads or processes, and compatible targets', () => {
  assert.equal(validateDefinition(structuredClone(project)).generator.framework, 'angular');
  const valid = structuredClone(project); valid.generator = { kind: 'project', projectType: 'hybrid', framework: 'vanilla', targets: ['webapp', 'cli'] };
  assert.deepEqual(validateDefinition(valid).generator.targets, ['webapp', 'cli']);
  const custom = structuredClone(project); custom.generator = { kind: 'project', projectType: 'webapp', framework: 'react', targets: ['webapp'] };
  assert.equal(validateDefinition(custom).generator.framework, 'react', 'custom framework IDs are data; adapter availability is checked when the starter is selected');
  for (const [label, change] of [
    ['identity inputs', d => { d.inputs = structuredClone(reference.inputs); }], ['file payloads', d => { d.files = [{ path: 'extra.txt', content: 'x' }]; }],
    ['processes', d => { d.processes = structuredClone(reference.processes); }], ['first run', d => { d.processes = structuredClone(reference.processes); d.firstRun = [reference.processes[0].id]; }],
    ['unknown generator field', d => { d.generator.document = {}; }], ['module path', d => { d.generator.module = './evil.js'; }],
    ['invalid framework id', d => { d.generator.framework = 'React UI'; }], ['unknown target', d => { d.generator.targets = ['desktop']; }],
    ['mismatched target', d => { d.generator.targets = ['webapp']; }], ['single hybrid target', d => { d.generator.projectType = 'hybrid'; }],
    ['missing Angular pins', d => { delete d.generator.angularPins; }], ['floating Angular pin', d => { d.generator.angularPins.rxjs = '^7.8.2'; }],
    ['pins without Angular', d => { d.generator.framework = 'vanilla'; }], ['CLI with a frontend', d => { d.generator = { kind: 'project', projectType: 'cli', framework: 'vanilla', targets: ['cli'] }; }],
  ]) {
    const d = structuredClone(project); change(d);
    assert.throws(() => validateDefinition(d), error => error.code === 'STARTER_INVALID', label);
  }
});
test('the editor schema declares the same project generator vocabulary as the runtime validator', async () => {
  const schema = JSON.parse(await readFile(join(root, 'scripts/starters/starter.schema.json'), 'utf8'));
  const variant = schema.properties.generator.oneOf.find(item => item.properties.kind.const === 'project');
  assert.equal(variant.additionalProperties, false); assert.deepEqual(variant.required, ['kind', 'projectType', 'framework', 'targets']);
  assert.deepEqual(variant.properties.framework, { type: 'string', maxLength: 64, pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*
  assert.deepEqual(variant.properties.targets.items.enum, ['plugin', 'webapp', 'website', 'cli']);
  assert.deepEqual(schema.$defs.angularPins.required, angularPackages); assert.equal(schema.$defs.angularPins.additionalProperties, false);
  assert.deepEqual(schema.allOf[0].then.properties, { inputs: { maxItems: 0 }, files: { maxItems: 0 }, processes: { maxItems: 0 }, firstRun: { maxItems: 0 } });
});
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
  const dir = await workspace(t); await seed(dir); await writeFile(join(dir, 'configs/starters/webapp.json'), ' '.repeat(STARTER_MAX_BYTES + 1)); await assert.rejects(loadDefinitions(dir), /bounded|limit/i);
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
const npmStep = args => [{ id: 'install', label: 'Install', description: 'test', dependsOn: [], steps: [{ runner: 'npm', args, cwd: '.', timeout: 1000 }] }];
for (const args of [['ci', '-C', '/tmp/x'], ['ci', '-C/tmp/x'], ['install', '-gC'], ['install', '-Cg'], ['install', '-dg'], ['ci', '--prefix', '/tmp/x'],
  ['ci', '--pref=/tmp/x'], ['ci', '--PREFIX=/tmp/x'], ['install', '--workspace=../outside'], ['install', '-w', '../outside'], ['install', '-L', 'global'],
  ['run', 'build', '--', '--prefix=/tmp/x'], ['ci', '--cache=/tmp/x'], ['ci', '--omit=dev,peer']]) test('npm safe-argument list refuses ' + args.join(' '), () => {
  assert.throws(() => readProcesses(npmStep(args)), /overrides/);
  const d = structuredClone(reference); d.processes = npmStep(args); d.firstRun = []; assert.throws(() => validateDefinition(d), /overrides/);
});
test('npm safe-argument list keeps reviewed local options and positional values', () => {
  for (const args of [['ci', '--no-fund'], ['ci', '--no-audit', '--ignore-scripts'], ['install', '--omit=dev'], ['install', 'lodash', '--save-exact'], ['run', 'build', '--if-present'], ['run', 'verify:project']])
    assert.equal(readProcesses(npmStep(args))[0].steps[0].args.length, args.length);
});
const withVariable = (d, where, value) => {
  if (where === 'content') d.files.push({ path: 'extra.txt', content: value });
  if (where === 'json') d.files.push({ path: 'extra.json', json: { nested: [value] } });
  if (where === 'path') d.files.push({ path: value + '.txt', content: 'x' });
  if (where === 'argument') d.processes[0].steps = [{ runner: 'npm', args: ['install', value], cwd: '.', timeout: 1000 }];
  if (where === 'nextSteps') d.nextSteps.push('Open ' + value);
  return d;
};
for (const where of ['content', 'json', 'path', 'argument', 'nextSteps']) test('validation rejects an undeclared template variable in ' + where, () => {
  assert.throws(() => validateDefinition(withVariable(structuredClone(reference), where, '{{typo}}')), /typo needs a declared input/);
  const optional = withVariable(structuredClone(reference), where, '{{extra}}'); optional.inputs.push({ id: 'extra', label: 'Extra', type: 'string', required: false });
  assert.throws(() => validateDefinition(optional), /extra needs a declared input/);
  optional.inputs.at(-1).default = 'value'; assert.doesNotThrow(() => validateDefinition(optional));
});
test('validation placeholder syntax matches rendering exactly, so a valid definition always renders', () => {
  for (const value of ['{{typo}}', '{{typo|json}}', '{{typo|html}}', '{{typo|other}}', '{{Typo}}', '{{ typo }}', '{typo}', '{{name}}', '{{description|html}}', '{{id|json}}']) {
    const d = validateDefinition(reference), values = resolveValues(d, { id: 'app', name: 'App' }); d.files.push({ path: 'extra.txt', content: value });
    const renders = (() => { try { renderFiles(d, values); return true; } catch (error) { assert.match(error.message, /No value/); return false; } })();
    const validates = (() => { try { validateDefinition(withVariable(structuredClone(reference), 'content', value)); return true; } catch { return false; } })();
    assert.equal(validates, renders, value);
  }
  const keys = structuredClone(reference); keys.files.push({ path: 'keys.json', json: { '{{typo}}': 'literal key' } });
  assert.equal(JSON.parse(renderFiles(validateDefinition(keys), resolveValues(validateDefinition(keys), { id: 'app', name: 'App' })).at(-1).content)['{{typo}}'], 'literal key');
});
test('CI qualifies exactly the shipped project starters and reads Angular pins from the setup starter', async () => {
  const ids = (await loadDefinitions(root)).filter(entry => entry.definition.generator.kind === 'project').map(entry => entry.definition.id);
  const workflow = await readFile(join(root, '.github/workflows/project-starter-qualification.yml'), 'utf8');
  assert.deepEqual(workflow.match(/^\s+starter: \[([^\]]+)\]$/m)[1].split(',').map(id => id.trim()).sort(), ids);
  assert.match(workflow, /qualify-project-starters\.mjs --starter '\$\{\{ matrix\.starter \}\}' --execute/);
  const offline = await readFile(join(root, '.github/workflows/offline-qualification-inputs.yml'), 'utf8');
  assert.match(offline, /configs\/starters\/webapp-angular\.json/); assert.doesNotMatch(offline, /project-presets/);
});
 });
  assert.deepEqual(variant.properties.targets.items.enum, ['plugin', 'webapp', 'website', 'cli']);
  assert.deepEqual(schema.$defs.angularPins.required, angularPackages); assert.equal(schema.$defs.angularPins.additionalProperties, false);
  assert.deepEqual(schema.allOf[0].then.properties, { inputs: { maxItems: 0 }, files: { maxItems: 0 }, processes: { maxItems: 0 }, firstRun: { maxItems: 0 } });
});
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
  const dir = await workspace(t); await seed(dir); await writeFile(join(dir, 'configs/starters/webapp.json'), ' '.repeat(STARTER_MAX_BYTES + 1)); await assert.rejects(loadDefinitions(dir), /bounded|limit/i);
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
const npmStep = args => [{ id: 'install', label: 'Install', description: 'test', dependsOn: [], steps: [{ runner: 'npm', args, cwd: '.', timeout: 1000 }] }];
for (const args of [['ci', '-C', '/tmp/x'], ['ci', '-C/tmp/x'], ['install', '-gC'], ['install', '-Cg'], ['install', '-dg'], ['ci', '--prefix', '/tmp/x'],
  ['ci', '--pref=/tmp/x'], ['ci', '--PREFIX=/tmp/x'], ['install', '--workspace=../outside'], ['install', '-w', '../outside'], ['install', '-L', 'global'],
  ['run', 'build', '--', '--prefix=/tmp/x'], ['ci', '--cache=/tmp/x'], ['ci', '--omit=dev,peer']]) test('npm safe-argument list refuses ' + args.join(' '), () => {
  assert.throws(() => readProcesses(npmStep(args)), /overrides/);
  const d = structuredClone(reference); d.processes = npmStep(args); d.firstRun = []; assert.throws(() => validateDefinition(d), /overrides/);
});
test('npm safe-argument list keeps reviewed local options and positional values', () => {
  for (const args of [['ci', '--no-fund'], ['ci', '--no-audit', '--ignore-scripts'], ['install', '--omit=dev'], ['install', 'lodash', '--save-exact'], ['run', 'build', '--if-present'], ['run', 'verify:project']])
    assert.equal(readProcesses(npmStep(args))[0].steps[0].args.length, args.length);
});
const withVariable = (d, where, value) => {
  if (where === 'content') d.files.push({ path: 'extra.txt', content: value });
  if (where === 'json') d.files.push({ path: 'extra.json', json: { nested: [value] } });
  if (where === 'path') d.files.push({ path: value + '.txt', content: 'x' });
  if (where === 'argument') d.processes[0].steps = [{ runner: 'npm', args: ['install', value], cwd: '.', timeout: 1000 }];
  if (where === 'nextSteps') d.nextSteps.push('Open ' + value);
  return d;
};
for (const where of ['content', 'json', 'path', 'argument', 'nextSteps']) test('validation rejects an undeclared template variable in ' + where, () => {
  assert.throws(() => validateDefinition(withVariable(structuredClone(reference), where, '{{typo}}')), /typo needs a declared input/);
  const optional = withVariable(structuredClone(reference), where, '{{extra}}'); optional.inputs.push({ id: 'extra', label: 'Extra', type: 'string', required: false });
  assert.throws(() => validateDefinition(optional), /extra needs a declared input/);
  optional.inputs.at(-1).default = 'value'; assert.doesNotThrow(() => validateDefinition(optional));
});
test('validation placeholder syntax matches rendering exactly, so a valid definition always renders', () => {
  for (const value of ['{{typo}}', '{{typo|json}}', '{{typo|html}}', '{{typo|other}}', '{{Typo}}', '{{ typo }}', '{typo}', '{{name}}', '{{description|html}}', '{{id|json}}']) {
    const d = validateDefinition(reference), values = resolveValues(d, { id: 'app', name: 'App' }); d.files.push({ path: 'extra.txt', content: value });
    const renders = (() => { try { renderFiles(d, values); return true; } catch (error) { assert.match(error.message, /No value/); return false; } })();
    const validates = (() => { try { validateDefinition(withVariable(structuredClone(reference), 'content', value)); return true; } catch { return false; } })();
    assert.equal(validates, renders, value);
  }
  const keys = structuredClone(reference); keys.files.push({ path: 'keys.json', json: { '{{typo}}': 'literal key' } });
  assert.equal(JSON.parse(renderFiles(validateDefinition(keys), resolveValues(validateDefinition(keys), { id: 'app', name: 'App' })).at(-1).content)['{{typo}}'], 'literal key');
});
test('CI qualifies exactly the shipped project starters and reads Angular pins from the setup starter', async () => {
  const ids = (await loadDefinitions(root)).filter(entry => entry.definition.generator.kind === 'project').map(entry => entry.definition.id);
  const workflow = await readFile(join(root, '.github/workflows/project-starter-qualification.yml'), 'utf8');
  assert.deepEqual(workflow.match(/^\s+starter: \[([^\]]+)\]$/m)[1].split(',').map(id => id.trim()).sort(), ids);
  assert.match(workflow, /qualify-project-starters\.mjs --starter '\$\{\{ matrix\.starter \}\}' --execute/);
  const offline = await readFile(join(root, '.github/workflows/offline-qualification-inputs.yml'), 'utf8');
  assert.match(offline, /configs\/starters\/webapp-angular\.json/); assert.doesNotMatch(offline, /project-presets/);
});
