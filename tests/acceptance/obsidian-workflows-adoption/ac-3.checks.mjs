// Increment: [[docs/increments/obsidian-workflows-adoption]]
// AC-3: The workflow policy accepts write scopes in `obsidian-release.yml` only under the existing privileged rules; a fixture with a `push` trigger, one without the `release` environment and one with a reusable workflow call each fail with their existing policy codes.
// Runs the real repository checker (never imported) over a scratch root holding the generated workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const checker = resolve(root, 'tooling/quality/check-repository.mjs');
// The template has no placeholders, so its bytes are the generated workflow (ac-2 reads the compiled one).
const generated = await readFile(resolve(root, 'templates/companion/devkit/workflow-obsidian-release.yml.tmpl'), 'utf8');

/** Runs check-repository in a scratch root whose only workflow is `text`, saved as `.github/workflows/<name>`. */
async function check(t, name, text) {
  const folder = await mkdtemp(join(tmpdir(), 'obsidian-release-policy-')); t.after(() => rm(folder, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles']) await mkdir(join(folder, path), { recursive: true });
  await writeFile(join(folder, '.github/workflows', name), text);
  await writeFile(join(folder, 'src/plugin/styles/owned.css'), '.owned { color: red; }\n');
  await writeFile(join(folder, 'README.md'), '# Readme\n');
  const env = { ...process.env, NODE_OPTIONS: '' }; delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, [checker], { cwd: folder, env, encoding: 'utf8', timeout: 60_000 });
  // The CLI prints the workflow policy result first, then scans docs launchers, which a scratch root does not have.
  const first = run.stdout.split('\n')[0];
  return { status: run.status, policy: first.startsWith('{') ? JSON.parse(first).status : null, output: run.stdout + run.stderr };
}
const replaced = (from, to) => { assert.ok(generated.includes(from), from); return generated.replace(from, to); };

test('[AC-3] the generated obsidian-release.yml passes the workflow policy under its own name', async t => {
  const result = await check(t, 'obsidian-release.yml', generated);
  assert.equal(result.policy, 'passed', result.output);
});

test('[AC-3] the same workflow under another name may not grant write scopes', async t => {
  const result = await check(t, 'release.yml', generated);
  assert.equal(result.policy, null); assert.equal(result.status, 1); assert.match(result.output, /release\.yml: WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
});

test('[AC-3] a push trigger, a missing release environment or a reusable workflow call each fail with the existing codes', async t => {
  const cases = [
    [replaced('on:\n  workflow_dispatch:\n', 'on:\n  workflow_dispatch:\n  push:\n    tags: ["*"]\n'), 'PRIVILEGED_WORKFLOW_TRIGGER_FORBIDDEN'],
    [replaced('    environment: release\n', ''), 'PRIVILEGED_JOB_WITHOUT_ENVIRONMENT'],
    [replaced('    runs-on: ubuntu-latest\n', '    uses: ./.github/workflows/ci.yml\n    runs-on: ubuntu-latest\n'), 'PRIVILEGED_WORKFLOW_CALL_FORBIDDEN'],
  ];
  for (const [text, code] of cases) {
    const result = await check(t, 'obsidian-release.yml', text);
    assert.equal(result.policy, null, code); assert.equal(result.status, 1, code); assert.match(result.output, new RegExp(`obsidian-release\\.yml: ${code}`));
  }
});
