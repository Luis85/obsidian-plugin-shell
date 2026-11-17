// Increment: [[docs/increments/release-preflight]]
// AC-2: When an acceptance test only accepts the entry under `## [Unreleased]`, the preflight reports `changelog-tests` failed naming that test, prints `Release preflight blocked` and exits 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const preflight = resolve(import.meta.dirname, '../../../tooling/release/preflight.mjs');
const entry = '- Pending capability.';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:GIT_|NODE_TEST_CONTEXT$)/.test(key)));

/** A real main checkout of a 0.3.0 plugin with one Unreleased entry and one acceptance test reading CHANGELOG.md. */
async function repository(t, sectionEnd) {
  const root = await mkdtemp(join(tmpdir(), 'release-preflight-ac-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  const json = value => `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(root, 'manifest.json'), json({ id: 'sample-plugin', name: 'Sample', version: '0.3.0', minAppVersion: '1.13.7', isDesktopOnly: true }));
  await writeFile(join(root, 'package.json'), json({ name: 'sample-plugin', version: '0.3.0' }));
  await writeFile(join(root, 'package-lock.json'), json({ version: '0.3.0', lockfileVersion: 3, packages: { '': { version: '0.3.0' } } }));
  await writeFile(join(root, 'versions.json'), json({ '0.3.0': '1.13.7' }));
  await writeFile(join(root, 'CHANGELOG.md'), `# Changelog\n\n## [Unreleased]\n\n### Added\n\n${entry}\n\n## [0.3.0] - 2026-09-01\n\nNotes.\n\n[Unreleased]: https://github.com/Example/sample/compare/0.3.0...HEAD\n[0.3.0]: https://github.com/Example/sample/releases/tag/0.3.0\n`);
  await mkdir(join(root, 'tests/acceptance/sample'), { recursive: true });
  await writeFile(join(root, 'tests/acceptance/sample/ac-1.checks.mjs'), `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n` +
    `test('[AC-1] the entry is pending', () => {\n  const text = readFileSync('CHANGELOG.md', 'utf8');\n  const start = text.indexOf('## [Unreleased]');\n` +
    `  assert.ok(text.slice(start, ${sectionEnd}).includes(${JSON.stringify(entry)}));\n});\n`);
  git('init', '--quiet', '--initial-branch=main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'commit.gpgsign', 'false');
  git('add', '.'); git('commit', '--quiet', '-m', 'Sample');
  const run = () => spawnSync(process.execPath, [preflight, '--version', '0.4.0', '--date', '2026-10-01', '--skip-security'], { cwd: root, encoding: 'utf8', env });
  return { root, git, run };
}

test('[AC-2] a test pinned to Unreleased blocks the release and is named', async t => {
  const repo = await repository(t, "text.indexOf('\\n## [', start + 1)");
  const result = repo.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /^FAILED\s+changelog-tests: Fails against the promoted changelog \(tests\/acceptance\/sample\/ac-1\.checks\.mjs\): \[AC-1\] the entry is pending/m);
  assert.match(result.stdout, /Release preflight blocked: 0\.4\.0/);
  assert.equal(repo.git('worktree', 'list').split('\n').length, 1, 'the worktree is removed after a failure too');
});
