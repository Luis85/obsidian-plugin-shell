const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';

import { fileURLToPath } from 'node:url';
import { defineFrameworkAdapter } from '../compiler/adapters/project/framework-adapter.ts';
import { frameworkAdapter, requireFrameworkAdapter } from '../compiler/adapters/project/framework-registry.ts';
import { packageFiles, typecheckFiles } from '../compiler/adapters/project/configuration.ts';
import { renderStarterProject } from '../compiler/adapters/project/emitter.ts';
import { companionFrontend } from '../compiler/adapters/frontend.ts';
import { starterDocumentText } from '#shared/testing/starter-documents.mjs';

// Drives the project-starter host adapters (src/cli/compiler/adapters/project/*) through their refusal paths.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = starterDocumentText('blank');
const frontend = companionFrontend('blank.json');
const model = frontend.validate(JSON.parse(source));
const pins = { typescript: '6.0.3', '@types/node': '24.0.0', obsidian: '1.13.0', vite: '7.0.0', vue: '3.5.0', pinia: '3.0.0', '@nuxt/ui': '4.0.0',
  '@vitejs/plugin-vue': '6.0.0', '@iconify-json/lucide': '1.2.0', postcss: '8.5.0', 'postcss-selector-parser': '7.1.0', tailwindcss: '4.1.0', 'vue-tsc': '3.0.0' };
const template = (pkg = { devDependencies: pins }) => Object.freeze({ fingerprint: 'fixture', frameworkFiles: [], skillFiles: [],
  text(path) { if (path === 'package.json') return JSON.stringify(pkg); throw new Error('unexpected template read ' + path); } });
const starter = { id: 'fixture', version: '1.0.0', sha256: 'a'.repeat(64) };
const selection = (framework, targets, projectType = targets.length > 1 ? 'hybrid' : targets[0]) => ({ schemaVersion: 2, starter, projectType, framework, targets });
const failsWith = code => error => error?.diagnostic?.code === code;
const parsed = files => JSON.parse(files['package.json']);

test('framework adapter definitions validate identity, engine, contributor and exact pins', () => {
  const valid = { id: 'react', label: 'React', engine: 'vanilla' };
  assert.ok(Object.isFrozen(defineFrameworkAdapter(valid)));
  for (const invalid of [undefined, { ...valid, id: 'Bad' }, { ...valid, id: 'a'.repeat(65) }, { ...valid, label: '' },
    { ...valid, engine: 'svelte' }, { ...valid, files: 'not-a-function' }])
    assert.throws(() => defineFrameworkAdapter(invalid), /FRAMEWORK_ADAPTER_INVALID/);
  assert.throws(() => defineFrameworkAdapter({ ...valid, dependencies: { react: '^19.0.0' } }), /FRAMEWORK_ADAPTER_DEPENDENCY_INVALID/);
  assert.throws(() => defineFrameworkAdapter({ ...valid, devDependencies: { 'bad name': '1.0.0' } }), /FRAMEWORK_ADAPTER_DEV_DEPENDENCY_INVALID/);
  assert.throws(() => defineFrameworkAdapter({ ...valid, dependencies: { react: '19.0.0' }, devDependencies: { react: '19.0.0' } }), /DEPENDENCY_SCOPE_CONFLICT:react/);
  assert.equal(defineFrameworkAdapter({ ...valid, dependencies: { react: '19.0.0-rc.1' }, files: () => ({}) }).dependencies.react, '19.0.0-rc.1');
});

test('the registry resolves built-in and contributed adapters and refuses duplicates', () => {
  assert.equal(requireFrameworkAdapter('nuxtui').engine, 'nuxtui');
  assert.equal(frameworkAdapter('react'), undefined);
  assert.equal(frameworkAdapter('react', [{ id: 'react', label: 'React', engine: 'vanilla' }]).id, 'react');
  assert.throws(() => requireFrameworkAdapter('react'), /FRAMEWORK_ADAPTER_MISSING:react/);
  assert.throws(() => frameworkAdapter('vanilla', [{ id: 'vanilla', label: 'Again', engine: 'vanilla' }]), /FRAMEWORK_ADAPTER_DUPLICATE:vanilla/);
});

test('package files copy exact engine pins, merge adapter pins and refuse scope or version conflicts', () => {
  const nuxt = parsed(packageFiles(template(), selection('nuxtui', ['plugin', 'webapp']), 'fixture', requireFrameworkAdapter('nuxtui')));
  assert.deepEqual(Object.keys(nuxt.dependencies), ['vue', 'pinia', '@nuxt/ui']);
  assert.equal(nuxt.scripts.typecheck, 'vue-tsc --noEmit --project tsconfig.json'); assert.equal(nuxt.scripts.start, 'npm run build && node scripts/serve.mjs');
  assert.equal(nuxt.devDependencies.obsidian, '1.13.0'); assert.equal(nuxt.scripts['build:prototype'], 'node scripts/build.mjs --prototype');
  const cli = parsed(packageFiles(template(), selection('none', ['cli']), 'fixture', requireFrameworkAdapter('none')));
  assert.deepEqual(Object.keys(cli.devDependencies), ['typescript', '@types/node']); assert.equal(cli.scripts.start, undefined);
  assert.equal(cli.scripts['start:cli'], 'node dist/cli/src/plugin/targets/cli/main.js'); assert.equal(cli.scripts.typecheck, 'tsc --noEmit --project tsconfig.json');
  const react = { id: 'react', label: 'React', engine: 'vanilla', dependencies: { react: '19.0.0' }, devDependencies: { vite: '7.0.0' } };
  const merged = parsed(packageFiles(template(), selection('react', ['webapp']), 'fixture', react));
  assert.equal(merged.dependencies.react, '19.0.0'); assert.equal(merged.devDependencies.vite, '7.0.0');
  assert.throws(() => packageFiles(template(), selection('react', ['webapp']), 'fixture', { ...react, dependencies: { vite: '7.0.0' } }), failsWith('COMPILER_TEMPLATE_INVALID'));
  assert.throws(() => packageFiles(template(), selection('react', ['webapp']), 'fixture', { ...react, devDependencies: { vite: '7.0.1' } }), failsWith('COMPILER_TEMPLATE_INVALID'));
  assert.throws(() => packageFiles(template({ dependencies: { typescript: '^6.0.3' } }), selection('none', ['cli']), 'fixture', requireFrameworkAdapter('none')), failsWith('COMPILER_TEMPLATE_INVALID'));
  const angularPins = { '@angular/core': '20.0.0', '@angular/compiler-cli': '20.0.0' };
  const angular = parsed(packageFiles(template(), { ...selection('angular', ['website']), angularPins }, 'fixture', requireFrameworkAdapter('angular')));
  assert.equal(angular.dependencies['@angular/core'], '20.0.0'); assert.equal(angular.devDependencies['@angular/compiler-cli'], '20.0.0');
  assert.ok(angular.devDependencies['@babel/core']); assert.match(angular.scripts.typecheck, /^ngc /);
  const configs = typecheckFiles({ ...selection('angular', ['plugin', 'cli']) }, requireFrameworkAdapter('angular'));
  assert.ok(configs['configs/types/tsconfig.angular.json'] && configs['configs/types/tsconfig.cli.json']);
});

test('the starter emitter refuses mismatched or unsupported adapters and unsafe contributed files', () => {
  const vanilla = selection('vanilla', ['webapp']);
  assert.throws(() => renderStarterProject(model, template(), vanilla, requireFrameworkAdapter('nuxtui')), /FRAMEWORK_ADAPTER_SELECTION_MISMATCH:vanilla/);
  const svelte = selection('svelte', ['webapp']);
  assert.throws(() => renderStarterProject(model, template(), svelte, { id: 'svelte', label: 'Svelte', engine: 'nuxtui' }), /FRAMEWORK_ADAPTER_ENGINE_UNSUPPORTED:svelte/);
  const react = selection('react', ['webapp']);
  for (const files of [{ 'src/plugin/core/evil.ts': 'x' }, { 'src/ui/../evil.ts': 'x' }, { 'src/ui/ok.ts': 1 }])
    assert.throws(() => renderStarterProject(model, template(), react, { id: 'react', label: 'React', engine: 'vanilla', files: () => files }), /FRAMEWORK_ADAPTER_FILE_INVALID:react/);
  const contributed = renderStarterProject(model, template(), react, { id: 'react', label: 'React', engine: 'vanilla', files: () => ({ 'src/ui/App.tsx': 'app' }) });
  const paths = contributed.map(file => file.path);
  assert.equal(contributed.find(file => file.path === 'src/ui/App.tsx').content, 'app');
  assert.ok(paths.includes('src/ui/mount.ts') && paths.includes('scripts/serve.mjs') && paths.includes('src/plugin/targets/webapp/main.ts'));
  assert.ok(contributed.find(file => file.path === 'src/plugin/core/project.ts').origins.length === model.screens.length);
  const cli = renderStarterProject(model, template(), selection('none', ['cli'])).map(file => file.path);
  assert.ok(cli.includes('src/plugin/targets/cli/main.ts') && !cli.includes('src/ui/styles.css') && !cli.includes('scripts/serve.mjs'));
});
