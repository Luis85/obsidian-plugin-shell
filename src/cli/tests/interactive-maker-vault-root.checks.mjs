import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { setupPrerequisites } from '../adapters/project-setup.ts';
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
windows('Windows existing vault accepts case and 8.3 path spellings returned by the host', async t => scratch(async root => {
  const canonical = await realpath(root);
  assert.equal((await setupPrerequisites(canonical.toUpperCase())).git, 'existing');
  // Pass the path through an environment variable: cmd.exe must not double-quote
  // the argument string that Node constructs when spaces occur in runner paths.
  const short = spawnSync('cmd.exe', ['/d', '/v:off', '/s', '/c', 'for %I in ("%MAKER_VAULT_DIRECTORY%") do @echo "%~sI"'], {
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true,
    env: { ...process.env, MAKER_VAULT_DIRECTORY: canonical }, timeout: 10000,
  });
  assert.equal(short.status, 0, short.stderr);
  const alias = short.stdout.trim().replace(/^"|"$/g, '');
  assert.equal(await realpath(alias), canonical);
  if (!alias.includes('~') || alias.toLowerCase() === canonical.toLowerCase()) {
    t.skip('8.3 spelling is unavailable on this volume; case and symlink cases remain covered'); return;
  }
  assert.equal((await setupPrerequisites(alias)).git, 'existing');
}));
