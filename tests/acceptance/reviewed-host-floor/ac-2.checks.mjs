// Increment: [[docs/increments/reviewed-host-floor]]
// AC-2: Given an invalid, unchanged or lower --min-app-version, or a floor edited in the source without review When release preparation or the cut runs Then it refuses (HOST_FLOOR_INVALID, HOST_FLOOR_NOT_RAISED, UNREVIEWED_HOST_FLOOR_CHANGE) without creating a branch or writing a file
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const names = ['manifest.json', 'package.json', 'package-lock.json', 'versions.json', 'CHANGELOG.md'];
const links = '[Unreleased]: https://github.com/Example/floor-plugin/compare/0.4.0...HEAD\n[0.4.0]: https://github.com/Example/floor-plugin/releases/tag/0.4.0\n';
const environment = () => { const env = { ...process.env, NODE_OPTIONS: '' }; delete env.NODE_TEST_CONTEXT; delete env.GITHUB_HEAD_REF; delete env.GITHUB_REF_NAME; return env; };

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
/** Runs a real repository script (never imported) in the fixture checkout. */
const script = (cwd, path, ...args) => spawnSync(process.execPath, [resolve(root, path), ...args], { cwd, env: environment(), encoding: 'utf8', timeout: 120_000 });
const cut = (cwd, ...args) => script(cwd, 'tooling/release/cut.mjs', '--version', '0.5.0', '--date', '2026-10-10', ...args);
const prepare = (cwd, ...args) => script(cwd, 'src/cli/tooling/release/prepare.mjs', '--version', '0.5.0', '--date', '2026-10-10', ...args);
const snapshot = work => Promise.all(names.map(name => readFile(join(work, name), 'utf8')));

async function releasedPlugin(t) {
  const folder = await mkdtemp(join(tmpdir(), 'unreviewed-host-floor-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const work = join(folder, 'work'); const origin = join(folder, 'origin.git'); await mkdir(work);
  const files = {
    'manifest.json': { id: 'floor-plugin', name: 'Floor Plugin', version: '0.4.0', minAppVersion: '1.13.7', isDesktopOnly: true },
    'package.json': { name: 'floor-plugin', version: '0.4.0', dependencies: { alpha: '1.2.3' } },
    'package-lock.json': { version: '0.4.0', lockfileVersion: 3, packages: { '': { version: '0.4.0', dependencies: { alpha: '1.2.3' } }, 'node_modules/alpha': { version: '1.2.3' } } },
    'versions.json': { '0.3.0': '1.13.7', '0.4.0': '1.13.7' },
  };
  for (const [name, value] of Object.entries(files)) await writeFile(join(work, name), JSON.stringify(value, null, 2) + '\n');
  await writeFile(join(work, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- A fix.\n\n## [0.4.0] - 2026-09-01\n\nReleased.\n\n${links}`);
  git(folder, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(work, 'init', '--quiet', '--initial-branch=main');
  git(work, 'config', 'user.name', 'Fixture'); git(work, 'config', 'user.email', 'fixture@example.invalid'); git(work, 'config', 'commit.gpgsign', 'false');
  git(work, 'add', '.'); git(work, 'commit', '--quiet', '-m', 'Release 0.4.0');
  git(work, 'remote', 'add', 'origin', origin); git(work, 'push', '--quiet', 'origin', 'main'); git(work, 'fetch', '--quiet', 'origin');
  return work;
}
function refused(result, code) {
  assert.equal(result.status, 1, `${code}: exit ${result.status}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout + result.stderr, new RegExp(code));
}

test('[AC-2] invalid, unchanged, lowered and unreviewed host floors are refused without a branch or a write', { timeout: 300_000 }, async t => {
  const work = await releasedPlugin(t);
  const before = await snapshot(work);
  refused(cut(work, '--min-app-version', '1.14'), 'HOST_FLOOR_INVALID');
  refused(prepare(work, '--min-app-version', 'latest'), 'HOST_FLOOR_INVALID');
  refused(cut(work, '--min-app-version', '1.13.7', '--execute'), 'HOST_FLOOR_NOT_RAISED');
  refused(prepare(work, '--min-app-version', '1.13.7'), 'HOST_FLOOR_NOT_RAISED');
  const lowered = cut(work, '--min-app-version', '1.12.0');
  refused(lowered, 'HOST_FLOOR_NOT_RAISED: 1\\.12\\.0 is not above 1\\.13\\.7');
  assert.match(lowered.stdout, /^BLOCKED {2}HOST_FLOOR_NOT_RAISED/m);
  assert.deepEqual(await snapshot(work), before);

  // The floor edited on main without the reviewed option, as when it was raised directly before.
  const manifest = JSON.parse(before[0]); manifest.minAppVersion = '1.14.4';
  await writeFile(join(work, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  git(work, 'commit', '--quiet', '-am', 'Raise the floor directly'); git(work, 'push', '--quiet', 'origin', 'main'); git(work, 'fetch', '--quiet', 'origin');
  const edited = await snapshot(work);
  for (const extra of [[], ['--min-app-version', '1.14.4'], ['--min-app-version', '1.15.0']]) {
    refused(cut(work, ...extra, '--execute'), 'UNREVIEWED_HOST_FLOOR_CHANGE');
    refused(prepare(work, ...extra), 'UNREVIEWED_HOST_FLOOR_CHANGE');
  }
  assert.deepEqual(await snapshot(work), edited);
  assert.equal(git(work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main');
  assert.equal(git(work, 'branch', '--list', 'release/*'), '');
  assert.equal(git(work, 'status', '--porcelain'), '');
});
