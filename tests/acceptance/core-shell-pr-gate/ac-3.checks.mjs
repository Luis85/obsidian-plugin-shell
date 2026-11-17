// Increment: [[docs/increments/core-shell-pr-gate]]
// AC-3: Showcase (the Windows complete verify) runs on no pull request or push to main, but on dispatch, in the Release tier and in the nightly run; `nightly.yml` runs on a daily schedule and on dispatch and calls `ci.yml` and every workflow `release.yml` calls except Candidate qualification, with tier integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { evaluateCondition } from '../../../src/cli/domain/ci-expression.ts';

const root = resolve(import.meta.dirname, '../../..');
const workflow = async file => parse(await readFile(resolve(root, '.github/workflows', file), 'utf8'));
const decide = (text, values) => evaluateCondition(text, { lookup: path => values[path] ?? (/^(?:github|inputs)\./.test(path) ? '' : undefined), success: true });

test('[AC-3] the Windows complete verify leaves pull requests and pushes and runs nightly, on dispatch and in the release tier', async () => {
  const ci = await workflow('ci.yml'), showcase = ci.jobs.showcase;
  const events = {
    readyPullRequest: { 'github.event_name': 'pull_request', 'github.event.action': 'synchronize', 'github.event.pull_request.draft': 'false', 'github.head_ref': 'feature/x' },
    pushToMain: { 'github.event_name': 'push', 'github.ref': 'refs/heads/main' },
    nightly: { 'github.event_name': 'schedule', 'inputs.tier': 'integration' },
    dispatch: { 'github.event_name': 'workflow_dispatch', 'inputs.tier': 'integration' },
    release: { 'github.event_name': 'push', 'inputs.tier': 'release' },
  };
  const runs = Object.fromEntries(Object.entries(events).map(([name, values]) => [name, decide(showcase.if, values)]));
  assert.deepEqual(runs, { readyPullRequest: false, pushToMain: false, nightly: true, dispatch: true, release: true });
  assert.match(showcase.strategy.matrix.os, /github\.event_name == 'schedule' && '\["windows-latest"\]'/, 'the nightly run is the Windows leg');

  const nightly = await workflow('nightly.yml'), release = await workflow('release.yml');
  assert.match(nightly.on.schedule[0].cron, /^\d+ \d+ \* \* \*$/);
  assert.ok(Object.hasOwn(nightly.on, 'workflow_dispatch'));
  const calls = data => Object.values(data.jobs).filter(job => job.uses).map(job => job.uses.replace('./.github/workflows/', '')).sort();
  assert.ok(calls(nightly).includes('ci.yml'));
  assert.deepEqual(calls(nightly), calls(release).filter(file => file !== 'candidate-qualification.yml'));
  for (const job of Object.values(nightly.jobs)) assert.equal(job.with.tier, 'integration', job.uses);
});
