import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { setupPrerequisites } from '../../bin/adapters/project-setup.ts';
async function scratch(work) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-vault-root-'));
  try {
    const git = spawnSync('git', ['init', root], { encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
    await mkdir(join(root, '.obsidian'));
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('vault prerequisite canonicalizes the checked directory, while rejecting a nested Git root', async () => scratch(async root => {
  assert.equal((await setupPrerequisites(root + '/.')).git, 'existing');
  await mkdir(join(root, 'nested', '.obsidian'), { recursive: true });
  // A nested .git directory without repository metadata must not pass rev-parse.
  await mkdir(join(root, 'nested', '.git'));
  await assert.rejects(() => setupPrerequisites(join(root, 'nested')), /working-tree root/);
}));
test('canonicalization does not hide a symbolic-link vault root', async () => scratch(async root => {
  const alias = root + '-alias';
  await symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  try { await assert.rejects(() => setupPrerequisites(alias), /UNSAFE_ROOT/); }
  finally { await rm(alias); }
}));
const windows = process.platform === 'win32' ? test : test.skip;
windows('Windows existing vault accepts case and 8.3 path spellings returned by the host', async () => scratch(async root => {
  assert.equal((await setupPrerequisites(root.toUpperCase())).git, 'existing');
  const short = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${root}") do @echo %~sI`], { encoding: 'utf8' });
  assert.equal(short.status, 0, short.stderr);
  assert.equal((await setupPrerequisites(short.stdout.trim())).git, 'existing');
}));
