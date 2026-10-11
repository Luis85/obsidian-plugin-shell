// Increment: [[docs/increments/reviewed-host-floor]]
// AC-1: Given a release source whose floor is 1.13.7 When the cut runs with the reviewed --min-app-version 1.14.4 Then the plan shows 1.13.7 -> 1.14.4, and the release commit sets manifest minAppVersion 1.14.4 and versions.json records the new version at 1.14.4 while every released entry keeps 1.13.7
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const released = { '0.1.0': '1.13.7', '0.2.0': '1.13.7', '0.3.0': '1.13.7', '0.4.0': '1.13.7' };
const links = '[Unreleased]: https://github.com/Example/floor-plugin/compare/0.4.0...HEAD\n[0.4.0]: https://github.com/Example/floor-plugin/releases/tag/0.4.0\n';
const environment = () => { const env = { ...process.env, NODE_OPTIONS: '' }; delete env.NODE_TEST_CONTEXT; delete env.GITHUB_HEAD_REF; delete env.GITHUB_REF_NAME; return env; };

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}
/** Runs a real repository script (never imported) in the fixture checkout. */
const script = (cwd, path, ...args) => spawnSync(process.execPath, [resolve(root, path), ...args], { cwd, env: environment(), encoding: 'utf8', timeout: 120_000 });

/** A released 0.4.0 plugin on main (floor 1.13.7) pushed to a local bare origin. */
async function releasedPlugin(t) {
  const folder = await mkdtemp(join(tmpdir(), 'reviewed-host-floor-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const work = join(folder, 'work'); const origin = join(folder, 'origin.git'); await mkdir(work);
  const files = {
    'manifest.json': { id: 'floor-plugin', name: 'Floor Plugin', version: '0.4.0', minAppVersion: '1.13.7', isDesktopOnly: true },
    'package.json': { name: 'floor-plugin', version: '0.4.0', dependencies: { alpha: '1.2.3' } },
    'package-lock.json': { version: '0.4.0', lockfileVersion: 3, packages: { '': { version: '0.4.0', dependencies: { alpha: '1.2.3' } }, 'node_modules/alpha': { version: '1.2.3' } } },
    'versions.json': released,
  };
  for (const [name, value] of Object.entries(files)) await writeFile(join(work, name), JSON.stringify(value, null, 2) + '\n');
  await writeFile(join(work, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n### Changed\n\n- Require Obsidian 1.14.4.\n\n## [0.4.0] - 2026-09-01\n\nReleased.\n\n${links}`);
  git(folder, 'init', '--quiet', '--bare', '--initial-branch=main', origin);
  git(work, 'init', '--quiet', '--initial-branch=main');
  git(work, 'config', 'user.name', 'Fixture'); git(work, 'config', 'user.email', 'fixture@example.invalid'); git(work, 'config', 'commit.gpgsign', 'false');
  git(work, 'add', '.'); git(work, 'commit', '--quiet', '-m', 'Release 0.4.0');
  git(work, 'remote', 'add', 'origin', origin); git(work, 'push', '--quiet', 'origin', 'main'); git(work, 'fetch', '--quiet', 'origin');
  return work;
}

test('[AC-1] a reviewed --min-app-version is planned, then recorded only in the new versions.json entry', { timeout: 300_000 }, async t => {
  const work = await releasedPlugin(t);
  const reviewed = ['--version', '0.5.0', '--date', '2026-10-10', '--min-app-version', '1.14.4'];

  const plan = script(work, 'tooling/release/cut.mjs', ...reviewed, '--json');
  assert.equal(plan.status, 0, plan.stderr);
  const planned = JSON.parse(plan.stdout);
  assert.equal(planned.status, 'planned');
  assert.deepEqual(planned.hostFloor, { from: '1.13.7', to: '1.14.4', changed: true });
  assert.match(planned.steps.find(step => step.id === 'prepare').detail, /host floor 1\.13\.7 -> 1\.14\.4 \(reviewed raise; promotion needs native acceptance on 1\.14\.4\)/);
  const preview = script(work, 'tooling/release/cut.mjs', ...reviewed);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /^FLOOR {4}minAppVersion 1\.13\.7 -> 1\.14\.4 \(reviewed raise/m);

  const prepared = script(work, 'src/cli/tooling/release/prepare.mjs', ...reviewed, '--dry-run');
  assert.equal(prepared.status, 0, prepared.stderr);
  const result = JSON.parse(prepared.stdout);
  assert.deepEqual([result.previousMinAppVersion, result.minAppVersion, result.hostFloorChanged, result.mode], ['1.13.7', '1.14.4', true, 'dry-run']);
  assert.equal(JSON.parse(await readFile(join(work, 'manifest.json'), 'utf8')).minAppVersion, '1.13.7', 'previews write nothing');
  assert.equal(git(work, 'status', '--porcelain'), '');

  const cut = script(work, 'tooling/release/cut.mjs', ...reviewed, '--execute', '--json');
  assert.equal(cut.status, 0, cut.stderr);
  assert.equal(JSON.parse(cut.stdout).status, 'committed');
  assert.equal(git(work, 'rev-parse', '--abbrev-ref', 'HEAD'), 'release/0.5.0');
  assert.equal(git(work, 'log', '-1', '--format=%s'), 'release: 0.5.0');
  const manifest = JSON.parse(git(work, 'show', 'HEAD:manifest.json'));
  assert.deepEqual([manifest.version, manifest.minAppVersion], ['0.5.0', '1.14.4']);
  assert.deepEqual(JSON.parse(git(work, 'show', 'HEAD:versions.json')), { ...released, '0.5.0': '1.14.4' });
  assert.deepEqual(JSON.parse(git(work, 'show', 'main:versions.json')), released, 'released entries never change');
});
