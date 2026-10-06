import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVALS_PATH } from '../../scripts/quality/self-review-approvals.mjs';

// The maker engine and recipes moved to src/cli/adapters/makers as strict TypeScript, with the recipe catalog data beside
// them; scripts/makers keeps only the entity catalog entry and the consumer-owned custom registry.
const root = fileURLToPath(new URL('../../', import.meta.url));
const moved = ['arguments', 'custom-contract', 'dispatch', 'engine', 'entities-recipe', 'extra-recipes', 'load-catalog', 'native', 'native-registrations',
  'pending-locale', 'plan', 'plugin-recipe', 'primitives', 'registry', 'setting', 'templates', 'ui', 'ui-component-tests', 'ui-tests'];
async function files(folder) {
  const entries = await readdir(join(root, folder), { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]));
  return nested.flat();
}

test('scripts/makers holds only the catalog entry and consumer custom registry; the engine and catalog live in src/cli', async () => {
  assert.deepEqual((await files('scripts/makers')).filter(path => !path.startsWith('scripts/makers/custom/') || path.endsWith('/registry.mjs')).sort(),
    ['scripts/makers/custom/registry.mjs', 'scripts/makers/entities.mjs']);
  assert.ok((await files('src/cli/adapters/makers')).includes('src/cli/adapters/makers/recipes.json'));
  const owned = new Set(await files('src/cli/adapters/makers'));
  for (const name of [...moved, 'format-generated']) assert.ok(owned.has(`src/cli/adapters/makers/${name}.ts`), name);
});

test('no source, test, plugin or configuration file imports a removed maker path', async () => {
  const removed = [...moved.map(name => `makers/${name}.mjs`), 'quality/format-generated.mjs', 'makers/cli.mjs'];
  // The owner approvals record quotes deleted configuration lines verbatim; that history is its purpose, not a live reference.
  const historical = new Set(['tests/tooling/maker-layout.checks.mjs', APPROVALS_PATH]);
  const sources = (await Promise.all(['src', 'scripts', 'templates', 'tests', 'plugins', 'configs', '.github'].map(files))).flat()
    .filter(path => /\.(?:[cm]?[jt]s|json|ya?ml)$/.test(path) && !historical.has(path));
  const offenders = [];
  for (const path of sources) {
    const text = await readFile(join(root, path), 'utf8');
    for (const name of removed) if (text.includes(name)) offenders.push(`${path}: ${name}`);
  }
  assert.deepEqual(offenders, []);
});

test('generated consumer code receives maker primitives by injection; nothing names the kit editable maker copy', async () => {
  const kitMakerCopy = ['bin', 'template', 'bin', 'adapters', 'makers'].join('/');
  const sources = (await Promise.all(['src', 'scripts', 'templates', 'tests'].map(files))).flat().filter(path => /\.(?:[cm]?[jt]s|json|vue)$/.test(path));
  const offenders = [];
  for (const path of sources) if ((await readFile(join(root, path), 'utf8')).includes(kitMakerCopy)) offenders.push(path);
  assert.deepEqual(offenders, []);
});
