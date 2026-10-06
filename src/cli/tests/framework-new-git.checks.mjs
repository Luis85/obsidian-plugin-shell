import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readdir, rm, realpath, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { initializeRepository } from '../adapters/framework/git-init.ts';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
/** A git with no user, system or global configuration, as on a fresh machine or CI runner. */
const bareGit = home => ({ ...process.env, HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: join(home, 'none'), GIT_CONFIG_SYSTEM: join(home, 'none'), GIT_CONFIG_NOSYSTEM: '1' });
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-new-git-')));
  // git's detached auto-maintenance can still be writing .git/objects after `new` returns (seen on macOS).
  t.after(() => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  await cp(join(root, 'configs'), join(dir, 'configs'), { recursive: true });
  await mkdir(join(dir, 'home'));
  return dir;
}
const git = (cwd, args, env) => spawnSync('git', args, { cwd, encoding: 'utf8', env: env ?? process.env });
function create(cwd, args) {
  const output = spawnSync(process.execPath, [join(root, 'bin/app'), 'new', ...args, '--yes', '--json'], { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 50_000_000, env: bareGit(join(cwd, 'home')) });
  assert.equal(output.status, 0, output.stderr + output.stdout);
  return JSON.parse(output.stdout.trim().split('\n').at(-1));
}
const runner = (answers, calls = []) => async (cwd, args) => { calls.push(args.join(' ')); const hit = answers.find(([prefix]) => args.join(' ').startsWith(prefix)); return hit ? hit[1] : { code: 0, stdout: '' }; };

test('new commits the generated project with a neutral identity when none is configured, and leaves a clean tree', async t => {
  const cwd = await scratch(t);
  const result = create(cwd, ['field-notes', '--starter', 'blank']);
  assert.deepEqual(result.data.git, { status: 'initialized', committer: 'neutral', message: 'chore: generate project from blank' });
  const project = join(cwd, 'field-notes'), env = bareGit(join(cwd, 'home'));
  assert.equal(git(project, ['log', '--format=%s|%an|%ae'], env).stdout.trim(), 'chore: generate project from blank|Plugin Shell|noreply@plugin-shell.invalid');
  assert.equal(git(project, ['status', '--porcelain'], env).stdout, '');
  assert.equal(git(project, ['rev-list', '--count', 'HEAD'], env).stdout.trim(), '1');
  assert.equal(git(project, ['config', '--local', '--get', 'user.name'], env).status, 1, 'the neutral identity is never stored');
  assert.ok(git(project, ['ls-files', 'AGENTS.md'], env).stdout.includes('AGENTS.md'));
});
test('new keeps the configured committer identity', async t => {
  const cwd = await scratch(t), home = join(cwd, 'home');
  await writeFile(join(home, 'gitconfig'), '[user]\n\tname = Dev Person\n\temail = dev@example.test\n');
  const output = spawnSync(process.execPath, [join(root, 'bin/app'), 'new', 'mine', '--starter', 'blank', '--yes', '--json'], { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 50_000_000, env: { ...bareGit(home), GIT_CONFIG_GLOBAL: join(home, 'gitconfig') } });
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout.trim().split('\n').at(-1)).data.git.committer, 'configured');
  assert.equal(git(join(cwd, 'mine'), ['log', '--format=%an'], { ...bareGit(home), GIT_CONFIG_GLOBAL: join(home, 'gitconfig') }).stdout.trim(), 'Dev Person');
});
test('--no-git and a target already inside a git work tree skip with a reason and write no repository', async t => {
  const cwd = await scratch(t);
  const off = create(cwd, ['plain', '--starter', 'blank', '--no-git']);
  assert.deepEqual(off.data.git, { status: 'skipped', reason: '--no-git was passed' });
  assert.ok(!(await readdir(join(cwd, 'plain'))).includes('.git'));
  assert.equal(git(cwd, ['init', '--quiet']).status, 0);
  const inside = create(cwd, ['nested', '--starter', 'blank']);
  assert.deepEqual(inside.data.git, { status: 'skipped', reason: 'the folder is already inside a git work tree' });
  assert.ok(!(await readdir(join(cwd, 'nested'))).includes('.git'));
});
test('a preview writes nothing and reports no git result', async t => {
  const cwd = await scratch(t);
  const output = spawnSync(process.execPath, [join(root, 'bin/app'), 'new', 'preview', '--starter', 'blank', '--json'], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 50_000_000, env: bareGit(join(cwd, 'home')) });
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout.trim().split('\n').at(-1)).data.git, undefined);
  assert.ok(!(await readdir(cwd)).includes('preview'));
});
test('initializeRepository reports each skip and failure honestly without throwing', async () => {
  const calls = [];
  assert.deepEqual(await initializeRepository('/p', 'x', runner([['--version', { code: null, stdout: '' }]], calls)), { status: 'skipped', reason: 'git is not available' });
  assert.deepEqual(calls, ['--version']);
  assert.deepEqual(await initializeRepository('/p', 'x', runner([['rev-parse', { code: 0, stdout: 'true\n' }]])), { status: 'skipped', reason: 'the folder is already inside a git work tree' });
  assert.deepEqual(await initializeRepository('/p', 'x', runner([['rev-parse', { code: 128, stdout: '' }], ['init', { code: 1, stdout: '' }]])), { status: 'failed', reason: 'git init failed' });
  const added = await initializeRepository('/p', 'x', runner([['rev-parse', { code: 128, stdout: '' }], ['add', { code: 1, stdout: '' }]]));
  assert.equal(added.status, 'failed'); assert.match(added.reason, /without a commit/);
  const committed = await initializeRepository('/p', 'x', runner([['rev-parse', { code: 128, stdout: '' }], ['config', { code: 1, stdout: '' }], ['-c', { code: 1, stdout: '' }]]));
  assert.equal(committed.status, 'failed'); assert.match(committed.reason, /initial commit failed/);
  const configured = [];
  const ok = await initializeRepository('/p', 'quick-capture', runner([['rev-parse', { code: 128, stdout: '' }], ['config', { code: 0, stdout: 'x\n' }]], configured));
  assert.deepEqual(ok, { status: 'initialized', committer: 'configured', message: 'chore: generate project from quick-capture' });
  assert.ok(configured.at(-1).startsWith('commit '), 'no -c identity override when one is configured');
});
test('new keeps the framework entry points executable in the first commit, so a clone can run them', { skip: process.platform === 'win32' ? 'file modes need a POSIX file system' : false }, async t => {
  const cwd = await scratch(t);
  create(cwd, ['modes', '--starter', 'blank']);
  const project = join(cwd, 'modes'), env = bareGit(join(cwd, 'home'));
  const modes = Object.fromEntries(git(project, ['ls-files', '-s', 'bin/app', 'scripts/agent/cloud-setup.sh', 'package.json'], env).stdout.trim().split('\n').map(line => [line.split('\t')[1], line.slice(0, 6)]));
  assert.deepEqual(modes, { 'bin/app': '100755', 'scripts/agent/cloud-setup.sh': '100755', 'package.json': '100644' });
  assert.equal(git(project, ['status', '--porcelain'], env).stdout, '');
  const plain = create(cwd, ['plain-modes', '--starter', 'blank', '--no-git']);
  assert.equal(plain.data.git.status, 'skipped');
  assert.ok(statSync(join(cwd, 'plain-modes', 'bin/app')).mode & 0o111, '--no-git projects keep the bits too');
});
