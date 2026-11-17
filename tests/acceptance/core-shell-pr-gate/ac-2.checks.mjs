// Increment: [[docs/increments/core-shell-pr-gate]]
// AC-2: The Airship, Angular setup, compiler, interactive maker, project starter and native integration workflows trigger on pull requests exactly for the generator inputs followed by `!projects/**`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-2] the consumer-qualification workflows run on pull requests only for the generator inputs', async () => {
  const config = JSON.parse(await readFile(resolve(root, 'configs/quality/ci-scope.json'), 'utf8'));
  assert.deepEqual(config.workflows, ['airship-compatibility.yml', 'angular-setup-acceptance.yml', 'compiler-qualification.yml', 'interactive-maker.yml', 'project-starter-qualification.yml', 'native-integration-verification.yml']);
  for (const file of config.workflows) {
    const workflow = parse(await readFile(resolve(root, '.github/workflows', file), 'utf8'));
    assert.deepEqual(workflow.on.pull_request.paths, [...config.generators, '!projects/**'], file);
    assert.ok(!workflow.on.pull_request.paths.some(path => path.startsWith('src/plugin')), `${file} ignores core plugin changes`);
  }
});
