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

test('handoff directory roots and their maintainer workflow are not distributed', () => {
  for (const path of [root.slice(0, -1), '.github/workflows/native-source-handoff.yml']) {
    assert.equal(included(path), false, path);
    assert.equal(maintainerOnly(path), true, path);
  }
});

test('documentation links to the excluded directory or workflow become readable text', () => {
  for (const target of ['../concepts/native-file-integration-handoff', '../../.github/workflows/native-source-handoff.yml']) {
    const text = `[Retained handoff](${target})`;
    for (const adapted of [standaloneSource('docs/development/example.md', Buffer.from(text)).toString(),
      rebaseMarkdown(text, 'docs/development/example.md', 'docs/development/example.md')]) {
      assert.doesNotMatch(adapted, /\]\(/);
      assert.match(adapted, /Retained handoff/);
    }
  }
});

test('the real template loader excludes the archive and preserves the active native implementation', async () => {
  const { loadTemplateSnapshot } = await import('../../scripts/compiler/adapters/template-snapshot.ts');
  const { fileURLToPath } = await import('node:url');
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  const snapshot = await loadTemplateSnapshot(repository);
  const paths = snapshot.frameworkFiles.map(file => file.path);
  assert.ok(!paths.some(path => path === root.slice(0, -1) || path.startsWith(root)));
  assert.ok(!paths.includes('.github/workflows/native-source-handoff.yml'));
  for (const path of ['src/domain/native-integrations.ts', 'docs/development/native-file-integrations.md']) {
    assert.ok(paths.includes(path), path);
  }
  // Native starter definitions moved to the separate pack: never template input, yet still carried and valid there.
  for (const path of ['docs/concepts/companion/starters/custom-file-view.companion.json', 'docs/concepts/companion/starters/context-menu.companion.json',
    'configs/starters/custom-file-view.json', 'configs/starters/context-menu.json']) assert.ok(!paths.includes(path), path);
  const { assembleStarterPack } = await import('../../scripts/starters/operations.ts');
  const { companionCatalog, loadDefinitions } = await import('../../scripts/starters/repository.ts');
  const pack = await assembleStarterPack({ root: repository, frameworkRoot: repository });
  for (const id of ['custom-file-view', 'context-menu']) assert.ok(pack.some(file => file.path === `configs/starters/${id}.json`), id);
  const native = Object.fromEntries(companionCatalog(await loadDefinitions(repository)).starters.map(entry => [entry.id, entry.document.design.nativeIntegrations]));
  assert.equal(native['custom-file-view'].fileTypes[0].extension, 'folio');
  assert.equal(native['context-menu'].contextMenus[0].id, 'inspect-file');
});
