// Increment: [[docs/increments/one-complete-verify-per-platform]]
// AC-2: The Showcase job's Linux leg passes `--defer-verify` to setup and runs only `verify --only build,harness-build`, while Windows runs setup's complete verify; Template authoring / renamed feature keeps its complete verify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-2] Linux showcase builds only; Windows showcase and renamed-feature keep the complete verify', async () => {
  const ci = parse(await readFile(resolve(root, '.github/workflows/ci.yml'), 'utf8'));
  const setup = ci.jobs.showcase.steps.find(step => /run setup --/.test(step.run ?? '')).run;
  assert.match(setup, /if \(\$env:RUNNER_OS -eq 'Linux'\) \{ \$extra \+= '--defer-verify' \}/, 'only Linux defers');
  assert.deepEqual([...setup.matchAll(/run verify -- ([^\n]*)/g)].map(match => match[1].trim()), ['--only build,harness-build']);
  assert.match(setup, /if \(\$env:RUNNER_OS -eq 'Linux'\) \{\n\s*node "\$env:QUALIFIED_NPM" run verify -- --only build,harness-build/, 'the build-only verify is Linux-only');
  const renamed = ci.jobs['renamed-feature'].steps.map(step => step.run ?? '').join('\n');
  assert.match(renamed, /run verify -- --report-dir reports\/template-authoring\/verify-summary/, 'renamed-feature keeps the complete Ubuntu verify');
});
