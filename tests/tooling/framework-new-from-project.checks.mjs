import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath, copyFile, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const concept = join(root, 'docs/concepts/companion');
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-new-from-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
/** The real terminal entry point, never a TTY: relative paths resolve against the caller's cwd. */
function cli(args, cwd) {
  return spawnSync(process.execPath, [join(root, 'shell.mjs'), 'new', ...args], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 50_000_000, stdio: ['pipe', 'pipe', 'pipe'] });
}
function machine(args, cwd) {
  const output = cli([...args, '--json'], cwd);
  assert.equal(output.stdout.trim().split('\n').length, 1, output.stderr);
  return { exit: output.status, result: JSON.parse(output.stdout) };
}
const json = async path => JSON.parse(await readFile(path, 'utf8'));
test('a downloaded companion export previews with its own identity and writes nothing', async t => {
  const cwd = await scratch(t);
  await copyFile(join(concept, 'companion-project.json'), join(cwd, 'plugin-companion.companion.json'));
  const { exit, result } = machine(['nested/plugin-companion', '--from', 'plugin-companion.companion.json'], cwd);
  assert.equal(exit, 0, JSON.stringify(result.diagnostics)); assert.equal(result.status, 'planned'); assert.equal(result.data.written, false);
  const source = await json(join(concept, 'companion-project.json'));
  assert.deepEqual(result.data.summary.identity, source.project, 'identity comes from the JSON, not the folder name');
  // The export's own ID is kept, but its submission problem is reported with a usable --id.
  assert.ok(result.data.summary.warnings.some(text => /"plugin-companion" will fail check submission: id must not contain "plugin" \(validate-manifest\)\. Pass --id companion/.test(text)), JSON.stringify(result.data.summary.warnings));
  const reserved = machine(['nested/plugin-companion', '--from', 'plugin-companion.companion.json', '--id', 'my-plugin'], cwd);
  assert.equal(reserved.exit, 1); assert.equal(reserved.result.diagnostics[0].code, 'INVALID_PLUGIN_ID'); assert.match(reserved.result.diagnostics[0].message, /--id my-project/);
  assert.equal(result.data.summary.source.file, 'plugin-companion.companion.json'); assert.equal(result.data.summary.source.schemaVersion, 4);
  assert.match(result.data.summary.source.sha256, /^[a-f0-9]{64}$/); assert.equal(result.data.summary.starter, undefined);
  assert.ok(result.data.summary.acceptanceTodos > 0 && result.data.changes.every(change => change.status === 'create'));
  const overridden = machine(['nested/plugin-companion', '--from', 'plugin-companion.companion.json', '--id', 'design-kit'], cwd);
  assert.equal(overridden.result.data.summary.identity.id, 'design-kit'); assert.notEqual(overridden.result.data.planHash, result.data.planHash);
  const human = cli(['nested/plugin-companion', '--from', 'plugin-companion.companion.json'], cwd);
  assert.equal(human.status, 0, human.stderr); assert.match(human.stdout, /From +plugin-companion\.companion\.json \(companion project schema 4/);
  assert.match(human.stdout, /Nothing has been written/); assert.match(human.stdout, new RegExp(result.data.planHash));
  assert.deepEqual(await readdir(cwd), ['plugin-companion.companion.json']); assert.ok(!existsSync(join(cwd, 'nested')));
});
test('--apply creates the reviewed project from a starter export with overridden identity; changed input is stale', async t => {
  const cwd = await scratch(t), target = join(cwd, 'inbox'), exported = join(cwd, 'quick-capture-plugin.companion.json');
  await copyFile(join(concept, 'starters/quick-capture.companion.json'), exported);
  const args = ['inbox', '--from', 'quick-capture-plugin.companion.json', '--id', 'capture-inbox', '--name', 'Capture Inbox', '--author', 'Example Author'];
  const preview = machine(args, cwd);
  assert.equal(preview.result.status, 'planned', JSON.stringify(preview.result.diagnostics));
  const original = await readFile(exported, 'utf8'), edited = JSON.parse(original);
  edited.project.description = 'Edited after review.'; await writeFile(exported, JSON.stringify(edited));
  const stale = machine([...args, '--apply', preview.result.data.planHash], cwd);
  assert.equal(stale.exit, 1); assert.equal(stale.result.diagnostics[0].code, 'PLAN_STALE'); assert.ok(!existsSync(target));
  await writeFile(exported, original);
  const applied = machine([...args, '--apply', preview.result.data.planHash], cwd);
  assert.equal(applied.result.status, 'applied', JSON.stringify(applied.result.diagnostics)); assert.equal(applied.result.data.written, true);
  const manifest = await json(join(target, 'manifest.json')), design = await json(join(target, 'design/project.json')), source = JSON.parse(original);
  assert.equal(manifest.id, 'capture-inbox'); assert.equal(manifest.name, 'Capture Inbox'); assert.equal(manifest.author, 'Example Author');
  assert.deepEqual(design.project, { ...source.project, id: 'capture-inbox', name: 'Capture Inbox', author: 'Example Author' });
  assert.deepEqual(design.design, source.design, 'identity only, never label rewrites');
  assert.deepEqual(design.notes, source.notes, 'no provenance is appended to a user export');
  const trace = await json(join(target, 'design/traceability.json'));
  assert.deepEqual(trace.requirements.map(requirement => requirement.id), source.design.prds.flatMap(prd => prd.requirements.map(requirement => requirement.id)));
  assert.equal((await json(join(target, '.companion/generation.json'))).projectId, 'capture-inbox');
  assert.equal(await readFile(exported, 'utf8'), original, 'the input file is only read');
});
test('invalid, malformed, future, unsafe or conflicting sources are refused with clear codes and no writes', async t => {
  const cwd = await scratch(t), blank = await json(join(concept, 'starters/blank.companion.json'));
  const write = (name, value) => writeFile(join(cwd, name), typeof value === 'string' ? value : JSON.stringify(value));
  await write('malformed.json', '{"kind": "obsidian-companion-project",');
  await writeFile(join(cwd, 'latin1.json'), Buffer.from([0x7b, 0xe9, 0x7d]));
  await write('future.json', { ...blank, schemaVersion: 5, design: { ...blank.design, schema: 5 } });
  await write('executable.json', { ...blank, executable: true });
  await write('blueprint.json', blank.design);
  await copyFile(join(concept, 'starters/catalog.json'), join(cwd, 'catalog.json'));
  await write('prototype.json', '{"__proto__": {"polluted": true}, ' + JSON.stringify(blank).slice(1));
  await write('obsidian-id.json', { ...blank, project: { ...blank.project, id: 'obsidian-helper' } });
  await write('blank.json', blank);
  await writeFile(join(cwd, 'oversized.json'), ' '.repeat(4_000_001));
  await symlink(join(cwd, 'blank.json'), join(cwd, 'linked.json'));
  await mkdir(join(cwd, 'folder.json'));
  const cases = [
    [['fresh', '--from', 'malformed.json'], 'PROJECT_JSON_MALFORMED'],
    [['fresh', '--from', 'latin1.json'], 'PROJECT_JSON_MALFORMED'],
    [['fresh', '--from', 'future.json'], 'PROJECT_VERSION_UNSUPPORTED'],
    [['fresh', '--from', 'executable.json'], 'PROJECT_INVALID'],
    [['fresh', '--from', 'blueprint.json'], 'PROJECT_INVALID'],
    [['fresh', '--from', 'catalog.json'], 'PROJECT_INVALID'],
    [['fresh', '--from', 'prototype.json'], 'PROJECT_INVALID'],
    [['fresh', '--from', 'obsidian-id.json'], 'INVALID_PLUGIN_ID'],
    [['fresh', '--from', 'blank.json', '--id', 'Not Valid'], 'INVALID_PLUGIN_ID'],
    [['fresh', '--from', 'blank.json', '--name', 'Two\nLines'], 'INVALID_IDENTITY'],
    [['fresh', '--from', 'missing.json'], 'PROJECT_FILE_NOT_FOUND'],
    [['fresh', '--from', 'oversized.json'], 'INPUT_LIMIT'],
    [['fresh', '--from', 'folder.json'], 'INPUT_LIMIT'],
    [['fresh', '--from', 'linked.json'], 'INPUT_LINK'],
    [['fresh', '--from', 'blank.json', '--starter', 'blank'], 'SOURCE_CONFLICT'],
    [['--from', 'blank.json'], 'TARGET_REQUIRED'],
  ];
  const before = (await readdir(cwd)).sort();
  for (const [args, code] of cases) {
    const { exit, result } = machine([...args, '--yes'], cwd);
    assert.equal(exit, 1, code); assert.equal(result.status, 'failed', code); assert.equal(result.diagnostics[0].code, code, result.diagnostics[0].message);
    const human = cli(args, cwd);
    assert.equal(human.status, 1, code); assert.match(human.stderr, new RegExp(code));
  }
  assert.deepEqual((await readdir(cwd)).sort(), before); assert.ok(!existsSync(join(cwd, 'fresh')));
  const future = machine(['fresh', '--from', 'future.json'], cwd).result.diagnostics[0];
  assert.match(future.message, /schema 5; this framework reads schema 4 and earlier/); assert.match(future.next, /Upgrade the framework/);
});
test('discovery advertises --from on new as a value option', async t => {
  const cwd = await scratch(t);
  const { result } = machine(['--help'], cwd);
  const entry = result.data.commands.find(command => command.id === 'new');
  assert.equal(entry.options.from, 'value'); assert.equal(entry.options.starter, 'value'); assert.match(entry.summary, /--from/);
});
