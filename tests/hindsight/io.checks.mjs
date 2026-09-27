import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { repository, readConfig, saveConfig, locked, run } from '../../scripts/hindsight/io.ts';
import { committedDocuments } from '../../scripts/hindsight/sources.ts';
const cli = fileURLToPath(new URL('../../scripts/hindsight/cli.ts', import.meta.url));
function fixture(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'hindsight-tests-')));
  const root = join(base, 'repo'); const home = join(base, 'home'); mkdirSync(root); mkdirSync(home);
  const git = args => { const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(['init', '--quiet']); git(['config', 'user.email', 'tests@example.invalid']); git(['config', 'user.name', 'Fixture']);
  git(['remote', 'add', 'origin', 'https://github.com/example/project.git']);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { root, home, git, config: join(home, '.hindsight', 'coding-agent.json') };
}
function invoke(f, args) {
  const env = { ...process.env, HOME: f.home, USERPROFILE: f.home, HINDSIGHT_CONFIG: '', HINDSIGHT_API_LLM_PROVIDER: '', HINDSIGHT_API_LLM_MODEL: '' };
  return spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], { cwd: f.root, env, encoding: 'utf8' });
}
test('fresh clone status and install preview make no writes and need no Python or SDK', t => {
  const f = fixture(t);
  for (const args of [['status'], ['install', '--agents', 'codex'], ['stop'], ['disable']]) {
    const result = invoke(f, args); assert.equal(result.status, 0, result.stderr); assert.ok(JSON.parse(result.stdout));
    assert.deepEqual(readdirSync(f.home), []);
  }
});
test('install apply requires explicit processing consent before any environment write', t => {
  const f = fixture(t); const result = invoke(f, ['install', '--agents', 'codex', '--apply']);
  assert.equal(result.status, 1); assert.match(result.stderr, /CONSENT_REQUIRED/); assert.deepEqual(readdirSync(f.home), []);
});
test('unknown, misplaced, conflicting and security-looking options fail before writes', t => {
  const f = fixture(t);
  for (const args of [['install', '--agents', 'codex', '--apply', '--dry-run'], ['status', '--sessions'],
    ['status', '--apply'], ['install', '--agents', 'all'], ['install', '--api-key', 'private']]) {
    const result = invoke(f, args); assert.equal(result.status, 1); assert.deepEqual(readdirSync(f.home), []);
    assert.ok(!result.stderr.includes('private'));
  }
});
test('invalid and concurrent user configuration is preserved byte for byte', t => {
  const f = fixture(t); mkdirSync(resolve(f.config, '..'), { recursive: true });
  writeFileSync(f.config, '{bad'); assert.throws(() => readConfig(f.config), error => error.code === 'CONFIG_INVALID');
  assert.equal(readFileSync(f.config, 'utf8'), '{bad');
  writeFileSync(f.config, '{}'); assert.throws(() => saveConfig(f.config, { approved: true }, null), error => error.code === 'CONFIG_CHANGED');
  assert.equal(readFileSync(f.config, 'utf8'), '{}');
});
test('managed config updates have private backups and lock prevents concurrent helper writes', t => {
  const f = fixture(t); saveConfig(f.config, { first: true }, null); const old = readConfig(f.config).original;
  saveConfig(f.config, { second: true }, old);
  const backups = readdirSync(resolve(f.config, '..')).filter(name => name.includes('shell-backup-'));
  assert.equal(backups.length, 1); assert.equal(readFileSync(join(resolve(f.config, '..'), backups[0]), 'utf8'), old);
  const state = join(f.home, 'state'); locked(state, () => assert.throws(() => locked(state, () => {}), error => error.code === 'BUSY'));
  assert.equal(existsSync(join(state, 'operation.lock')), false);
});
test('existing and dangling symlinks cannot redirect config writes', t => {
  const f = fixture(t); mkdirSync(resolve(f.config, '..'), { recursive: true });
  try { symlinkSync(join(f.home, 'missing-target'), f.config); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') { t.skip('Windows runner cannot create symlinks'); return; } throw error; }
  assert.throws(() => saveConfig(f.config, {}, null), error => error.code === 'UNSAFE_PATH');
  assert.equal(existsSync(join(f.home, 'missing-target')), false);
});
test('source imports use committed blob bytes, not dirty files, and deterministic re-planning', t => {
  const f = fixture(t); const path = 'docs/memory/decisions/example.md'; mkdirSync(join(f.root, 'docs/memory/decisions'), { recursive: true });
  const body = '# Decision\n\nUnicode café.\n\n'; writeFileSync(join(f.root, path), body);
  f.git(['add', '--', path]); f.git(['-c', 'core.hooksPath=', 'commit', '--quiet', '-m', 'Fixture decision']);
  writeFileSync(join(f.root, path), 'UNCOMMITTED SECRET');
  const docs = committedDocuments(repository(f.root), [path]); assert.equal(docs[0].content, body);
  assert.deepEqual(committedDocuments(repository(f.root), [path]), docs);
  const plan = invoke(f, ['seed', '--file', path]); assert.equal(plan.status, 0, plan.stderr);
  assert.ok(!plan.stdout.includes('UNCOMMITTED')); assert.deepEqual(readdirSync(f.home), []);
  const apply = invoke(f, ['seed', '--file', path, '--apply', '--plan', 'wrong']);
  assert.match(apply.stderr, /PLAN_CHANGED/); assert.deepEqual(readdirSync(f.home), []);
});
test('source imports reject absent or executable blobs and forbidden paths', t => {
  const f = fixture(t); const path = 'docs/memory/example.md'; mkdirSync(join(f.root, 'docs/memory'), { recursive: true });
  writeFileSync(join(f.root, path), 'source'); f.git(['add', '--', path]); f.git(['update-index', '--chmod=+x', path]);
  f.git(['-c', 'core.hooksPath=', 'commit', '--quiet', '-m', 'Executable fixture']);
  for (const paths of [[path], ['docs/memory/missing.md'], ['.env'], []]) assert.throws(() => committedDocuments(repository(f.root), paths));
});
test('subprocess failure redacts captured credential-bearing stderr', () => {
  assert.throws(() => run(process.execPath, ['-e', 'console.error("TOP_SECRET");process.exit(2)']),
    error => error.code === 'PROCESS_FAILED' && !error.message.includes('TOP_SECRET'));
});
test('real linked worktrees share a canonical bank and expose the main checkout for opt-in lookup', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'example.txt'), 'fixture');
  f.git(['add', '.']); f.git(['-c', 'core.hooksPath=', 'commit', '--quiet', '-m', 'Initial fixture']);
  const worktree = join(f.home, 'worktree'); f.git(['-c', 'core.hooksPath=', 'worktree', 'add', '--detach', worktree, 'HEAD']);
  const main = repository(f.root); const linked = repository(worktree);
  assert.equal(linked.bank, main.bank); assert.equal(linked.mainRoot, main.root);
});
