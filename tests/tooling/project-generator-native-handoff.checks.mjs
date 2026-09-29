import { test } from 'node:test';
import assert from 'node:assert/strict';
import { included, standaloneSource } from '../../scripts/framework/distribution.ts';
import { maintainerOnly, rebaseMarkdown } from '../../scripts/companion/compiler/framework-docs.ts';

const root = 'docs/concepts/native-file-integration-handoff/';
const cases = ['README.md', 'restore.py', 'MANIFEST.json', 'source-only.patch', 'source/src/domain/native-file.ts', 'source/docs/concepts/companion/index.html'];
test('native source handoff never ships in CLI kits', () => {
  for (const file of cases) assert.equal(included(root + file), false, file);
});
test('native source handoff never becomes generated-project input', () => {
  for (const file of cases) assert.equal(maintainerOnly(root + file), true, file);
});
test('native handoff exclusion retains unrelated docs and active native code', () => {
  for (const path of ['docs/concepts/native-file-integration-handoff-other/README.md', 'src/domain/native-integrations.ts', 'docs/development/native-file-integrations.md']) {
    assert.equal(included(path), true, path);
    assert.equal(maintainerOnly(path), false, path);
  }
});
test('handoff maintainer regression is not copied into consumer projects', () => {
  const path = 'tests/tooling/project-generator-native-handoff.checks.mjs';
  assert.equal(included(path), false);
  assert.equal(maintainerOnly(path), true);
});
test('distributed documentation does not retain broken handoff links', () => {
  const text = '[Recovered source](../concepts/native-file-integration-handoff/README.md)';
  const file = 'docs/development/example.md';
  assert.doesNotMatch(standaloneSource(file, Buffer.from(text)).toString(), /\]\(/);
  assert.doesNotMatch(rebaseMarkdown(text, file, file), /\]\(/);
});
