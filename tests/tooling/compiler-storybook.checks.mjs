import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStorybookOptions } from '../../scripts/companion/storybook-contract.mjs';
import { validateAuthoringDocument, migrateAuthoringDocument, authoringReader, authoringDesignKey } from '../../scripts/companion/authoring-contract.ts';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { storybookCode, storybookPackage } from '../../scripts/companion/compiler/storybook-code.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { parseCliArguments, canonicalRequest } from '../../scripts/framework/catalog.ts';
import { starterProjectPlan, completeStarterProject } from '../../scripts/framework/starter-project.ts';
import { planProject, applyProject } from '../../scripts/companion/compiler/plan.ts';

const storybookVersions = { storybook: '10.6.0', '@storybook/vue3-vite': '10.6.0', '@storybook/addon-docs': '10.6.0' };
const root = fileURLToPath(new URL('../../', import.meta.url));
const legacy = JSON.parse(await readFile(join(root, 'tests/fixtures/companion/detail-v3.json'), 'utf8'));
const fixture = migrateAuthoringDocument(legacy).document;
const clone = options => {
  const document = structuredClone(fixture);
  if (options !== undefined) document.design.storybook = options;
  return document;
};
const emitted = document => {
  const files = new Map(); storybookCode(projectModel(document), (path, content, ownership = 'extension') => files.set(path, { path, content, ownership }));
  return files;
};
const template = await loadTemplateSnapshot(root);
const compile = document => compileProject({ source: JSON.stringify(document), template });

for (const enabled of [false, true]) for (const generateStories of [false, true]) test(`Storybook opt-ins remain independent: tooling=${enabled}, stories=${generateStories}`, async () => {
  const document = clone({ enabled, generateStories }), before = JSON.stringify(document);
  const model = projectModel(document), files = emitted(document);
  const pkg = { scripts: { test: 'vitest run' }, devDependencies: { typescript: '6.0.3' } };
  storybookPackage(model, pkg);
  assert.equal(files.has('.storybook/main.ts'), enabled);
  assert.equal([...files.keys()].some(path => path.endsWith('.stories.ts')), generateStories);
  assert.equal(Boolean(pkg.devDependencies.storybook), enabled);
  assert.equal(Boolean(pkg.scripts.storybook), enabled);
  assert.equal(pkg.scripts.test, 'vitest run'); assert.equal(JSON.stringify(document), before);
  if (enabled) for (const [name, version] of Object.entries(storybookVersions)) assert.equal(pkg.devDependencies[name], version);
});
test('omission is opt-out, never installs/configures files and never normalizes caller data', () => {
  assert.deepEqual(validateStorybookOptions(), { enabled: false, generateStories: false });
  assert.deepEqual(validateStorybookOptions({}), { enabled: false, generateStories: false });
  assert.equal(emitted(clone()).size, 0);
  const pkg = { scripts: {} }; storybookPackage(projectModel(clone()), pkg); assert.deepEqual(pkg, { scripts: {} });
});
test('namespace rejects coercion, unknown fields, arrays, null and inherited opt-ins', () => {
  for (const options of [null, true, [], 'yes', { enabled: 'true' }, { generateStories: 1 }, { enabled: undefined }, { install: true },
    Object.create({ enabled: true }), JSON.parse('{"__proto__":true}')]) {
    assert.throws(() => validateStorybookOptions(options), /COMPANION_INVALID: design.storybook/);
  }
});
test('current reader validates and round-trips explicit opt-ins on legacy and v6 imports without weakening the envelope', () => {
  for (const input of [legacy, fixture]) {
    const document = structuredClone(input); document.design.storybook = { generateStories: true };
    const before = JSON.stringify(document);
    assert.equal(validateAuthoringDocument(document), document);
    assert.deepEqual(authoringReader.migrate(document).document.design.storybook, { generateStories: true });
    assert.deepEqual(migrateAuthoringDocument(document).document.design.storybook, { generateStories: true });
    assert.equal(JSON.stringify(document), before);
    document.design.surprise = true; assert.throws(() => validateAuthoringDocument(document));
  }
  assert.equal(authoringDesignKey('storybook'), true); assert.equal(authoringDesignKey('execute'), false);
});
test('stories-only output preserves package and lock bytes and ordinary project typechecking', async () => {
  const baseline = await compile(clone()), stories = await compile(clone({ generateStories: true }));
  assert.equal(baseline.status, 'ok'); assert.equal(stories.status, 'ok', JSON.stringify(stories.diagnostics));
  for (const path of ['package.json', 'package-lock.json', 'tsconfig.project.json']) {
    assert.equal(stories.artifacts.find(f => f.path === path).content, baseline.artifacts.find(f => f.path === path).content, path);
  }
  assert.equal(stories.artifacts.some(f => f.path === '.storybook/main.ts'), false);
  assert.equal(stories.artifacts.filter(f => f.path.startsWith('src/')).some(f => /from ['"](?:@storybook\/|storybook\/)/.test(f.content)), false);
});
test('tooling adds exact dev-only pins and explicitly unresolved readiness, not a fabricated lockfile', async () => {
  const baseline = await compile(clone()), both = await compile(clone({ enabled: true, generateStories: true }));
  assert.equal(both.status, 'ok', JSON.stringify(both.diagnostics));
  const files = new Map(both.artifacts.map(f => [f.path, f.content]));
  assert.equal(files.get('package-lock.json'), baseline.artifacts.find(f => f.path === 'package-lock.json').content);
  assert.equal(both.readiness.dependencies, 'resolution-required');
  assert.ok(both.diagnostics.some(d => d.code === 'COMPILER_DEPENDENCY_RESOLUTION_REQUIRED'));
  const pkg = JSON.parse(files.get('package.json'));
  assert.ok(!Object.keys(pkg.dependencies ?? {}).some(name => name.includes('storybook')));
  assert.doesNotMatch(pkg.scripts['verify:project'], /storybook/);
  assert.match(files.get('.storybook/main.ts'), /disableTelemetry: true/);
  assert.match(files.get('.storybook/main.ts'), /viteConfigPath/);
  assert.match(files.get('.storybook/vite.config.mjs'), /sharedConfig/);
});
test('declared dependency conflicts are refused instead of silently replacing consumer pins', () => {
  const model = projectModel(clone({ enabled: true }));
  for (const pkg of [{ scripts: {}, devDependencies: { storybook: '9.0.0' } }, { scripts: {}, dependencies: { storybook: '10.6.0' } }]) {
    const before = JSON.stringify(pkg); assert.throws(() => storybookPackage(model, pkg), /GENERATOR_INVALID/); assert.equal(JSON.stringify(pkg), before);
  }
});
test('generated stories import real generated Vue, map states/scenarios/variants, and preserve falsy prop defaults', async () => {
  const document = clone({ generateStories: true });
  const component = document.design.visualDesigns.components[0];
  component.props.push({ name: 'previewNumber', type: 'number', required: true, default: 0 },
    { name: 'previewText', type: 'string', required: false, default: '' }, { name: 'previewFlag', type: 'boolean', required: true, default: false },
    { name: 'syntheticText', type: 'string', required: true });
  component.variants = [{ id: 'one', name: '</script>same', values: { previewFlag: false } }, { id: 'two', name: '</script>same', values: { previewNumber: 0 } }];
  for (const definition of [...document.design.visualDesigns.pages, ...document.design.visualDesigns.components]) {
    for (const node of visualNodes(definition.root ?? definition.template)) if (node.kind === 'component' && node.ref.kind === 'project' && node.ref.componentId === component.id && !node.ref.revisionId) {
      for (const [name, value] of Object.entries({ previewNumber: 0, previewFlag: false, syntheticText: 'Example' })) node.props[name] = { kind: 'literal', value };
    }
  }
  const result = await compile(document); assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const files = new Map(result.artifacts.map(f => [f.path, f.content]));
  const manifest = JSON.parse(files.get('.storybook/generated/manifest.json'));
  const entry = manifest.entries.find(e => e.source === '/design/visualDesigns/components/0');
  assert.ok(entry.syntheticProps.includes('syntheticText'));
  const text = files.get(entry.file); assert.match(text, /"previewNumber":0/); assert.match(text, /"previewText":""/); assert.match(text, /"previewFlag":false/);
  assert.match(text, /export const Loading/); assert.match(text, /export const Disabled/);
  assert.match(text, /Variant_6f_6e_65/); assert.match(text, /Variant_74_77_6f/); assert.doesNotMatch(text, /<\/script>/);
  for (const entry of manifest.entries) {
    const imported = /import Subject from ("[^"]+")/.exec(files.get(entry.file));
    assert.ok(imported, entry.file);
    assert.ok(files.has(posix.normalize(posix.join(posix.dirname(entry.file), JSON.parse(imported[1])))), entry.file);
  }
  for (const scenario of component.scenarios) assert.ok(text.includes(JSON.stringify(scenario.id)));
  assert.match(files.get('.storybook/generated/project-preview.ts'), /disposePinia/);
  assert.match(files.get('.storybook/generated/project-preview.ts'), /createClickdummySources/);
  assert.doesNotMatch(files.get('.storybook/generated/project-preview.ts'), /from ['"]obsidian|fetch\(|localStorage/);
});
test('custom source folders cannot pull optional stories into runtime typechecking and generation is deterministic', () => {
  const document = clone({ generateStories: true }); document.settings = { codebaseFolder: 'app sources', testsFolder: 'quality tests' };
  const files = emitted(document);
  assert.deepEqual(files, emitted(document));
  for (const [path, entry] of files) assert.ok(path.startsWith('.storybook/generated/'), path);
  assert.match([...files.values()].find(f => f.path.endsWith('.stories.ts')).content, /app sources\/generated/);
});
test('new CLI opt-ins are independent and participate in reviewed plan hashes', () => {
  for (const flag of ['storybook', 'storybook-stories']) {
    const request = parseCliArguments(['new', '../sample', '--starter', 'blank', '--' + flag]);
    assert.equal(canonicalRequest(request).options[flag], true);
    assert.equal(request.options[flag === 'storybook' ? 'storybook-stories' : 'storybook'], undefined);
  }
  assert.throws(() => parseCliArguments(['generate', '--storybook']), /not supported/);
});
test('new plan persists opted-in JSON and gives npm install guidance only for unresolved dependencies', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'storybook-new-')); t.after(() => rm(temp, { recursive: true, force: true }));
  const directory = join(temp, 'example'); const context = { root, frameworkRoot: root };
  const request = parseCliArguments(['new', directory, '--starter', 'blank', '--storybook', '--storybook-stories']);
  const plan = await starterProjectPlan(request, context);
  assert.equal(plan.summary.compiler.readiness.dependencies, 'resolution-required');
  const applied = { command: 'new', status: 'applied', data: { summary: plan.summary } };
  const result = await completeStarterProject(applied, request, context);
  assert.ok(result.data.nextSteps.includes('npm install')); assert.ok(!result.data.nextSteps.includes('npm ci'));
  assert.equal(result.data.install, undefined);
  const ordinary = { ...applied, data: { summary: { directory } } };
  assert.ok((await completeStarterProject(ordinary, request, context)).data.nextSteps.includes('npm ci'));
});
test('malformed opt-ins fail compilation with actionable schema diagnostics and no artifacts', async () => {
  const result = await compile(clone({ enabled: 'yes' }));
  assert.equal(result.status, 'failed'); assert.equal(result.artifacts.length, 0);
  assert.equal(result.diagnostics[0].code, 'COMPILER_SCHEMA_INVALID'); assert.match(result.diagnostics[0].message, /design.storybook/);
});

test('reviewed regeneration is idempotent, protects custom stories/config, and never deletes retired files', async t => {
  const vault = await mkdtemp(join(tmpdir(), 'storybook-owned-')); t.after(() => rm(vault, { recursive: true, force: true }));
  const options = { vault, input: join(vault, 'project.json'), target: 'product', templateRoot: root };
  const doc = clone({ enabled: true, generateStories: true });
  await writeFile(options.input, JSON.stringify(doc));
  const first = await planProject(options); assert.deepEqual(first.conflicts, []); await applyProject(first, first.hash);
  const replay = await planProject(options); assert.ok(replay.plan.changes.every(change => change.status === 'unchanged'));
  const target = join(vault, 'product');
  const manifest = JSON.parse(await readFile(join(target, '.storybook/generated/manifest.json'), 'utf8'));
  const story = join(target, manifest.entries[0].file), original = await readFile(story, 'utf8');
  await writeFile(story, original + '\n// User-authored change\n');
  const conflict = await planProject(options); assert.ok(conflict.conflicts.some(message => message.includes(manifest.entries[0].file)));
  await assert.rejects(applyProject(conflict, conflict.hash), /conflicts/);
  await writeFile(story, original);
  const config = join(target, '.storybook/main.ts'); await writeFile(config, (await readFile(config, 'utf8')) + '\n// Consumer configuration\n');
  const manual = join(target, 'stories/own.stories.ts'); await mkdir(dirname(manual), { recursive: true }); await writeFile(manual, '// Manual story\n');
  const preserved = await planProject(options); assert.deepEqual(preserved.conflicts, []); assert.ok(preserved.preserved.includes('.storybook/main.ts'));
  await applyProject(preserved, preserved.hash); assert.equal(await readFile(manual, 'utf8'), '// Manual story\n');
  doc.design.storybook.generateStories = false; await writeFile(options.input, JSON.stringify(doc));
  const disabled = await planProject(options); assert.deepEqual(disabled.conflicts, []); await applyProject(disabled, disabled.hash);
  assert.equal(await readFile(story, 'utf8'), original); // Existing writer retains retired files for explicit user review.
});
