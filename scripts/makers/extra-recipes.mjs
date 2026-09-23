import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { symbol, title, builtinRecipes } from './arguments.mjs';
import { localeSkeleton } from './pending-locale.mjs';
import { defineLocalMaker } from './custom-contract.mjs';

export async function customMaker(context, name) {
  if (builtinRecipes.includes(name)) throw new Error('CUSTOM_RECIPE_BUILTIN_CONFLICT');
  const local = `${symbol(name)}Maker`;
  await context.add(`scripts/makers/custom/${name}.mjs`, `import { action } from '../primitives.mjs';\nimport { defineLocalMaker } from '../custom-contract.mjs';\n\n/** Trusted local code. The runner owns writes, review, formatting and checks. */\nexport const ${local} = defineLocalMaker({\n  name: '${name}', version: 1, description: '${title(name)} localized info command',\n  async plan(context, request) {\n    await action(context, { owner: request.owner, name: request.name, kind: 'command' });\n  },\n});\n`);
  await context.editArray('scripts/makers/custom/registry.mjs', 'customMakers', local, [{ local, from: `./${name}.mjs` }]);
  const path = `tests/tooling/custom-${name}.checks.mjs`;
  await context.add(path, `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${local} } from '../../scripts/makers/custom/${name}.mjs';\n\ntest('${name} custom recipe composes a registered localized command', async () => {\n  const paths = new Map(); const registrations = []; const tests = new Set();\n  await ${local}.plan({ tests, async add(path, content) { assert.equal(paths.has(path), false); paths.set(path, content); }, async editArray(...args) { registrations.push(args); } }, { owner: 'sample', name: 'example' });\n  assert.ok(paths.has('src/features/sample/example.command.ts'));\n  assert.ok(registrations.some(entry => entry[1] === 'authoringFactories'));\n  assert.ok(registrations.some(entry => entry[1] === 'authoringLocaleModules'));\n  assert.equal(tests.size, 1);\n});\n`);
  context.tests.add(path);
}
export async function runCustom(context, request) {
  await context.read('scripts/makers/custom/registry.mjs');
  const imported = await import(`${pathToFileURL(resolve(context.root, 'scripts/makers/custom/registry.mjs')).href}?recipe=${encodeURIComponent(request.maker)}`);
  if (!Array.isArray(imported.customMakers)) throw new Error('CUSTOM_REGISTRY_INVALID');
  const matches = imported.customMakers.filter(recipe => recipe.name === request.maker);
  if (matches.length !== 1 || typeof matches[0].plan !== 'function' || matches[0].version !== 1) throw new Error('Unknown maker. Use --list for the implemented catalog.');
  const safeContext = Object.freeze({ add: context.add, read: context.read, editArray: context.editArray, tests: context.tests });
  await defineLocalMaker(matches[0]).plan(safeContext, Object.freeze({ name: request.name, owner: request.owner }));
}
export async function styleRecipe(context, owner, name, view) {
  const component = `src/presentation/components/generated/${owner}-${view}.vue`;
  const path = `src/styles/generated/${owner}-${name}.css`;
  const source = await context.read(component);
  if (!source.includes(`shell-authoring-${owner}-${view}`)) throw new Error('STYLE_OWNER_MISMATCH: select a generated view owned by this feature');
  await context.add(path, `.shell-authoring-${owner}-${view} {\n  border: 1px solid var(--background-modifier-border);\n  border-radius: var(--radius-m);\n}\n`);
  const link = `<style src="../../../styles/generated/${owner}-${name}.css"></style>`;
  await context.edit(component, original => original.includes(link) ? original : original.trimEnd() + `\n\n${link}\n`);
}
export async function localeRecipe(context, name) {
  const base = await localeSkeleton(context.read);
  // Complete base skeleton remains nonselectable until a developer reviews translations.
  await context.add(`src/locales/pending/${name}.json`, JSON.stringify(base, null, 2) + '\n');
  await context.add(`src/locales/pending/${name}.status.json`, JSON.stringify({ locale: name, status: 'pending-translation-review', fallback: 'en', selectable: false, keys: countKeys(base) }, null, 2) + '\n');
  const path = `tests/tooling/locale-${name}.checks.mjs`;
  await context.add(path, `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport { localeSkeleton } from '../../scripts/makers/pending-locale.mjs';\n\nconst keys = value => Object.entries(value).flatMap(([key, child]) => typeof child === 'object' && child !== null ? keys(child).map(nested => key + '.' + nested) : [key]).sort();\ntest('${name} pending translation preserves every checked base key and is not selectable', async () => {\n  const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));\n  const base = await localeSkeleton(path => readFile(new URL('../../' + path, import.meta.url), 'utf8'));\n  const draft = await load('../../src/locales/pending/${name}.json');\n  const status = await load('../../src/locales/pending/${name}.status.json');\n  assert.deepEqual(keys(draft), keys(base)); assert.equal(status.selectable, false);\n});\n`);
  context.tests.add(path);
}
function countKeys(value) { return Object.values(value).reduce((count, child) => count + (child && typeof child === 'object' ? countKeys(child) : 1), 0); }
