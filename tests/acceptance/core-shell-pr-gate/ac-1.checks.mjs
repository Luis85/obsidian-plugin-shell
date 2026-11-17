// Increment: [[docs/increments/core-shell-pr-gate]]
// AC-1: `node tooling/quality/ci-scope.mjs` reports `generators=false` for a pull request that changes only files outside the generator inputs, `generators=true` when one input changes and for every other event, and in `ci.yml` the generator jobs run only when the scope job says so (or the e2e label is present), while "CI result" depends on the scope job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { evaluateCondition } from '../../../src/cli/domain/ci-expression.ts';

const root = resolve(import.meta.dirname, '../../..');
const condition = text => String(text).trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1').trim();
const decide = (job, values) => evaluateCondition(condition(job.if), { lookup: path => values[path] ?? (/^(?:github|inputs|needs)\./.test(path) ? '' : undefined), success: true });
const readyPullRequest = { 'github.event_name': 'pull_request', 'github.event.action': 'synchronize', 'github.event.pull_request.draft': 'false', 'github.head_ref': 'feature/x' };

test('[AC-1] the scope classifier narrows only pull requests, and ci.yml gates its generator jobs on it', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'core-shell-ac1-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const files = join(folder, 'files.txt');
  const scope = async (event, list) => {
    await writeFile(files, list.join('\n'));
    const result = spawnSync(process.execPath, ['tooling/quality/ci-scope.mjs', '--event', event, '--files-from', files], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } });
    assert.equal(result.status, 0, result.stderr);
    return /^generators=(true|false)$/m.exec(result.stdout)[1];
  };
  assert.equal(await scope('pull_request', ['src/plugin/main.ts', 'docs/development/WORKFLOWS.md']), 'false');
  assert.equal(await scope('pull_request', ['src/plugin/main.ts', 'src/cli/compiler/index.ts']), 'true');
  for (const event of ['push', 'schedule', 'workflow_dispatch']) assert.equal(await scope(event, ['src/plugin/main.ts']), 'true', event);

  const ci = parse(await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
  assert.ok(ci.jobs['ci-result'].needs.includes('scope'), 'CI result fails when the scope job fails');
  for (const id of ['example-removal', 'generated-companion', 'starter']) {
    assert.equal(ci.jobs[id].needs, 'scope', id);
    assert.equal(decide(ci.jobs[id], { ...readyPullRequest, 'needs.scope.outputs.generators': 'false' }), false, `${id} skips a core-only pull request`);
    assert.equal(decide(ci.jobs[id], { ...readyPullRequest, 'needs.scope.outputs.generators': 'true' }), true, `${id} runs for a generator input`);
  }
  const labelled = { ...readyPullRequest, 'github.event.action': 'labeled', 'github.event.label.name': 'e2e', 'github.event.pull_request.labels.*.name': 'e2e' };
  for (const id of ['example-removal', 'generated-companion']) assert.equal(decide(ci.jobs[id], labelled), true, `${id} keeps its e2e steps for the label`);
});
