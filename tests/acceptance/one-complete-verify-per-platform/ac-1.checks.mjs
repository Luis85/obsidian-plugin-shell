// Increment: [[docs/increments/one-complete-verify-per-platform]]
// AC-1: Setup compatibility's Ubuntu Node 24.15.0 / npm 12 leg passes `--defer-verify` to setup and then runs `verify --skip tooling`, failing on its exit code; no leg runs a complete verify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-1] the Node 24.15.0 leg runs every verify gate except the tooling suites; no leg runs a complete verify', async () => {
  const job = parse(await readFile(resolve(root, '.github/workflows/setup-compatibility.yml'), 'utf8')).jobs.setup;
  const rows = job.strategy.matrix.include;
  assert.deepEqual(rows.filter(row => row.node === '24.15.0' && row.os === 'ubuntu-24.04').map(row => row.verify), ['partial']);
  assert.ok(rows.every(row => row.verify !== 'complete'), 'no leg runs setup\'s complete verify');
  const setup = job.steps.find(step => /run setup --/.test(step.run ?? ''));
  assert.match(setup.run, /if \(\$env:SETUP_VERIFY -ne 'complete'\) \{ \$extra \+= '--defer-verify' \}/);
  const partial = job.steps.find(step => step.if === "matrix.verify == 'partial'");
  assert.match(partial.run, /run verify -- --skip tooling\n\s*if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/);
});
