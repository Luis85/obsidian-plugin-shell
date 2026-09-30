import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { included } from '../../scripts/framework/distribution.ts';
import { maintainerOnly } from '../../scripts/companion/compiler/framework-docs.ts';
import { loadTemplateSnapshot } from '../../scripts/compiler/adapters/template-snapshot.ts';
import { assembleStarterPack } from '../../scripts/starters/operations.ts';
import { companionStarters, loadDefinitions } from '../../scripts/starters/repository.ts';
const repository = fileURLToPath(new URL('../../', import.meta.url));

test('this maintainer regression reads the starter pack and is not copied into kits or consumer projects', () => {
  const path = 'tests/tooling/project-generator-native-starters.checks.mjs';
  assert.equal(included(path), false);
  assert.equal(maintainerOnly(path), true);
  for (const path of ['src/domain/native-integrations.ts', 'docs/development/native-file-integrations.md']) {
    assert.equal(included(path), true, path);
    assert.equal(maintainerOnly(path), false, path);
  }
});

test('the real template loader keeps the active native implementation; native starters travel only in the pack', async () => {
  const paths = (await loadTemplateSnapshot(repository)).frameworkFiles.map(file => file.path);
  for (const path of ['src/domain/native-integrations.ts', 'docs/development/native-file-integrations.md']) assert.ok(paths.includes(path), path);
  // Native starter definitions moved to the separate pack: never template input, yet still carried and valid there.
  for (const path of ['configs/starters/custom-file-view.json', 'configs/starters/context-menu.json']) assert.ok(!paths.includes(path), path);
  const pack = await assembleStarterPack({ root: repository, frameworkRoot: repository });
  for (const id of ['custom-file-view', 'context-menu']) assert.ok(pack.some(file => file.path === `configs/starters/${id}.json`), id);
  const native = Object.fromEntries(companionStarters(await loadDefinitions(repository)).map(entry => [entry.definition.id, entry.document.design.nativeIntegrations]));
  assert.equal(native['custom-file-view'].fileTypes[0].extension, 'folio');
  assert.equal(native['context-menu'].contextMenus[0].id, 'inspect-file');
});
