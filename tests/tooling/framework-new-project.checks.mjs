import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { derivedId, derivedName, invocationDirectory, pluginIdProblem } from '../../scripts/framework/starter-project.ts';
const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-new-project-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
/** The real terminal entry point, never a TTY: it must not prompt or hang. */
function cli(args, cwd) {
  return spawnSync(process.execPath, [join(root, 'shell.mjs'), 'new', ...args], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 50_000_000, stdio: ['pipe', 'pipe', 'pipe'] });
}
function machine(args, cwd) {
  const output = cli([...args, '--json'], cwd);
  assert.equal(output.stdout.trim().split('\n').length, 1, output.stderr);
  return { exit: output.status, result: JSON.parse(output.stdout) };
}
const json = async path => JSON.parse(await readFile(path, 'utf8'));
test('--list reports the integrity-checked starter catalog for humans and agents', async t => {
  const cwd = await scratch(t);
  const { exit, result } = machine(['--list'], cwd);
  assert.equal(exit, 0); assert.equal(result.status, 'ok'); assert.equal(result.data.integrity, 'catalog-sha256-verified');
  const catalog = await json(join(root, 'docs/concepts/companion/starters/catalog.json'));
  assert.deepEqual(result.data.starters.map(entry => entry.id), catalog.starters.map(entry => entry.id));
  for (const entry of result.data.starters) for (const key of ['title', 'category', 'difficulty', 'description']) assert.ok(entry[key], key);
  const human = cli(['--list'], cwd);
  assert.equal(human.status, 0); assert.match(human.stdout, /^ {2}quick-capture +Everyday +Capture +Quick Capture:/m); assert.match(human.stdout, /^ {2}blank /m);
});
test('non-interactive preview is the default and writes nothing', async t => {
  const cwd = await scratch(t);
  const { exit, result } = machine(['nested/field-notes', '--starter', 'blank'], cwd);
  assert.equal(exit, 0); assert.equal(result.status, 'planned'); assert.equal(result.data.written, false);
  assert.match(result.data.planHash, /^[a-f0-9]{64}$/);
  assert.equal(result.data.summary.directory, join(cwd, 'nested/field-notes'));
  assert.deepEqual(result.data.summary.identity, { ...result.data.summary.identity, id: 'field-notes', name: 'Field Notes' });
  assert.ok(result.data.changes.length > 100 && result.data.changes.every(change => change.status === 'create'));
  const human = cli(['nested/field-notes', '--starter', 'blank'], cwd);
  assert.equal(human.status, 0, human.stderr); assert.match(human.stdout, /Nothing has been written/); assert.match(human.stdout, new RegExp(result.data.planHash));
  assert.deepEqual(await readdir(cwd), []);
  // --install requests a later process step only; it never changes the reviewed file plan.
  assert.equal(machine(['nested/field-notes', '--starter', 'blank', '--install'], cwd).result.data.planHash, result.data.planHash);
  assert.deepEqual(await readdir(cwd), []);
});
test('--yes creates a blank project with the chosen identity and refuses a second run', async t => {
  const cwd = await scratch(t), target = join(cwd, 'field-notes');
  const created = machine(['field-notes', '--starter', 'blank', '--id', 'field-kit', '--name', 'Field Kit', '--author', 'Example Author', '--yes'], cwd);
  assert.equal(created.exit, 0, JSON.stringify(created.result.diagnostics)); assert.equal(created.result.status, 'applied'); assert.equal(created.result.data.written, true);
  assert.deepEqual(created.result.data.nextSteps, [`cd ${JSON.stringify(target)}`, 'npm ci', 'npm run verify:project', 'npm run test:watch', 'npm run dev:ui']);
  const manifest = await json(join(target, 'manifest.json')), pkg = await json(join(target, 'package.json')), design = await json(join(target, 'design/project.json'));
  assert.equal(manifest.id, 'field-kit'); assert.equal(manifest.name, 'Field Kit'); assert.equal(manifest.author, 'Example Author');
  assert.equal(pkg.name, 'field-kit'); assert.ok(pkg.scripts['verify:project'] && pkg.scripts['test:watch']);
  assert.deepEqual(design.project, { ...design.project, id: 'field-kit', name: 'Field Kit', author: 'Example Author' });
  const starter = await json(join(root, 'docs/concepts/companion/starters/blank.companion.json'));
  assert.deepEqual(design.design, starter.design, 'identity only, never label rewrites');
  assert.match(design.notes.at(-1), /Built-in: blank @ 1\.0\.0/);
  assert.equal((await json(join(target, '.companion/generation.json'))).projectId, 'field-kit');
  assert.ok(!existsSync(join(cwd, '.codex-authoring.lock')));
  const before = await readFile(join(target, 'manifest.json'));
  const again = machine(['field-notes', '--starter', 'blank', '--id', 'field-kit', '--yes'], cwd);
  assert.equal(again.exit, 1); assert.equal(again.result.diagnostics[0].code, 'TARGET_NOT_EMPTY');
  assert.deepEqual(await readFile(join(target, 'manifest.json')), before);
});
test('a reviewed --apply hash creates the quick-capture starter; a stale hash writes nothing', async t => {
  const cwd = await scratch(t), target = join(cwd, 'capture-inbox'), args = ['capture-inbox', '--starter', 'quick-capture', '--name', 'Capture Inbox'];
  const preview = machine(args, cwd);
  assert.equal(preview.result.status, 'planned'); assert.equal(preview.result.data.summary.identity.id, 'capture-inbox');
  const stale = machine([...args, '--apply', 'a'.repeat(64)], cwd);
  assert.equal(stale.exit, 1); assert.equal(stale.result.diagnostics[0].code, 'PLAN_STALE'); assert.ok(!existsSync(target));
  const applied = machine([...args, '--apply', preview.result.data.planHash], cwd);
  assert.equal(applied.result.status, 'applied', JSON.stringify(applied.result.diagnostics));
  assert.equal(applied.result.data.planHash, preview.result.data.planHash);
  assert.equal((await json(join(target, 'manifest.json'))).id, 'capture-inbox');
  assert.equal((await json(join(target, 'package.json'))).name, 'capture-inbox');
  const design = await json(join(target, 'design/project.json'));
  assert.equal(design.project.name, 'Capture Inbox'); assert.ok(design.design.semantic.entities.length > 0);
  assert.ok(existsSync(join(target, 'tests/project')) && existsSync(join(target, 'src/generated')));
});
test('refuses unsafe targets and invalid identities without writing', async t => {
  const cwd = await scratch(t);
  await mkdir(join(cwd, 'occupied')); await writeFile(join(cwd, 'occupied/notes.md'), 'keep');
  const cases = [
    [['occupied', '--starter', 'blank'], 'TARGET_NOT_EMPTY'],
    [[join(root, 'new-project-inside-checkout'), '--starter', 'blank'], 'TARGET_INSIDE_FRAMEWORK'],
    [['fresh', '--starter', 'blank', '--id', 'My Plugin'], 'INVALID_PLUGIN_ID'],
    [['fresh', '--starter', 'blank', '--id', 'obsidian-tools'], 'INVALID_PLUGIN_ID'],
    [['fresh', '--starter', 'blank', '--id', '9lives'], 'INVALID_PLUGIN_ID'],
    [['fresh', '--starter', 'no-such-starter'], 'STARTER_UNKNOWN'],
    [['fresh'], 'STARTER_REQUIRED'],
    [['--starter', 'blank'], 'TARGET_REQUIRED'],
  ];
  for (const [args, code] of cases) {
    const { exit, result } = machine([...args, '--yes'], cwd);
    assert.equal(exit, 1, code); assert.equal(result.status, 'failed'); assert.equal(result.diagnostics[0].code, code);
    const human = cli(args, cwd);
    assert.equal(human.status, 1, code); assert.match(human.stderr, new RegExp(code));
  }
  assert.deepEqual((await readdir(cwd)).sort(), ['occupied']); assert.deepEqual(await readdir(join(cwd, 'occupied')), ['notes.md']);
  assert.ok(!existsSync(join(root, 'new-project-inside-checkout')));
});
test('identity defaults derive from the directory and follow Obsidian ID rules', () => {
  assert.equal(derivedId('/work/My Capture Tool', 'fallback'), 'my-capture-tool');
  assert.equal(derivedId('/work/obsidian-habit-tracker', 'fallback'), 'habit-tracker');
  assert.equal(derivedId('/work/2024_notes', 'fallback'), 'notes');
  assert.equal(derivedId('/work/123', 'fallback'), 'fallback');
  assert.equal(derivedName('habit-tracker'), 'Habit Tracker');
  assert.equal(pluginIdProblem('habit-tracker'), null);
  for (const id of ['Habit', 'habit--tracker', '-habit', 'my-obsidian-helper', 'a'.repeat(61)]) assert.ok(pluginIdProblem(id), id);
  assert.equal(invocationDirectory('x', { npm_lifecycle_event: 'new', INIT_CWD: '/caller' }, '/framework'), '/caller/x');
  assert.equal(invocationDirectory('x', { INIT_CWD: '/caller' }, '/framework'), '/framework/x');
  assert.equal(invocationDirectory('/abs/x', { npm_lifecycle_event: 'new', INIT_CWD: '/caller' }, '/framework'), '/abs/x');
});
