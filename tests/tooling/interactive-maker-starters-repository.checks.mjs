const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { starterFolder, checkDirectoryChain, parseDefinition, loadDefinitions, companionStarters } from '../../src/cli/adapters/starters/repository.ts';
import { validateDefinition } from '../../src/cli/adapters/starters/validation.ts';
import { code, fileStarter, shipped, workspace } from './starters-fixture.mjs';
import { retiredProject } from '../support/retired-projects.mjs';

// The local starter repository (repository.ts): the configured folder, the directory chain, bounded loading and the Companion starter set.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const settings = (root, value) => writeFile(join(root, 'configs/user-settings.json'), JSON.stringify(value));
const named = (id, overrides = {}) => fileStarter({ id, name: 'Starter ' + id, ...overrides });

test('the starter folder defaults to configs/starters and honours only a contained configured folder', () => workspace(async ({ root }) => {
  assert.equal(await starterFolder(root), 'configs/starters');
  await settings(root, {}); assert.equal(await starterFolder(root), 'configs/starters');
  await settings(root, { paths: {} }); assert.equal(await starterFolder(root), 'configs/starters');
  await settings(root, { paths: { startersFolder: 'team/starters' } }); assert.equal(await starterFolder(root), 'team/starters');
  for (const folder of ['../outside', '/absolute', 7]) {
    await settings(root, { paths: { startersFolder: folder } });
    assert.equal(await code(starterFolder(root)), 'STARTER_PATH');
  }
  await settings(root, { paths: [] }); assert.equal(await code(starterFolder(root)), 'STARTER_INVALID');
}));

test('the directory chain refuses links, files and missing required directories', () => workspace(async ({ root }) => {
  await checkDirectoryChain(join(root, 'configs/starters'));
  await checkDirectoryChain(join(root, 'missing/deeper'), true);
  assert.equal(await code(checkDirectoryChain(join(root, 'missing'))), 'STARTER_DIRECTORY');
  await writeFile(join(root, 'file'), 'x');
  assert.equal(await code(checkDirectoryChain(join(root, 'file'), true)), 'STARTER_LINK');
  await symlink(join(root, 'configs'), join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(await code(checkDirectoryChain(join(root, 'linked/starters'))), 'STARTER_LINK');
  await settings(root, { paths: { startersFolder: 'linked/starters' } });
  assert.equal(await code(starterFolder(root)), 'STARTER_LINK');
}));

test('definitions load in ID order with their exact bytes, hashes and files; plugin starters follow', () => workspace(async ({ root }) => {
  await writeFile(join(root, 'configs/starters/README.md'), 'not a definition');
  const contributed = named('from-plugin');
  const loaded = await loadDefinitions(root, [contributed]);
  assert.deepEqual(loaded.map(entry => [entry.definition.id, entry.file]), [['from-plugin', 'plugin:from-plugin'], ['web', 'configs/starters/web.json'], ['web-app', 'configs/starters/web-app.json']]);
  const bytes = await readFile(join(root, 'configs/starters/web-app.json'));
  assert.deepEqual(loaded[2], { definition: validateDefinition(named('web-app')), file: 'configs/starters/web-app.json', sha256: sha(bytes), bytes });
  const pluginBytes = Buffer.from(JSON.stringify(validateDefinition(contributed), null, 2) + '\n');
  assert.deepEqual([loaded[0].bytes, loaded[0].sha256], [pluginBytes, sha(pluginBytes)]);
  assert.deepEqual(await loadDefinitions(root, []), loaded.slice(1));
  assert.equal(await code(loadDefinitions(root, [named('web')])), 'STARTER_ID');
  await rm(join(root, 'configs'), { recursive: true });
  assert.deepEqual((await loadDefinitions(root, [contributed])).map(entry => entry.file), ['plugin:from-plugin']);
}, [named('web-app'), named('web')]));

test('loading refuses unsafe names, mismatched IDs, links and oversized folders', () => workspace(async ({ root }) => {
  const folder = join(root, 'configs/starters'), load = () => code(loadDefinitions(root, []));
  await writeFile(join(folder, 'other.json'), JSON.stringify(named('different'))); assert.equal(await load(), 'STARTER_ID');
  await rm(join(folder, 'other.json'));
  // Upper case would collide with one.json on case-insensitive file systems, so the refused name differs in its stem.
  await writeFile(join(folder, 'Two.json'), '{}'); assert.equal(await load(), 'STARTER_SOURCE');
  await rm(join(folder, 'Two.json'));
  await mkdir(join(folder, 'dir.json')); assert.equal(await load(), 'STARTER_SOURCE');
  await rm(join(folder, 'dir.json'), { recursive: true });
  // Windows needs Developer Mode for file symlinks; the junction above already covers links there.
  if (process.platform !== 'win32') { await symlink(join(folder, 'one.json'), join(folder, 'link.json')); assert.equal(await load(), 'STARTER_SOURCE'); await rm(join(folder, 'link.json')); }
  await writeFile(join(folder, 'bad.json'), Buffer.from([0x7b, 0xff, 0x7d])); assert.equal(await load(), 'ERR_ENCODING_INVALID_ENCODED_DATA');
  await rm(join(folder, 'bad.json'));
  for (let index = 0; index < 256; index += 1) await writeFile(join(folder, `note-${index}.txt`), '');
  assert.equal(await load(), 'STARTER_LIMIT');
}, [named('one')]));

test('loading bounds the total folder and contributed size at 16 MB', () => workspace(async ({ root }) => {
  const large = id => named(id, { files: Array.from({ length: 8 }, (_, index) => ({ path: `big/${index}.txt`, content: 'x'.repeat(499_000) })) });
  for (const id of ['a', 'b', 'c', 'd']) await writeFile(join(root, 'configs/starters', id + '.json'), JSON.stringify(large(id)));
  const loaded = await loadDefinitions(root, []);
  assert.equal(loaded.length, 4); assert.ok(loaded.reduce((size, entry) => size + entry.bytes.length, 0) > 15_900_000);
  const half = id => named(id, { files: [{ path: 'half.txt', content: 'x'.repeat(100_000) }] });
  assert.equal(await code(loadDefinitions(root, [half('extra')])), 'STARTER_LIMIT');
  await writeFile(join(root, 'configs/starters/e.json'), JSON.stringify(half('e')));
  assert.equal(await code(loadDefinitions(root, [])), 'STARTER_LIMIT');
}, []));

test('the Companion starter set keeps only Companion definitions, with their source hash and validated schema 6 document', async () => {
  const blank = validateDefinition(await shipped('blank')), bytes = Buffer.from('x');
  const file = { definition: validateDefinition(fileStarter()), file: 'f', sha256: 'f'.repeat(64), bytes }, companion = { definition: blank, file: 'b', sha256: 'b'.repeat(64), bytes };
  assert.deepEqual(companionStarters([file, companion]), [{ ...companion, document: blank.generator.document }]);
  assert.equal(companionStarters([companion])[0].document.schemaVersion, 6);
  assert.deepEqual(parseDefinition(Buffer.from(JSON.stringify(blank))), blank);
  // A retired project format is refused when the definition is read, never migrated into the set.
  const retired = structuredClone(blank); retired.generator.document = retiredProject(5);
  assert.throws(() => validateDefinition(retired), { code: 'STARTER_VERSION' });
});
