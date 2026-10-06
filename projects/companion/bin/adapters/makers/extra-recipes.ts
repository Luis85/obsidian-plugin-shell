import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { makerSymbol as symbol, title, builtinRecipes } from './arguments.ts';
import { checkPendingLocale, localeSkeleton } from './pending-locale.ts';
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
/** Reads an existing pending draft, or undefined when this is the first run. */
async function existingDraft(context: MakerContext, path: string): Promise<string | undefined> {
  try { return await context.read(path); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw error; }
}
export async function localeRecipe(context: MakerContext, name: string, refresh = false): Promise<void> {
  const base = await localeSkeleton(context.read);
  const draftPath = `src/locales/pending/${name}.json`, statusPath = `src/locales/pending/${name}.status.json`;
  const draft = await existingDraft(context, draftPath);
  if (refresh && draft === undefined) throw new Error(`LOCALE_DRAFT_MISSING: --refresh updates an existing pending draft; create it first with make locale ${name}`);
  if (draft === undefined) {
    // Complete base skeleton remains nonselectable until a developer reviews translations.
    await context.add(draftPath, JSON.stringify(base, null, 2) + '\n');
    await context.add(statusPath, JSON.stringify({ locale: name, status: 'pending-translation-review', fallback: 'en', selectable: false, keys: countKeys(base) }, null, 2) + '\n');
  } else await refreshDraft(context, name, base, refresh);
  const path = `tests/tooling/locale-${name}.checks.mjs`;
  // The consumer test asks the project's own CLI (source launcher or extracted kit bundle) for a read-only key comparison.
  await context.add(path, `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { spawnSync } from 'node:child_process';\nimport { fileURLToPath } from 'node:url';\n\nconst root = fileURLToPath(new URL('../../', import.meta.url));\ntest('${name} pending translation preserves every checked base key and is not selectable', () => {\n  const run = spawnSync(process.execPath, ['bin/app', 'make', 'locale', '${name}', '--check', '--json'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });\n  assert.equal(run.error, undefined, run.error?.message); assert.equal(run.status, 0, run.stdout + run.stderr);\n  const { status, data } = JSON.parse(run.stdout);\n  assert.equal(status, 'ok'); assert.deepEqual([data.missing, data.extra, data.selectable], [[], [], false]);\n});\n`);
  context.tests.add(path);
}
/**
 * An existing draft keeps every translation of a current base key. Without drift a rerun changes nothing; with missing
 * or obsolete keys a plain rerun lists them, and the reviewed --refresh plan adds the missing keys (English values to
 * translate) and drops the obsolete ones (for example the showcase keys after examples:remove).
 */
async function refreshDraft(context: MakerContext, name: string, base: Record<string, unknown>, refresh: boolean): Promise<void> {
  const draftPath = `src/locales/pending/${name}.json`, statusPath = `src/locales/pending/${name}.status.json`;
  const check = await checkPendingLocale(context.read, name);
  if (check.selectable !== false) throw new Error(`LOCALE_DRAFT_SELECTABLE: ${name} is no longer a pending draft; edit enabled translations directly`);
  if (!check.missing.length && !check.extra.length) return;
  const listed = (keys: readonly string[]) => keys.slice(0, 10).join(', ') + (keys.length > 10 ? `, … ${keys.length - 10} more` : '');
  const drift = [check.missing.length ? `lacks ${check.missing.length} current base key(s): ${listed(check.missing)}` : '',
    check.extra.length ? `keeps ${check.extra.length} key(s) no longer in the base locale: ${listed(check.extra)}` : ''].filter(Boolean).join('; ');
  if (!refresh) throw new Error(`LOCALE_DRAFT_DRIFT: pending locale ${name} ${drift}. Review with make locale ${name} --refresh --dry-run, then apply it with --yes to add the missing keys, drop the obsolete ones and keep every surviving translation.`);
  const merged = reconcile(parseObject(await context.read(draftPath), draftPath), base);
  await context.edit(draftPath, () => JSON.stringify(merged, null, 2) + '\n');
  await context.edit(statusPath, source => JSON.stringify({ ...parseObject(source, statusPath), keys: countKeys(merged) }, null, 2) + '\n');
}
type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
function parseObject(source: string, path: string): Json {
  const value: unknown = JSON.parse(source);
  if (!isObject(value)) throw new Error(`LOCALE_DRAFT_INVALID: ${path} must contain a JSON object`);
  return value;
}
/** The draft's surviving keys keep their order and values (translations); obsolete keys are dropped and missing base
 * keys follow with their English values. Built from entries, so a stored "__proto__" key stays plain data. */
function reconcile(draft: Json, base: Json): Json {
  const kept = Object.entries(draft).filter(([key]) => Object.hasOwn(base, key)).map(([key, current]): [string, unknown] => {
    const value = base[key];
    if (isObject(value) !== isObject(current)) throw new Error(`LOCALE_DRAFT_SHAPE: ${key} changed between a message and a group; resolve it manually`);
    return [key, isObject(value) && isObject(current) ? reconcile(current, value) : current];
  });
  const added = Object.entries(base).filter(([key]) => !Object.hasOwn(draft, key));
  return Object.fromEntries([...kept, ...added]);
}
function countKeys(value: object): number { return Object.values(value).reduce((count: number, child: unknown) => count + (child && typeof child === 'object' ? countKeys(child) : 1), 0); }
