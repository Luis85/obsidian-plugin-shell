// Increment: [[docs/increments/release-cut-without-approval]]
// AC-1: The shipped `release-cut.yml` passes the repository workflow guard with its write job in the `release-cut` environment, and the guard rejects Publish (`publish.yml`) and `obsidian-release.yml` write jobs outside the `release` environment, including in `release-cut`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const checker = join(root, 'tooling/quality/check-repository.mjs');
const shipped = name => readFile(join(root, '.github/workflows', name), 'utf8');
const draftRelease = env => `name: Draft release\non:\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  draft:\n    runs-on: ubuntu-24.04\n    environment: ${env}\n    permissions:\n      contents: write\n    steps:\n      - run: echo\n`;

/**
 * Runs the real repository checker on a tree holding exactly these workflows (plus the local action they use).
 * Its first stage is the workflow guard: on success it prints one JSON verdict line; on failure it prints the codes
 * and stops. (A second, unrelated stage checks docs launchers against the full repository and is not judged here.)
 */
async function check(t, workflows) {
  const folder = await mkdtemp(join(tmpdir(), 'release-cut-guard-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await mkdir(join(folder, '.github/workflows'), { recursive: true }); await mkdir(join(folder, 'src/plugin/styles'), { recursive: true });
  await cp(join(root, '.github/actions'), join(folder, '.github/actions'), { recursive: true });
  for (const [name, text] of Object.entries(workflows)) await writeFile(join(folder, '.github/workflows', name), text);
  await writeFile(join(folder, 'src/plugin/styles/owned.css'), '.owned { color: red; }\n'); await writeFile(join(folder, 'README.md'), '# Readme\n');
  const result = spawnSync(process.execPath, [checker], { cwd: folder, encoding: 'utf8' });
  const first = result.stdout.split('\n')[0];
  return { passed: first.startsWith('{') && JSON.parse(first).status === 'passed', output: `${result.stdout}${result.stderr}` };
}

test('[AC-1] the cut runs in release-cut; Publish and generated releases stay behind release', async t => {
  const cut = await shipped('release-cut.yml'); const publish = await shipped('publish.yml');
  assert.match(cut, /\n {4}environment: release-cut\n/);
  const passing = await check(t, { 'release-cut.yml': cut, 'publish.yml': publish, 'obsidian-release.yml': draftRelease('release') });
  assert.equal(passing.passed, true, passing.output);
  for (const [name, text] of [['publish.yml', publish.replaceAll('environment: release\n', 'environment: release-cut\n')],
    ['release-cut.yml', cut.replace('environment: release-cut', 'environment: release')], ['obsidian-release.yml', draftRelease('release-cut')]]) {
    const failing = await check(t, { [name]: text });
    assert.equal(failing.passed, false, name); assert.match(failing.output, /PRIVILEGED_JOB_WITHOUT_ENVIRONMENT/, name);
  }
});
