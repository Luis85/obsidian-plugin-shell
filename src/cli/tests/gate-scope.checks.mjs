import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkSteps } from '../adapters/framework/check.ts';
import { processOperation } from '../adapters/framework/process-operation.ts';
import { repositoryScope, toolingFolder } from '../adapters/framework/repository-scope.ts';

async function repository(t, kind) {
  const root = await realpath(await mkdtemp(join(tmpdir(), `gate-scope-${kind}-`)));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path, text = '') => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  if (kind === 'generated') {
    // The ownership receipt and the project-scoped TypeScript config are what mark a generated project.
    await write('.companion/generation.json', '{}');
    await write('configs/types/tsconfig.project.json', '{}');
    await write('scripts/quality/lint-source.mjs');
    await write('scripts/quality/verify.mjs');
  } else {
    await write('src/cli/app.ts');
    await write('tooling/quality/lint-source.mjs');
    await write('tooling/quality/verify.mjs');
  }
  return { root, write };
}
const request = (command, options = {}) => ({ command, args: [], options });
async function verifyEntry(root) {
  const calls = [];
  const dependencies = { runNode: async (_context, entry, args) => { calls.push({ entry, args }); return { exitCode: 0, signal: null, truncated: false, stdout: '{}' }; }, npmEntry: async () => '/qualified/npm-cli.js' };
  await processOperation(request('verify'), { root, frameworkRoot: root }, dependencies);
  return calls.at(-1);
}

test('the repository scope picks the tooling folder: tooling in the shell, scripts in a generated project', async t => {
  const shell = await repository(t, 'shell'), generated = await repository(t, 'generated');
  assert.equal(await repositoryScope(shell.root), 'shell-repository');
  assert.equal(await repositoryScope(generated.root), 'generated-project');
  assert.equal(toolingFolder('shell-repository'), 'tooling');
  assert.equal(toolingFolder('generated-project'), 'scripts');
});

test('verify without a profile runs the repository scope\'s own verify entry, in both scopes', async t => {
  const shell = await repository(t, 'shell'), generated = await repository(t, 'generated');
  assert.deepEqual(await verifyEntry(shell.root), { entry: 'tooling/quality/verify.mjs', args: [] });
  assert.deepEqual(await verifyEntry(generated.root), { entry: 'scripts/quality/verify.mjs', args: [] });
  const calls = [];
  const dependencies = { runNode: async (_context, entry, args) => { calls.push({ entry, args }); return { exitCode: 0, signal: null, truncated: false, stdout: '{}' }; }, npmEntry: async () => '/qualified/npm-cli.js' };
  await processOperation(request('verify', { profile: 'project' }), { root: generated.root, frameworkRoot: generated.root }, dependencies);
  assert.deepEqual(calls.at(-1), { entry: '/qualified/npm-cli.js', args: ['run', 'verify:project'] });
});

test('build, dev, release rehearsal and the native/obsidian test drivers run the repository scope\'s own tooling, in both scopes', async t => {
  const shell = await repository(t, 'shell'), generated = await repository(t, 'generated');
  const entries = async root => {
    const calls = [];
    const dependencies = { runNode: async (_context, entry) => { calls.push(entry); return { exitCode: 0, signal: null, truncated: false, stdout: '{}' }; }, npmEntry: async () => '/qualified/npm-cli.js' };
    for (const [command, options] of [['build'], ['dev'], ['dev', { profile: 'obsidian' }], ['release rehearse', { commit: 'abc123', version: '1.2.3' }],
      ['test', { profile: 'native' }], ['test', { profile: 'obsidian' }]]) await processOperation(request(command, options), { root, frameworkRoot: root }, dependencies);
    return calls;
  };
  const paths = ['bundling/build.mjs', 'dev/watch-local.mjs', 'dev/obsidian-dev.mjs', 'release/rehearse.mjs', 'testing/check-native.mjs', 'testing/run-obsidian-tests.mjs'];
  assert.deepEqual(await entries(shell.root), paths.map(path => `tooling/${path}`));
  assert.deepEqual(await entries(generated.root), paths.map(path => `scripts/${path}`));
});

test('check runs the repository scope\'s own oxlint wrapper and prints its path, in both scopes', async t => {
  const shell = await repository(t, 'shell'), generated = await repository(t, 'generated');
  const lint = async root => (await checkSteps(root, false)).steps.find(step => step.id === 'lint');
  assert.deepEqual(await lint(shell.root).then(step => [step.entry, step.display]), ['tooling/quality/lint-source.mjs', 'node tooling/quality/lint-source.mjs']);
  assert.deepEqual(await lint(generated.root).then(step => [step.entry, step.display]), ['scripts/quality/lint-source.mjs', 'node scripts/quality/lint-source.mjs']);
  // A generated project without the wrapper keeps ESLint only; it never falls back to the shell's tooling path.
  await rm(join(generated.root, 'scripts/quality/lint-source.mjs'));
  assert.equal(await lint(generated.root), undefined);
});

test('the shell suite steps name tooling/testing/suites.mjs', async t => {
  const shell = await repository(t, 'shell');
  await shell.write('configs/types/tsconfig.maker.json', '{}');
  const steps = (await checkSteps(shell.root, false)).steps;
  const suites = steps.find(step => step.id === 'maker-tests');
  assert.deepEqual([suites.entry, suites.display], ['tooling/testing/suites.mjs', 'node tooling/testing/suites.mjs maker']);
});
