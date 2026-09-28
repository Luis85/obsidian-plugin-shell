/** Consolidated negative and integration coverage from the two alternative Storybook proposals. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateTooling, airshipOptions, toolingSchema } from '../../scripts/companion/tooling-contract.mjs';
import { withStorybookOptions, storybookOptions } from '../../scripts/companion/tooling-contract.ts';
import { withAirshipOption } from '../../scripts/companion/tooling-options.ts';
import { migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const template = await loadTemplateSnapshot(root);
const source = JSON.parse(await readFile(new URL('../fixtures/companion/detail-v3.json', import.meta.url), 'utf8'));
const get = (result, path) => result.artifacts.find(file => file.path === path)?.content;
test('both integrations share one strict tooling schema and preserve independent defaults', () => {
  const schema = toolingSchema();
  assert.deepEqual(Object.keys(schema.properties).sort(), ['airship', 'storybook']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(storybookOptions({}), { enabled: false, generateStories: false });
  assert.equal(airshipOptions({ storybook: { enabled: true } }).enabled, false);
  assert.deepEqual(storybookOptions({ tooling: { airship: { enabled: true } } }), { enabled: false, generateStories: false });
});
test('data-only validation rejects inherited switches, accessors, symbols and undefined without invoking code', () => {
  let invoked = 0;
  const getter = Object.defineProperty({}, 'enabled', { enumerable: true, get() { invoked++; return true; } });
  const nestedGetter = Object.defineProperty({}, 'storybook', { enumerable: true, get() { invoked++; return {}; } });
  for (const value of [Object.create({ enabled: true }), getter, { [Symbol('enabled')]: true },
    Object.defineProperty({}, 'enabled', { value: true }), { enabled: undefined }, null, [], true]) {
    assert.throws(() => validateTooling({ storybook: value }));
    assert.throws(() => withStorybookOptions(source, value));
  }
  assert.throws(() => validateTooling(nestedGetter));
  assert.throws(() => validateTooling({ airship: getter }));
  assert.throws(() => validateTooling({ airship: undefined }));
  assert.equal(invoked, 0);
});
test('legacy migration and explicit CLI overrides retain the sibling integration without mutating input', () => {
  const original = { ...source, tooling: { airship: { enabled: true, agent: 'codex' }, storybook: { generateStories: true } } };
  const before = JSON.stringify(original);
  const migrated = migrateAuthoringDocument(original).document;
  const override = withStorybookOptions(migrated, { enabled: true });
  const final = withAirshipOption(override, { 'no-airship': true });
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(final.tooling.storybook, { enabled: true, generateStories: true });
  assert.equal(final.tooling.airship.enabled, false); assert.equal(final.tooling.airship.agent, 'codex');
  const request = parseCliArguments(['new', '../demo', '--airship', '--storybook', 'on', '--storybook-stories', 'off']);
  assert.equal(request.options.airship, true); assert.equal(request.options.storybook, 'on');
});
test('all eight option combinations compile deterministically without changing root dependency files', async () => {
  const baseline = await compileProject({ source: JSON.stringify(source), template });
  assert.equal(baseline.status, 'ok');
  for (const airship of [false, true]) for (const enabled of [false, true]) for (const generateStories of [false, true]) {
    const document = { ...source, tooling: { airship: { enabled: airship }, storybook: { enabled, generateStories } } };
    const input = { source: JSON.stringify(document), template };
    const result = await compileProject(input), replay = await compileProject(input);
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.equal(result.fingerprint, replay.fingerprint);
    assert.deepEqual(result.artifacts, replay.artifacts);
    for (const path of ['package.json', 'package-lock.json']) assert.equal(get(result, path), get(baseline, path));
    assert.equal(Boolean(get(result, 'storybook/package.json')), enabled);
    assert.equal(Boolean(get(result, 'storybook/generated/with-project.ts')), generateStories);
    assert.equal(Boolean(get(result, 'airship.config.json')), airship);
    assert.deepEqual(JSON.parse(get(result, 'design/project.json')).tooling, document.tooling);
  }
});
test('ESM builder uses a package specifier, exact dependency pin, and retained Vite options', async () => {
  const result = await compileProject({ source: JSON.stringify(source), template, storybook: { enabled: true } });
  assert.equal(result.status, 'ok');
  assert.match(get(result, 'storybook/.storybook/main.ts'), /name: '@storybook\/builder-vite'/);
  assert.doesNotMatch(get(result, 'storybook/.storybook/main.ts'), /name: packageRoot\('@storybook\/builder-vite'\)/);
  assert.equal(JSON.parse(get(result, 'storybook/package.json')).devDependencies['@storybook/builder-vite'], '10.6.0');
  assert.match(get(result, 'storybook/vite.config.mjs'), /\.\.\.config.resolve/);
});
test('superseded design.storybook input fails visibly instead of being silently ignored', async () => {
  const document = structuredClone(source); document.design.storybook = { enabled: true };
  const result = await compileProject({ source: JSON.stringify(document), template });
  assert.equal(result.status, 'failed'); assert.deepEqual(result.artifacts, []);
  assert.equal(result.diagnostics[0].code, 'COMPILER_SCHEMA_INVALID');
});

test('CSF source exposes statically indexable identifiers for titles, stable IDs, tags and scenario labels', async () => {
  const document = migrateAuthoringDocument(structuredClone(source)).document;
  document.design.visualDesigns.components[0].scenarios.push({ id: 'vs-100', name: 'Narrow empty preview', state: 'empty', width: 'narrow', values: {}, bindings: [] });
  document.design.visualDesigns.nextId = Math.max(document.design.visualDesigns.nextId, 101);
  const result = await compileProject({ source: JSON.stringify(document), template, storybook: { generateStories: true } });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const code = get(result, 'storybook/generated/components/project-json-review.stories.ts');
  assert.match(code, /^  id: "generated-component-project-json-review"/m);
  assert.match(code, /^  title: "Components\//m);
  assert.match(code, /^  tags: \["autodocs"\]/m);
  assert.match(code, /^  name: "Narrow empty preview"/m);
  assert.doesNotMatch(code, /^  "(?:id|title|tags|name)":/m);
});

test('story host binds simulated host variables, generated identity and authored dark tokens on the same root', async () => {
  const result = await compileProject({ source: JSON.stringify(source), template, storybook: { generateStories: true } });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const host = get(result, 'storybook/generated/with-project.ts');
  assert.match(host, /class: \['obsidian-harness', owner, 'ps--' \+ owner/);
  assert.match(host, /'theme-dark dark'/);
  assert.match(host, /background: 'var\(--' \+ owner \+ '-surface, var\(--background-primary\)\)'/);
  assert.match(host, /color: 'var\(--' \+ owner \+ '-text, var\(--text-normal\)\)'/);
  assert.doesNotMatch(host, /document\.body\.classList/);
});
