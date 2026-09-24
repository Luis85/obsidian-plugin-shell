import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchesGlob } from 'node:path';
import { parseDocument } from 'yaml';

// GitHub applies path patterns in order: later positive matches re-include a file.
// This test covers only the simple glob subset used by this repository's filter.
function selected(push, file) {
  if (push['paths-ignore']) return !push['paths-ignore'].some(pattern => matchesGlob(file, pattern));
  let included = false;
  for (const pattern of push.paths ?? ['**']) {
    const excluded = pattern.startsWith('!');
    if (matchesGlob(file, excluded ? pattern.slice(1) : pattern)) included = !excluded;
  }
  return included;
}

test('candidate qualification includes every execution-policy JSON while narrative-only evidence remains excluded', async () => {
  const document = parseDocument(await readFile('.github/workflows/candidate-qualification.yml', 'utf8'));
  assert.deepEqual(document.errors, []);
  const push = document.toJS().on.push;
  assert.ok(!(push.paths && push['paths-ignore']));
  for (const file of ['docs/testing/acceptance-crosswalk.json', 'docs/testing/native-evidence-checks.json',
    'docs/testing/test-plan.json', 'docs/design/obsidian-tokens.json', 'src/main.ts', 'harness/app/main.ts',
    'scripts/testing/evidence-runner.mjs', 'tests/runtime/items.test.ts', 'package-lock.json',
    '.fallowrc.json', '.oxlintrc.json', '.gitignore', '.github/workflows/candidate-qualification.yml']) {
    assert.equal(selected(push, file), true, `Execution input must trigger qualification: ${file}`);
  }
  for (const file of ['README.md', 'AGENTS.md', 'docs/development/FRAMEWORK-GUIDE.md',
    'docs/testing/FRAMEWORK-LIFECYCLE.md', 'docs/testing/evidence/framework-lifecycle-candidate.json']) {
    assert.equal(selected(push, file), false, `Narrative/evidence document should not trigger native qualification: ${file}`);
  }
});
