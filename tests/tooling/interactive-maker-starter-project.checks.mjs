import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { starterProjectPlan, completeStarterProject, companionStarterSet, starterInvocation, invocationDirectory, enclosingVault, derivedId, derivedName } from '../../bin/adapters/framework/starter-project.ts';
import { result } from '../../bin/adapters/framework/contracts.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
async function withWorkspace(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'starter-project-')));
  try { await check(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const request = (args, options = {}) => ({ command: 'new', args, options });
const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code; } };

test('placement refuses missing, framework-internal, vault, invalid, file and non-empty targets', () => withWorkspace(async root => {
  const context = { root, frameworkRoot };
  const plan = (args, options = { starter: 'blank' }) => code(starterProjectPlan(request(args, options), context));
  assert.equal(await plan([]), 'TARGET_REQUIRED');
  assert.equal(await code(starterProjectPlan(request(['inside'], { starter: 'blank' }), { root: frameworkRoot, frameworkRoot })), 'TARGET_INSIDE_FRAMEWORK');
  // projects/<name> is the one standalone-project folder inside the checkout; nested or invalid names stay refused.
  for (const target of ['projects', 'projects/Bad_Name', 'projects/a/b', 'projects/a--b', 'src/projects/a']) {
    assert.equal(await code(starterProjectPlan(request([target], { starter: 'blank' }), { root: frameworkRoot, frameworkRoot })), 'TARGET_INSIDE_FRAMEWORK', target);
  }
  // A checkout that itself sits inside an Obsidian vault (a .obsidian folder above it) is refused before the export is read.
  const probeRefusal = await enclosingVault(join(frameworkRoot, 'projects/placement-probe')) ? 'TARGET_INSIDE_VAULT' : 'PROJECT_FILE_NOT_FOUND';
  assert.equal(await code(starterProjectPlan(request(['projects/placement-probe'], { from: join(root, 'missing-export.json') }), { root: frameworkRoot, frameworkRoot })), probeRefusal);
  await mkdir(join(root, 'vault/.obsidian'), { recursive: true });
  assert.equal(await plan(['vault/project']), 'TARGET_INSIDE_VAULT');
  assert.equal(await plan(['bad*name']), 'TARGET_INVALID');
  await writeFile(join(root, 'file'), 'x');
  assert.equal(await plan(['file']), 'TARGET_NOT_DIRECTORY');
  await mkdir(join(root, 'full')); await writeFile(join(root, 'full/kept.md'), 'kept');
  assert.equal(await plan(['full']), 'TARGET_NOT_EMPTY');
  assert.equal(await enclosingVault(join(root, 'vault/project/deeper')), join(root, 'vault'));
  assert.equal(await enclosingVault(join(root, 'elsewhere')), null);
}));

test('--from refuses starter-only options before any planning', () => withWorkspace(async root => {
  const context = { root, frameworkRoot };
  const plan = options => code(starterProjectPlan(request(['out'], { from: 'export.json', ...options }), context));
  assert.equal(await plan({ extension: 'folio' }), 'NATIVE_OPTIONS_REQUIRE_STARTER');
  assert.equal(await plan({ extensions: 'md' }), 'NATIVE_OPTIONS_REQUIRE_STARTER');
  assert.equal(await plan({ starter: 'blank' }), 'SOURCE_CONFLICT');
  for (const key of ['values', 'answers', 'run', 'trust-processes']) assert.equal(await plan({ [key]: key === 'run' || key === 'trust-processes' ? true : '{}' }), 'STARTER_OPTION');
}));

test('an exported project plans a new directory with its own or an overridden identity', () => withWorkspace(async root => {
  const { starters } = await companionStarterSet({ root: frameworkRoot, frameworkRoot });
  const document = starters.find(entry => entry.definition.id === 'blank').document;
  await writeFile(join(root, 'export.json'), JSON.stringify({ ...document, project: { ...document.project, id: 'exported-app', name: 'Exported App' } }));
  const context = { root, frameworkRoot };
  const own = await starterProjectPlan(request(['nested/out'], { from: 'export.json' }), context);
  assert.equal(own.summary.identity.id, 'exported-app'); assert.equal(own.summary.directory, join(root, 'nested/out'));
  assert.equal(own.summary.target, 'nested/out'); assert.ok(own.summary.files > 0); assert.ok(Array.isArray(own.summary.warnings));
  assert.ok(own.plan.changes.every(change => change.path.startsWith('nested/out/')));
  const renamed = await starterProjectPlan(request(['renamed'], { from: 'export.json', id: 'renamed-app', name: 'Renamed', author: 'Team', airship: true }), context);
  assert.equal(renamed.summary.identity.id, 'renamed-app'); assert.equal(renamed.summary.identity.author, 'Team');
  assert.equal(await code(starterProjectPlan(request(['bad'], { from: 'export.json', id: 'Bad ID' }), context)), 'INVALID_PLUGIN_ID');
}));

test('completion adds review guidance and only reports writes that happened', () => withWorkspace(async root => {
  const context = { root, frameworkRoot };
  const summary = { directory: join(root, 'made') };
  const failed = result('new', null, 'failed');
  assert.equal(await completeStarterProject(failed, request(['made']), context), failed);
  const planned = await completeStarterProject(result('new', { summary }, 'planned'), request(['made']), context);
  assert.equal(planned.data.written, false); assert.match(planned.data.next, /Nothing has been written/);
  const applied = await completeStarterProject(result('new', { summary }, 'applied'), request(['made']), context);
  assert.equal(applied.data.written, true); assert.equal(applied.data.nextSteps[1], 'npm ci');
  assert.deepEqual(applied.data.guide, { readme: join(root, 'made/README.md'), implementation: join(root, 'made/PROJECT-IMPLEMENTATION.md') });
}));

test('starter invocations resolve paths from the invoking shell unless --root selects a workspace', () => {
  const rooted = starterInvocation({ command: 'starters list', args: [], options: { root: '/workspace' } }, frameworkRoot);
  assert.equal(rooted.root, resolve('/workspace'));
  const run = starterInvocation({ command: 'starters run', args: [], options: {} }, frameworkRoot);
  assert.equal(run.request.options.project, resolve(process.cwd(), '.')); assert.equal(run.root, frameworkRoot);
  const values = starterInvocation({ command: 'new', args: ['x'], options: { values: 'answers.json' } }, frameworkRoot);
  assert.equal(values.request.options.values, resolve(process.cwd(), 'answers.json'));
  const stdin = starterInvocation({ command: 'starters add', args: [], options: { input: '-' } }, frameworkRoot);
  assert.equal(stdin.request.options.input, '-');
  assert.deepEqual(starterInvocation({ command: 'starters list', args: [], options: {} }, frameworkRoot).request.options, {});
  assert.equal(invocationDirectory('child', { npm_lifecycle_event: 'new', INIT_CWD: '/from' }, '/ignored'), resolve('/from/child'));
  assert.equal(invocationDirectory('child', { npm_lifecycle_event: 'build', INIT_CWD: '/from' }, '/cwd'), resolve('/cwd/child'));
  assert.equal(derivedName('quick-capture-tool'), 'Quick Capture Tool');
  assert.match(derivedId('/work/My Project', 'blank'), /^[a-z]/);
});
