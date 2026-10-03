const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkNativeRegistration } from '../../bin/adapters/makers/native-registrations.ts';
import { localeSkeleton } from '../../bin/adapters/makers/pending-locale.ts';
import { pluginRecipe } from '../../bin/adapters/makers/plugin-recipe.ts';
import { runCustom, styleRecipe } from '../../bin/adapters/makers/extra-recipes.ts';
import { createMakerContext } from '../../bin/adapters/makers/engine.ts';

// Drives the static source readers behind the native, locale, plugin, style and custom recipes
// (bin/adapters/makers) under the maker floors: every unsupported shape fails with its stable code.
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
const missing = path => Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
const reader = files => ({ async read(path) { if (!Object.hasOwn(files, path)) throw missing(path); return files[path]; } });
async function project(t, files) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maker-sources-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
  return root;
}
const registry = 'src/bootstrap/native-integrations.ts';
const nativeRegistry = (fileTypes = '', menus = '', imports = '') => `${imports}export const nativeFileTypes = [${fileTypes}] as const;\nexport const nativeContextMenus = [${menus}];\n`;

test('native registrations are read statically and conflicting identities are refused', async () => {
  const files = {
    [registry]: nativeRegistry('board', 'share', "import { board } from '../features/a/board.ts';\nimport { menu as share } from '../features/a/share';\n"),
    'src/features/a/board.ts': "export const definition = ({ ...{ extension: 'board' }, id: 'a-board', name: `x` } satisfies object);\nexport { definition as board };\n",
    'src/features/a/share.ts': "export const menu = { id: 'a-share', 'name': 'Share' };\n",
    'design/project.json': JSON.stringify({ settings: { codebaseFolder: 'app' } }),
    'app/generated/bootstrap/native-integrations.ts': "import { p } from './p';\nexport const projectFileTypes = [p];\nexport const projectContextMenus = [];\n",
    'app/generated/bootstrap/p.ts': "export const p = { id: 'p-file', extension: 'pfile', ...{ name: 'P' } };\n",
  };
  const context = reader(files);
  await checkNativeRegistration(context, { id: 'a-new', extension: 'new' }, 'src/features/a/new.ts');
  await checkNativeRegistration(context, { id: 'a-board', extension: 'board' }, 'src/features/a/board.ts');
  await assert.rejects(checkNativeRegistration(context, { id: 'a-board' }, 'src/features/a/other.ts'), { message: 'NATIVE_ID_CONFLICT: a-board is already registered by src/features/a/board.ts' });
  await assert.rejects(checkNativeRegistration(context, { id: 'x', extension: 'pfile' }, 'src/x.ts'), { message: 'NATIVE_EXTENSION_CONFLICT: .pfile is already registered by p-file' });
  await assert.rejects(checkNativeRegistration(reader({ ...files, 'design/project.json': '{"settings":{}}' }), { id: 'x' }, 'src/x.ts'), { message: 'NATIVE_REGISTRY_REQUIRES_REVIEW: design/project.json settings.codebaseFolder' });
  await assert.rejects(checkNativeRegistration(reader({ ...files, 'design/project.json': '{' }), { id: 'x' }, 'src/x.ts'), SyntaxError);
});

test('native registries outside the static subset require review', async () => {
  const review = detail => ({ message: 'NATIVE_REGISTRY_REQUIRES_REVIEW: ' + detail });
  const check = files => checkNativeRegistration(reader(files), { id: 'z' }, 'src/z.ts');
  const source = (body, file = 'src/features/a/item.ts') => ({ [registry]: nativeRegistry('item', '', "import { item } from '../features/a/item';\n"), [file]: body });
  await assert.rejects(check({ [registry]: 'export const = ;' }), { message: 'NATIVE_REGISTRY_PARSE_ERROR: ' + registry });
  await assert.rejects(check({ [registry]: 'export const nativeFileTypes = [];\n' }), review(registry + ':nativeContextMenus'));
  await assert.rejects(check({ [registry]: 'export const nativeFileTypes = {};\nexport const nativeContextMenus = [];\n' }), review(registry + ':nativeFileTypes'));
  await assert.rejects(check({ [registry]: nativeRegistry("{ id: 'inline' }") }), review('expected an explicit imported declaration in ' + registry));
  await assert.rejects(check({ [registry]: nativeRegistry('item', '', "import { item } from 'package';\n") }), review('expected an explicit imported declaration in ' + registry));
  await assert.rejects(check(source('export const item = make();\n')), review('expected a static definition in src/features/a/item.ts'));
  await assert.rejects(check(source("export const item = { id: 'a', extension: ext };\n")), review('nonliteral extension in src/features/a/item.ts'));
  await assert.rejects(check(source("export const item = { id: 'a', ...shared };\n")), review('dynamic declaration spread in src/features/a/item.ts'));
  await assert.rejects(check(source("export const item = { name: 'x', [key]: 'y' };\n")), review('missing static identity in src/features/a/item.ts'));
  await assert.rejects(check(source("export const item = { id: 'a' };\n")), review('missing static identity in src/features/a/item.ts'));
  await check({ [registry]: nativeRegistry('', 'item', "import { item } from '../features/a/item';\n"), 'src/features/a/item.ts': "export const item = { id: 'a' } as const;\n" });
});

test('pending locales read only literal registered English dictionaries', async () => {
  const path = 'src/bootstrap/authoring-locales.ts';
  const base = { 'src/locales/en.json': '{"app":{"title":"App"}}' };
  const files = (modules, entries = 'one', imports = "import { one } from '../features/a/one.messages';\n") => ({ ...base, [path]: `${imports}export const authoringLocaleModules = [${entries}];\n`, ...modules });
  const skeleton = values => localeSkeleton(reader(values).read);
  assert.deepEqual(await skeleton(files({}, '', '')), { app: { title: 'App' } });
  assert.deepEqual(await skeleton(files({ 'src/features/a/one.messages.ts': "export const one = { en: { aOne: { title: 'One' } }, de: { aOne: { title: 'Eins' } } };\n" })), { app: { title: 'App' }, authoring: { aOne: { title: 'One' } } });
  const rejects = (values, message) => assert.rejects(skeleton(values), { message });
  await rejects({ ...base, [path]: 'export const authoringLocaleModules = {};\n' }, 'LOCALE_REGISTRY_UNSUPPORTED');
  await rejects(files({}, 'one.two'), 'LOCALE_REGISTRY_UNSUPPORTED');
  await rejects(files({}, 'one', "import { one } from './elsewhere';\n"), 'LOCALE_REGISTRY_IMPORT');
  await rejects(files({}, 'two'), 'LOCALE_REGISTRY_IMPORT');
  await rejects(files({ 'src/features/a/one.messages.ts': 'export let one;\n' }), 'LOCALE_DECLARATION_MISSING');
  await rejects(files({ 'src/features/a/one.messages.ts': 'export const one = { en: load() };\n' }), 'LOCALE_LITERAL_DICTIONARY_REQUIRED');
  await rejects(files({ 'src/features/a/one.messages.ts': "export const one = { en: { __proto__: 'x' } };\n" }), 'LOCALE_LITERAL_DICTIONARY_REQUIRED');
  await rejects(files({ 'src/features/a/one.messages.ts': "export const one = { en: { ...other } };\n" }), 'LOCALE_LITERAL_DICTIONARY_REQUIRED');
  await rejects(files({ 'src/features/a/one.messages.ts': "export const one = { de: { a: 'b' } };\n" }), 'LOCALE_ENGLISH_DICTIONARY_MISSING');
  await rejects(files({ 'src/features/a/one.messages.ts': "export const one = 'text';\n" }), 'LOCALE_ENGLISH_DICTIONARY_MISSING');
  await rejects(files({ 'src/features/a/one.messages.ts': "export const one = { en: { a: {} } };\nexport const two = { en: { a: {} } };\n" }, 'one, two', "import { one, two } from '../features/a/one.messages';\n"), 'LOCALE_NAMESPACE_COLLISION');
});

test('the plugin recipe requires the SDK and extends only an explicit plugin registry', async t => {
  const sdk = registrySource => ({ 'plugins/api.ts': 'export {};\n', 'plugins/runtime.ts': 'export {};\n', 'plugins/registry.ts': registrySource });
  const run = async (files, name = 'demo') => pluginRecipe(createMakerContext(await project(t, files)), name);
  await assert.rejects(run({}), { message: /^PLUGIN_SDK_REQUIRED/ });
  const rejects = (registrySource, message) => assert.rejects(run(sdk(registrySource)), { message });
  await rejects('export const pluginRegistry = [', 'PLUGIN_REGISTRY_PARSE_ERROR');
  await rejects("import { a } from './a';\nexport const pluginRegistry = [a, load()];\n", 'PLUGIN_REGISTRY_UNSUPPORTED_SHAPE');
  await rejects("import { a } from './a';\nexport const plugins = [a];\n", 'PLUGIN_REGISTRY_UNSUPPORTED_SHAPE');
  await rejects("import { a } from './a';\nexport const pluginRegistry = Object.freeze([a], 1);\n", 'PLUGIN_REGISTRY_UNSUPPORTED_SHAPE');
  await rejects('export const pluginRegistry = [];\n', 'PLUGIN_REGISTRY_IMPORTS_MISSING');
  await rejects("import { DemoPlugin } from './other';\nexport const pluginRegistry = [];\n", 'PLUGIN_REGISTRY_CONFLICT:DemoPlugin');
  await rejects("import { PluginObject as DemoPlugin } from './demo/src/index.ts';\nexport const pluginRegistry = [];\n", 'PLUGIN_REGISTRY_CONFLICT:demo');
  await rejects("import { a } from './a';\nexport const pluginRegistry = [a, DemoPlugin];\n", 'PLUGIN_REGISTRY_CONFLICT:demo');
  const frozen = createMakerContext(await project(t, sdk("import { a } from './a';\nexport let pluginRegistry;\nexport const pluginRegistry2 = [];\npluginRegistry = Object.freeze([a,]);\nexport const pluginRegistry = Object.freeze([a,]);\n")));
  await pluginRecipe(frozen, 'demo');
  assert.match(await frozen.read('plugins/registry.ts'), /Object\.freeze\(\[a, DemoPlugin\]\)/);
  const plain = createMakerContext(await project(t, sdk("import { a } from './a';\nexport const pluginRegistry = [];\n")));
  await pluginRecipe(plain, 'demo');
  assert.match(await plain.read('plugins/registry.ts'), /import \{ PluginObject as DemoPlugin \} from '\.\/demo\/src\/index\.ts';\nexport const pluginRegistry = \[DemoPlugin\]/);
  const unreadable = createMakerContext(await project(t, { 'plugins/api.ts': 'export {};\n' }));
  await mkdir(join(unreadable.root, 'plugins/runtime.ts'));
  await assert.rejects(pluginRecipe(unreadable, 'demo'), { message: 'PLAN_FILE_CONFLICT: plugins/runtime.ts' });
});

test('style and custom recipes refuse foreign views and malformed local registries', async t => {
  const root = await project(t, {
    'src/presentation/components/generated/a-view.vue': '<template><section class="shell-authoring-b-view" /></template>\n',
    'scripts/makers/custom/registry.mjs': 'export const customMakers = {};\n',
  });
  const context = createMakerContext(root);
  await assert.rejects(styleRecipe(context, 'a', 'card', 'view'), { message: 'STYLE_OWNER_MISMATCH: select a generated view owned by this feature' });
  const request = { maker: 'reminder', name: 'x', owner: 'a', options: {}, entity: undefined, folder: 'A', preset: 'title', backend: 'markdown' };
  await assert.rejects(runCustom(context, request), { message: 'CUSTOM_REGISTRY_INVALID' });
  // Each recipe name is its own module URL, so the rewritten registry is read afresh.
  await writeFile(join(root, 'scripts/makers/custom/registry.mjs'), "export const customMakers = [{ name: 'stale', version: 2, plan() {} }, 'stale'];\n");
  await assert.rejects(runCustom(createMakerContext(root), { ...request, maker: 'stale' }), { message: 'Unknown maker. Use --list for the implemented catalog.' });
  await writeFile(join(root, 'scripts/makers/custom/registry.mjs'), "export const customMakers = [{ name: 'notes', version: 1, description: 'Reminder', async plan(context, request) { await context.add('notes/' + request.name + '.md', request.owner + '\\n'); } }];\n");
  const custom = createMakerContext(root);
  await runCustom(custom, { ...request, maker: 'notes' });
  assert.deepEqual((await custom.finish()).changes.map(change => [change.path, change.status]), [['notes/x.md', 'create'], ['scripts/makers/custom/registry.mjs', 'unchanged']]);
});
