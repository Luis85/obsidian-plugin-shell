import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { visualNodes, visualRoot } from '../../scripts/companion/visual/visual-ir.mjs';
import { compileProject, loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { migrateAuthoringDocument, validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { withStorybookOptions, projectToolingSchema } from '../../scripts/companion/tooling-contract.ts';
import { storybookFlags } from '../../bin/adapters/framework/storybook-options.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
const root = fileURLToPath(new URL('../../', import.meta.url)), template = await loadTemplateSnapshot(root);
const source = await readFile(new URL('../fixtures/companion/detail-v3.json', import.meta.url), 'utf8');
const fixture = () => migrateAuthoringDocument(JSON.parse(source)).document;
const get = (r, path) => { const f = r.artifacts.find(f => f.path === path); assert.ok(f, path); return f.content; };
const compile = async (storybook, document, outputKind) => {
  const r = await compileProject({ source: document ? JSON.stringify(document) : source, sourceName: 'input.json', template, storybook, outputKind });
  assert.equal(r.status, 'ok', JSON.stringify(r.diagnostics)); return r;
};
function storyExports(content) {
  // Parse/execute only trusted emitted CSF structure, with explicit import doubles. This is not Vue rendering or a type check.
  let code = stripTypeScriptTypes(content, { mode: 'strip' }).replace(/^import .*;\s*$/gm, '');
  const names = [...code.matchAll(/export const (\w+)/g)].map(m => m[1]);
  code = code.replace('export default meta;', '').replaceAll('export const ', 'const ');
  return vm.runInNewContext(code + '\n({ meta, ' + names.join(', ') + ' });', { Subject: {}, withProject: () => {}, action: name => name, h: () => {} });
}
test('two independent defaults: neither, stories only, workspace only, both; root dependencies unchanged', async () => {
  const ordinary = await compile();
  for (const outputKind of ['obsidian-plugin', 'clickdummy']) {
    const baseline = outputKind === 'obsidian-plugin' ? ordinary : await compile(undefined, undefined, outputKind);
    for (const [enabled, generateStories] of [[false, false], [false, true], [true, false], [true, true]]) {
      const r = await compile({ enabled, generateStories }, undefined, outputKind);
      const storyPaths = r.artifacts.filter(f => f.path.endsWith('.stories.ts') && f.path.includes('/generated/'));
      assert.equal(storyPaths.length > 0, generateStories);
      assert.equal(r.artifacts.some(f => f.path === 'storybook/package.json'), enabled);
      assert.equal(r.artifacts.some(f => f.producer === 'storybook'), enabled || generateStories);
      assert.equal(get(r, 'package.json'), get(baseline, 'package.json'));
      assert.equal(get(r, 'package-lock.json'), get(baseline, 'package-lock.json'));
      assert.ok(!r.artifacts.some(f => f.path === 'storybook/package-lock.json'), 'never invent resolved dependencies');
      if (enabled) {
        const pkg = JSON.parse(get(r, 'storybook/package.json'));
        assert.equal(pkg.private, true); assert.equal(pkg.devDependencies.storybook, '10.6.0');
        assert.match(pkg.devDependencies.typescript, /^6\./);
        assert.equal(JSON.parse(get(r, 'storybook/.storybook/generated.json')).length, storyPaths.length);
      }
    }
  }
  assert.ok(!ordinary.artifacts.some(f => f.producer === 'storybook'));
});
test('optional configuration survives legacy migration and v6 without changing the caller input', async () => {
  for (const original of [JSON.parse(source), fixture()]) {
    original.tooling = { storybook: { generateStories: true } };
    const before = JSON.stringify(original), r = await compile(undefined, original);
    assert.equal(JSON.stringify(original), before);
    assert.equal(JSON.parse(get(r, 'design/project.json')).tooling.storybook.generateStories, true);
    assert.ok(!r.artifacts.some(f => f.path === 'storybook/package.json'));
    const overridden = await compile({ enabled: true, generateStories: false }, original);
    assert.equal(JSON.stringify(original), before);
    assert.deepEqual(JSON.parse(get(overridden, 'design/project.json')).tooling.storybook, { enabled: true, generateStories: false });
    assert.notEqual(r.fingerprint, overridden.fingerprint);
  }
});
test('strict flags reject malformed and unknown fields instead of silently enabling either feature', async () => {
  for (const tooling of [null, [], true, { unknown: true }, { storybook: null }, { storybook: [] }, { storybook: { enabled: 'true' } }, { storybook: { generateStories: 1 } }, { storybook: { install: true } }]) {
    const r = await compileProject({ source: JSON.stringify({ ...fixture(), tooling }) });
    assert.equal(r.status, 'failed', JSON.stringify(tooling));
    assert.ok(r.diagnostics.some(d => d.code === 'COMPILER_SCHEMA_INVALID'));
  }
  assert.throws(() => withStorybookOptions(fixture(), { enabled: null }));
  assert.throws(() => validateAuthoringDocument({ ...fixture(), unsupported: true }));
  assert.equal(projectToolingSchema().properties.storybook.properties.enabled.default, false);
});
test('CSF imports real generated Vue; all props, authored variants and scenarios retain stable identities', async () => {
  const doc = fixture(), c = doc.design.visualDesigns.components[0];
  c.props.push({ name: 'count', type: 'number', required: false, default: 0 }, { name: 'visible', type: 'boolean', required: false, default: false },
    { name: 'caption', type: 'string', required: false, default: '' }, { name: 'example', type: 'string', required: true });
  for (const definition of [...doc.design.visualDesigns.pages, ...doc.design.visualDesigns.components]) {
    for (const node of visualNodes(visualRoot(definition))) if (node.kind === 'component' && node.ref.kind === 'project' && node.ref.componentId === c.id) node.props.example = { kind: 'literal', value: 'Existing usage' };
  }
  c.variants[0].values = { count: 0, visible: false, caption: '' };
  c.scenarios.push({ id: 'vs-100', name: 'Empty / "quoted"', state: 'empty', width: 'narrow', values: {}, bindings: [] });
  doc.design.visualDesigns.nextId = 101;
  const r = await compile({ generateStories: true }, doc);
  const files = r.artifacts.filter(f => f.producer === 'storybook' && f.path.endsWith('.stories.ts'));
  assert.equal(files.length, r.model.components.length + r.model.screens.filter(s => !['action', 'group'].includes(s.kind)).length);
  for (const f of files) {
    const source = /import Subject from "([^"]+)"/.exec(f.content)[1];
    assert.ok(r.artifacts.some(a => a.path === posix.normalize(posix.join(dirname(f.path).replaceAll('\\', '/'), source))));
    const exports = storyExports(f.content);
    assert.ok(exports.Default); assert.equal(exports.meta.parameters.shell.businessAcceptance, 'not-inferred');
  }
  const path = 'storybook/generated/components/project-json-review.stories.ts';
  const emitted = get(r, path), values = storyExports(emitted);
  for (const [key, value] of Object.entries({ count: 0, visible: false, caption: '', example: 'Example example' })) assert.equal(values.meta.args[key], value);
  assert.equal(values.meta.args.onSelect, 'select'); assert.ok(values.meta.render);
  const scenario = Object.entries(values).find(([name]) => name.startsWith('Scenario'));
  assert.equal(scenario[1].args.designScenario, 'vs-100'); assert.equal(scenario[1].args.designState, undefined);
  assert.equal(scenario[1].parameters.shell.width, 'narrow');
  c.scenarios[0].name = 'Renamed'; c.variants.reverse();
  assert.ok(get(await compile({ generateStories: true }, doc), path).includes(`export const ${scenario[0]}:`));
  const origins = JSON.parse(get(r, 'design/compiler-origins.json')).artifacts.find(a => a.path === path);
  assert.equal(origins.origins[0].file, 'input.json'); assert.equal(origins.origins[0].entityId, c.id);
});
test('custom roots resolve correctly; placeholders are not represented as completed implementations', async () => {
  const doc = fixture(); doc.settings = { codebaseFolder: 'product/code', testsFolder: 'product/specs' };
  const r = await compile({ enabled: true, generateStories: true }, doc);
  assert.match(get(r, 'storybook/generated/components/project-json-review.stories.ts'), /\.\.\/\.\.\/\.\.\/product\/code\/generated/);
  for (const f of r.artifacts.filter(f => f.producer === 'storybook' && f.path.endsWith('.ts'))) stripTypeScriptTypes(f.content);
  const path = r.artifacts.find(f => f.producer === 'storybook' && f.content.includes('implementation-placeholder') && f.path.endsWith('.stories.ts')).path;
  const values = storyExports(get(r, path)); assert.equal(values.Loading, undefined);
  doc.settings.codebaseFolder = 'storybook';
  const bad = await compileProject({ source: JSON.stringify(doc), template, storybook: { enabled: true } });
  assert.equal(bad.status, 'failed'); assert.match(bad.diagnostics[0].message, /overlap/);
});
test('workspace separates managed inventory from custom configuration and guards retained disabled files', async () => {
  const r = await compile({ enabled: true, generateStories: true });
  assert.match(get(r, 'storybook/.storybook/main.ts'), /enabled !== true/);
  assert.match(get(r, 'storybook/.storybook/main.ts'), /generateStories === true \? generated : \[\]/);
  assert.match(get(r, 'storybook/.storybook/main.ts'), /disableTelemetry: true/);
  assert.match(get(r, 'storybook/vite.config.mjs'), /sharedConfig/);
  assert.equal(r.artifacts.find(f => f.path === 'storybook/.storybook/main.ts').ownership, 'extension');
  assert.equal(r.artifacts.find(f => f.path === 'storybook/.storybook/generated.json').ownership, 'managed');
  const host = get(r, 'storybook/generated/with-project.ts');
  for (const expected of [/disposePinia/, /app\.unmount/, /createClickdummySources/, /onBeforeUnmount/]) assert.match(host, expected);
  assert.doesNotMatch(host, /from ['"]obsidian['"]|fetch\(|localStorage/);
});
test('terminal and structured interfaces expose independent switches and reject truthy typos', async () => {
  assert.deepEqual(storybookFlags({}), undefined);
  assert.deepEqual(storybookFlags({ storybook: 'on', 'storybook-stories': 'off' }), { enabled: true, generateStories: false });
  for (const value of ['yes', 'false', '', true]) assert.throws(() => storybookFlags({ storybook: value }), /on or off|requires a value/);
  const request = parseCliArguments(['compiler', 'inspect', '--input', '-', '--storybook', 'on', '--storybook-stories', 'off']);
  const r = await executeOperation(request, { root, frameworkRoot: root, inputText: source });
  assert.equal(r.status, 'ok'); assert.deepEqual(r.data.ir.document.tooling.storybook, { enabled: true, generateStories: false });
  for (const command of ['new', 'generate', 'compiler check', 'compiler inspect', 'storybook status', 'storybook install', 'storybook dev', 'storybook check', 'storybook build']) {
    const help = await executeOperation({ command: 'help', args: command.split(' '), options: {} }, { root, frameworkRoot: root });
    assert.equal(help.status, 'ok'); assert.notEqual(help.data.commands[0].group, 'other');
    assert.ok(help.data.commands[0].examples.length);
  }
});
