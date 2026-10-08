import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateNativeIntegrations, nativeReservedExtensions } from '../../src/shared/companion/native-contract.mjs';
import { reservedFileExtensions } from '../../src/plugin/domain/native-integrations.ts';
import { nativeCode } from '../../src/cli/compiler/emitters/native-code.ts';
import { projectModel } from '../../src/cli/compiler/emitters/model.ts';
import { companionStarters, loadDefinitions } from '../../src/cli/adapters/starters/repository.ts';
import { customizeStarter as customizeLoaded } from '../../src/shared/companion/starters/customize.ts';
import { planMaker } from '../../src/cli/adapters/makers/plan.ts';
import { parseArguments } from '../../src/cli/adapters/makers/arguments.ts';
import { applyFilePlan } from '../../src/shared/platform/file-plan.ts';
import { makerFixture, makerSourceRoot } from '../../src/cli/tests/support/maker-fixture.mjs';
const file = {
  id: 'folio',
  name: 'Folio',
  extension: 'folio',
  format: 'json',
  initialContent: '{"title":"Untitled"}\n',
};
const namespace = () => ({ schemaVersion: 1, fileTypes: [structuredClone(file)], contextMenus: [] });
const catalog = companionStarters(await loadDefinitions(makerSourceRoot));
const customizeStarter = (starters, id, fields) => customizeLoaded(starters.find(entry => entry.definition.id === id), fields);
const args = (name = 'board', extension = 'board') =>
  parseArguments(['file-extension', name, '--feature', 'documents', '--extension', extension]);
async function fixture(work) {
  return makerFixture(async (root) => {
    await mkdir(join(root, 'src/features/documents'), { recursive: true });
    await work(root);
  });
}

test('portable and runtime reserved-extension policies cannot drift', () => {
  assert.deepEqual(nativeReservedExtensions, reservedFileExtensions);
  assert.deepEqual(validateNativeIntegrations(undefined), { schemaVersion: 1, fileTypes: [], contextMenus: [] });
  const value = namespace();
  assert.equal(validateNativeIntegrations(value), value);
});
for (const [name, change] of [
  ['namespace version', (n) => (n.schemaVersion = 2)],
  ['executable top-level data', (n) => (n.execute = 'code')],
  ['executable definition', (n) => (n.fileTypes[0].handler = 'code')],
  ['reserved extension', (n) => (n.fileTypes[0].extension = 'md')],
  ['uppercase extension', (n) => (n.fileTypes[0].extension = 'Folio')],
  ['malformed JSON default', (n) => (n.fileTypes[0].initialContent = '{broken')],
  ['duplicate association', (n) => n.fileTypes.push({ ...file, id: 'another' })],
  ['shared duplicate ID', (n) => n.contextMenus.push({ id: file.id, name: 'Inspect', extensions: ['md'] })],
  ['duplicate menu filter', (n) => n.contextMenus.push({ id: 'inspect', name: 'Inspect', extensions: ['md', 'md'] })],
  ['hidden filter', (n) => n.contextMenus.push({ id: 'inspect', name: 'Inspect', extensions: ['.obsidian'] })],
])
  test('portable namespace rejects ' + name, () => {
    const value = namespace();
    change(value);
    const before = structuredClone(value);
    assert.throws(() => validateNativeIntegrations(value), /NATIVE_INTEGRATION_INVALID/);
    assert.deepEqual(value, before);
  });
test('starter customization edits only native configuration and is round-trip portable', () => {
  const before = JSON.stringify(catalog);
  const source = customizeStarter(catalog, 'custom-file-view', { extension: 'board' });
  assert.equal(source.design.nativeIntegrations.fileTypes[0].extension, 'board');
  assert.deepEqual([source.design.nativeIntegrations.fileTypes[0].id, source.design.nativeIntegrations.fileTypes[0].name], ['board', 'Board document']);
  const text = JSON.stringify([source.design, source.notes]);
  assert.doesNotMatch(text, /\.folio\b|\bFolio\b/, 'the sample format is renamed in goals, acceptance, pages and notes');
  assert.match(text, /Create, open, edit and save \.board documents/);
  assert.match(JSON.stringify(customizeStarter(catalog, 'companion-plugin', {})), /portfolio/, 'other words are untouched');
  assert.equal(projectModel(source).screens.length, 3);
  const menu = customizeStarter(catalog, 'context-menu', { extensions: 'md,txt' });
  assert.deepEqual(menu.design.nativeIntegrations.contextMenus[0].extensions, ['md', 'txt']);
  assert.throws(() => customizeStarter(catalog, 'blank', { extension: 'board' }), /one|single|custom/i);
  assert.throws(() => customizeStarter(catalog, 'custom-file-view', { extension: 'md' }), /NATIVE_INTEGRATION_INVALID/);
  assert.equal(JSON.stringify(catalog), before);
});
test('compiler emits one managed registration and editable typed handlers under custom code/test roots', () => {
  const document = customizeStarter(catalog, 'custom-file-view', {
    codebaseFolder: 'plugin/src',
    testsFolder: 'plugin/tests',
    extension: 'board',
  });
  document.design.nativeIntegrations.contextMenus = [
    { id: 'inspect', name: '<script>literal</script>', extensions: ['md'] },
  ];
  const output = new Map();
  nativeCode(projectModel(document), (path, content, ownership = 'extension') =>
    output.set(path, { content, ownership }),
  );
  const registry = output.get('plugin/src/generated/bootstrap/native-integrations.ts');
  assert.equal(registry.ownership, 'managed');
  assert.match(registry.content, /projectFileTypes/);
  assert.match(registry.content, /projectContextMenus/);
  assert.ok([...output.keys()].some((path) => path.startsWith('plugin/tests/project/native/')));
  const source = output.get('plugin/src/generated/domain/native/inspect.context-menu.ts');
  assert.equal(source.ownership, 'extension');
  assert.match(source.content, /inspectFile/);
  assert.doesNotMatch(source.content, /<script>|from ['"]obsidian/);
});
test('makers plan without writes, apply once, replay unchanged, and reject duplicate extension ownership', () =>
  fixture(async (root) => {
    const planned = await planMaker(root, args());
    assert.deepEqual(await readdir(join(root, 'src/features/documents')), []);
    assert.ok(planned.plan.changes.some((change) => change.path === 'src/bootstrap/native-integrations.ts'));
    await applyFilePlan(planned.plan);
    const repeated = await planMaker(root, args());
    assert.ok(repeated.plan.changes.every((change) => change.status === 'unchanged'));
    assert.deepEqual((await applyFilePlan(repeated.plan)).written, []);
    await assert.rejects(planMaker(root, args('second', 'board')), /NATIVE_EXTENSION_CONFLICT/);
    await assert.rejects(planMaker(root, args('unsafe', 'md')), /NATIVE_INTEGRATION_INVALID/);
    const menu = await planMaker(
      root,
      parseArguments(['context-menu', 'inspect', '--feature', 'documents', '--extensions', 'md,board']),
    );
    await applyFilePlan(menu.plan);
    assert.match(
      await readFile(join(root, 'src/bootstrap/native-integrations.ts'), 'utf8'),
      /documentsInspectContextMenu/,
    );
    assert.match(await readFile(join(root, 'src/features/documents/inspect.context-menu.ts'), 'utf8'), /inspectFile/);
  }));
test('maker guard pins imported definitions and refuses dynamic registrations without executing them', () =>
  fixture(async (root) => {
    await applyFilePlan((await planMaker(root, args())).plan);
    const planned = await planMaker(root, args('second', 'folio'));
    const source = join(root, 'src/features/documents/board.file-extension.ts');
    await writeFile(source, (await readFile(source, 'utf8')).replace("extension: 'board'", "extension: 'folio'"));
    await assert.rejects(applyFilePlan(planned.plan), /PLAN_STALE/);
    await assert.rejects(planMaker(root, args('second', 'folio')), /NATIVE_EXTENSION_CONFLICT/);
    const registry = join(root, 'src/bootstrap/native-integrations.ts');
    await writeFile(
      registry,
      (await readFile(registry, 'utf8')).replace('[documentsBoardFileExtension]', '[...dangerous()]'),
    );
    await assert.rejects(planMaker(root, args('third', 'other')), /NATIVE_REGISTRY_REQUIRES_REVIEW/);
  }));
