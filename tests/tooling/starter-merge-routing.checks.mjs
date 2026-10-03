/** Keep both CLI families reachable after merging independently developed setup work. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outputs } from '../../scripts/documentation/manual.mjs';

const launcher = fileURLToPath(new URL('../../bin/app', import.meta.url));
async function isolated(work) {
  const root = await mkdtemp(join(tmpdir(), 'starter-routing-'));
  try {
    await work(root);
    assert.deepEqual(await readdir(root), [], 'Help and discovery must not write a project.');
  } finally { await rm(root, { recursive: true, force: true }); }
}
function command(root, args) {
  const run = spawnSync(process.execPath, [launcher, ...args, '--root', root, '--json'], {
    cwd: root, env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(run.error, undefined);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, 'ok');
  return result;
}

for (const name of ['settings', 'project-setup', 'first-run']) {
  test(`bin/app routes help ${name} to the real setup CLI without writes`, async () => isolated(root => {
    const result = command(root, ['help', name]);
    assert.equal(result.command, name);
    assert.equal(typeof result.data.help, 'string');
    assert.match(result.data.help, new RegExp(name));
  }));
}
for (const args of [['--values', 'answers.json'], ['--answers', '{}'], ['--run', 'build'], ['--trust-processes']]) {
  test(`bin/app preserves external starter routing for ${args[0]}`, async () => isolated(root => {
    const result = command(root, ['new', ...args, '--help']);
    assert.equal(result.command, 'new');
    assert.equal(result.data.scope, 'command', 'Do not route starter options to the preset maker.');
  }));
}
test('empty invoking workspace remains empty when starter discovery follows the merge', async () => isolated(root => {
  const result = command(root, ['starters', 'list']);
  assert.deepEqual(result.data.starters, []);
}));
test('without --root, discovery reads the pack from the CLI package root, never the invoking folder', async () => isolated(async root => {
  // A maintainer checkout carries the canonical pack; an extracted CLI has none until the separate pack is added.
  const expected = await readdir(fileURLToPath(new URL('../../configs/starters/', import.meta.url))).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const args of [['starters', 'list'], ['new', '--list']]) {
    const run = spawnSync(process.execPath, [launcher, ...args, '--json'], { cwd: root, env: { ...process.env, CI: 'true' }, encoding: 'utf8', timeout: 15_000 });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const ids = JSON.parse(run.stdout).data.starters.map(starter => starter.id + '.json').sort();
    assert.deepEqual(ids, expected.filter(name => name.endsWith('.json')).sort());
  }
}));
test('merged manual retains starter and prototype-management command contracts together', async () => {
  const model = JSON.parse((await outputs())['commands.json']);
  const ids = new Set(model.commands.map(item => item.id));
  for (const id of ['starters list', 'starters run', 'starters edit', 'prototypes compare',
    'prototypes restore-snapshot', 'handout generate', 'docs recover']) assert.ok(ids.has(id), id);
  assert.ok(model.commands.every(item => item.group !== 'other' && item.examples.length > 0));
});
