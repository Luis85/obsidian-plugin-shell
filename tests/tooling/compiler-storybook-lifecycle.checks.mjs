import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, realpath, symlink, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { storybookOperation } from '../../bin/adapters/framework/storybook.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { planProject, applyProject } from '../../scripts/compiler/adapters/project-plan.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8');
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'storybook-contract-')));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
async function write(dir, path, data) { await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), data); }
async function enabled(dir, options = { enabled: true }) {
  await write(dir, 'design/project.json', JSON.stringify({ ...JSON.parse(source), tooling: { storybook: options } }));
  await write(dir, 'storybook/package.json', JSON.stringify({ devDependencies: { storybook: '10.6.0' } }));
}
const request = (command, options = {}) => ({ command, args: [], options });
const context = dir => ({ root: dir, frameworkRoot: root });
const noExecution = { npm: async () => { throw Error('Unexpected npm discovery'); }, run: async () => { throw Error('Unexpected process'); } };
async function installedDouble(dir) {
  // These are explicitly fake installed-tool fixtures, never evidence of a real install/build.
  await write(dir, 'storybook/package-lock.json', JSON.stringify({ packages: { '': { devDependencies: { storybook: '10.6.0' } }, 'node_modules/storybook': { version: '10.6.0' } } }));
  await write(dir, 'storybook/node_modules/storybook/dist/bin/dispatcher.js', '// explicit test double');
}
test('status defaults off, writes nothing, and never discovers a global installation', async t => {
  const dir = await scratch(t), r = await storybookOperation(request('storybook status'), context(dir), noExecution);
  assert.equal(r.data.enabled, false); assert.equal(r.data.generateStories, false); assert.deepEqual(await readdir(dir), []);
  for (const command of ['storybook install', 'storybook check', 'storybook dev', 'storybook build']) {
    const r = await executeOperation(request(command, { yes: true }), context(dir));
    assert.equal(r.status, 'failed'); assert.equal(r.diagnostics[0].code, 'STORYBOOK_DISABLED');
  }
});
test('stories alone never authorize installation; an enabled workspace still needs explicit consent', async t => {
  const dir = await scratch(t); await enabled(dir, { generateStories: true });
  await assert.rejects(storybookOperation(request('storybook install', { yes: true }), context(dir), noExecution), /disabled/i);
  await enabled(dir);
  for (const options of [{}, { yes: true, 'dry-run': true }]) {
    const r = await storybookOperation(request('storybook install', options), context(dir), noExecution);
    assert.equal(r.status, 'planned'); assert.equal(r.data.firstInstall, true); assert.equal(r.data.execution, 'not-run');
  }
  for (const command of ['storybook dev', 'storybook build', 'storybook check']) assert.equal((await storybookOperation(request(command, { 'dry-run': true }), context(dir), noExecution)).status, 'planned');
});
test('first explicit optional install resolves only the nested workspace; later installs use ci', async t => {
  const dir = await scratch(t); await enabled(dir);
  const calls = [], executor = { npm: async () => '/trusted/npm-cli.js', run: async (...args) => { calls.push(args); return { exitCode: 0, signal: null, truncated: false, stdout: '' }; } };
  await storybookOperation(request('storybook install', { yes: true }), context(dir), executor);
  assert.equal(calls[0][0].root, join(dir, 'storybook')); assert.deepEqual(calls[0][2], ['install', '--no-fund']);
  assert.equal(calls[0][4].STORYBOOK_DISABLE_TELEMETRY, 'true');
  await installedDouble(dir);
  await storybookOperation(request('storybook install', { yes: true }), context(dir), executor);
  assert.deepEqual(calls[1][2], ['ci', '--no-fund']);
  await write(dir, 'storybook/package.json', JSON.stringify({ devDependencies: { storybook: '0.0.0' } }));
  await assert.rejects(storybookOperation(request('storybook install', { yes: true }), context(dir), noExecution), /differ/);
});
test('optional execution uses local installed tools, localhost, root cwd and telemetry opt-out', async t => {
  const dir = await scratch(t); await enabled(dir); await installedDouble(dir);
  const calls = [], executor = { npm: noExecution.npm, run: async (...args) => { calls.push(args); return { exitCode: 0, signal: null, truncated: false, stdout: '' }; } };
  for (const command of ['storybook check', 'storybook build', 'storybook dev']) await storybookOperation(request(command), context(dir), executor);
  assert.match(calls[0][1], /storybook\/node_modules\/vue-tsc/); assert.ok(calls[0][2].includes('storybook/tsconfig.json'));
  assert.ok(calls[1][2].includes('storybook/storybook-static'));
  assert.ok(calls[2][2].includes('127.0.0.1')); assert.ok(calls[2][2].includes('--no-open')); assert.equal(calls[2][3], 3600000);
  assert.ok(calls.every(call => call[0].root === dir && call[4].STORYBOOK_DISABLE_TELEMETRY === 'true'));
  await enabled(dir, { enabled: false, generateStories: true });
  await assert.rejects(storybookOperation(request('storybook dev'), context(dir), noExecution), /disabled/i);
});
test('missing installations, failed processes, cancellation and linked workspaces fail closed', async t => {
  const dir = await scratch(t); await enabled(dir);
  await assert.rejects(storybookOperation(request('storybook build'), context(dir), noExecution), /install --yes/);
  const failure = new Error('install failed');
  await assert.rejects(storybookOperation(request('storybook install', { yes: true }), context(dir), { npm: async () => '/test/npm', run: async () => { throw failure; } }), error => error === failure);
  const abort = new AbortController(); abort.abort();
  const r = await executeOperation(request('storybook install', { yes: true }), { ...context(dir), signal: abort.signal });
  assert.equal(r.status, 'cancelled');
  await rm(join(dir, 'storybook'), { recursive: true });
  const other = await scratch(t); await write(other, 'package.json', '{}');
  await symlink(other, join(dir, 'storybook'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(storybookOperation(request('storybook install', { yes: true }), context(dir), noExecution), /symlink/);
});
test('real generation preserves custom stories, blocks edits, removes retired stories from active inventory and disables retained tools', { timeout: 120000 }, async t => {
  const dir = await scratch(t), input = join(dir, 'input.json'), target = join(dir, 'project'); await writeFile(input, source);
  const options = { input, vault: dir, target: 'project', templateRoot: root, storybook: { enabled: true, generateStories: true } };
  let plan = await planProject(options); assert.deepEqual(plan.conflicts, []); await applyProject(plan, plan.hash);
  const packageBefore = await readFile(join(target, 'package.json'), 'utf8');
  await write(target, 'storybook/custom/Mine.stories.ts', '// custom story');
  const path = JSON.parse(await readFile(join(target, 'design/storybook.json'), 'utf8')).stories[0].path;
  const original = await readFile(join(target, path), 'utf8'); await writeFile(join(target, path), original + '// customization\n');
  plan = await planProject(options); assert.ok(plan.conflicts.some(c => c.includes(path)));
  await assert.rejects(applyProject(plan, plan.hash), /conflicts/);
  await writeFile(join(target, path), original);
  plan = await planProject({ ...options, storybook: { enabled: true, generateStories: false } }); await applyProject(plan, plan.hash);
  assert.deepEqual(JSON.parse(await readFile(join(target, 'storybook/.storybook/generated.json'), 'utf8')), []);
  assert.deepEqual(JSON.parse(await readFile(join(target, 'storybook/tsconfig.json'), 'utf8')).files, [], 'retired stories must also leave the typecheck entry list');
  assert.equal(await readFile(join(target, path), 'utf8'), original, 'retired files are retained, not deleted');
  plan = await planProject({ ...options, storybook: { enabled: false, generateStories: false } }); await applyProject(plan, plan.hash);
  assert.equal((await storybookOperation(request('storybook status'), context(target), noExecution)).data.enabled, false);
  await assert.rejects(storybookOperation(request('storybook dev'), context(target), noExecution), /disabled/i);
  assert.equal(await readFile(join(target, 'storybook/custom/Mine.stories.ts'), 'utf8'), '// custom story');
  assert.equal(await readFile(join(target, 'package.json'), 'utf8'), packageBefore);
});
