import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { makerSymbol as symbol, title, builtinRecipes } from './arguments.ts';
import { localeSkeleton } from './pending-locale.ts';
import { defineLocalMaker, localRecipeContext } from './custom-contract.ts';
import type { MakerContext, MakerInput } from './contracts.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export async function customMaker(context: MakerContext, name: string): Promise<void> {
  if (builtinRecipes.includes(name)) throw new Error('CUSTOM_RECIPE_BUILTIN_CONFLICT');
  const local = `${symbol(name)}Maker`;
  // Import-free: the runner validates this object and injects its context, so the file works in any project layout.
  await context.add(`scripts/makers/custom/${name}.mjs`, `/** Trusted local code. The runner validates it, injects its context and owns writes, review, formatting and checks. */\nexport const ${local} = {\n  name: '${name}', version: 1, description: '${title(name)} localized info command',\n  async plan(context, request) {\n    await context.action({ owner: request.owner, name: request.name, kind: 'command' });\n  },\n};\n`);
  await context.editArray('scripts/makers/custom/registry.mjs', 'customMakers', local, [{ local, from: `./${name}.mjs` }]);
  const path = `tests/tooling/custom-${name}.checks.mjs`;
  await context.add(path, `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${local} } from '../../scripts/makers/custom/${name}.mjs';\n\n// Contract level: the runner injects the real primitive; the framework's recipe tests prove the composed output.\ntest('${name} custom recipe requests one localized command through the injected context', async () => {\n  const actions = []; const direct = []; const tests = new Set();\n  const record = kind => async path => { direct.push([kind, path]); };\n  const context = Object.freeze({ tests, read: record('read'), add: record('add'), editArray: record('editArray'), async action(request) { actions.push(request); } });\n  await ${local}.plan(context, Object.freeze({ owner: 'sample', name: 'example' }));\n  assert.deepEqual([${local}.name, ${local}.version], ['${name}', 1]);\n  assert.deepEqual(actions, [{ owner: 'sample', name: 'example', kind: 'command' }]);\n  assert.deepEqual(direct, []); assert.equal(tests.size, 0);\n});\n`);
  context.tests.add(path);
}
export async function runCustom(context: MakerContext, request: MakerInput): Promise<void> {
  await context.read('scripts/makers/custom/registry.mjs');
  const imported: unknown = await import(`${pathToFileURL(resolve(context.root, 'scripts/makers/custom/registry.mjs')).href}?recipe=${encodeURIComponent(request.maker)}`);
  const recipes: unknown = isRecord(imported) ? imported.customMakers : undefined;
  if (!Array.isArray(recipes)) throw new Error('CUSTOM_REGISTRY_INVALID');
  const matches = recipes.filter(recipe => isRecord(recipe) && recipe.name === request.maker);
  const [recipe] = matches;
  if (matches.length !== 1 || !isRecord(recipe) || typeof recipe.plan !== 'function' || recipe.version !== 1) throw new Error('Unknown maker. Use --list for the implemented catalog.');
  await defineLocalMaker(recipe).plan(localRecipeContext(context), Object.freeze({ name: request.name, owner: request.owner }));
}
export async function styleRecipe(context: MakerContext, owner: string, name: string, view: string): Promise<void> {
  const component = `src/presentation/components/generated/${owner}-${view}.vue`;
  const path = `src/styles/generated/${owner}-${name}.css`;
  const source = await context.read(component);
  if (!source.includes(`shell-authoring-${owner}-${view}`)) throw new Error('STYLE_OWNER_MISMATCH: select a generated view owned by this feature');
  await context.add(path, `.shell-authoring-${owner}-${view} {\n  border: 1px solid var(--background-modifier-border);\n  border-radius: var(--radius-m);\n}\n`);
  const link = `<style src="../../../styles/generated/${owner}-${name}.css"></style>`;
  await context.edit(component, original => original.includes(link) ? original : original.trimEnd() + `\n\n${link}\n`);
}
export async function localeRecipe(context: MakerContext, name: string): Promise<void> {
  const base = await localeSkeleton(context.read);
  // Complete base skeleton remains nonselectable until a developer reviews translations.
  await context.add(`src/locales/pending/${name}.json`, JSON.stringify(base, null, 2) + '\n');
  await context.add(`src/locales/pending/${name}.status.json`, JSON.stringify({ locale: name, status: 'pending-translation-review', fallback: 'en', selectable: false, keys: countKeys(base) }, null, 2) + '\n');
  const path = `tests/tooling/locale-${name}.checks.mjs`;
  // The consumer test asks the project's own CLI (source launcher or extracted kit bundle) for a read-only key comparison.
  await context.add(path, `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { spawnSync } from 'node:child_process';\nimport { fileURLToPath } from 'node:url';\n\nconst root = fileURLToPath(new URL('../../', import.meta.url));\ntest('${name} pending translation preserves every checked base key and is not selectable', () => {\n  const run = spawnSync(process.execPath, ['bin/app', 'make', 'locale', '${name}', '--check', '--json'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });\n  assert.equal(run.error, undefined, run.error?.message); assert.equal(run.status, 0, run.stdout + run.stderr);\n  const { status, data } = JSON.parse(run.stdout);\n  assert.equal(status, 'ok'); assert.deepEqual([data.missing, data.extra, data.selectable], [[], [], false]);\n});\n`);
  context.tests.add(path);
}
function countKeys(value: object): number { return Object.values(value).reduce((count: number, child: unknown) => count + (child && typeof child === 'object' ? countKeys(child) : 1), 0); }
