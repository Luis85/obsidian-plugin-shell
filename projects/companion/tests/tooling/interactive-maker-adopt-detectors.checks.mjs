import assert from 'node:assert/strict';
import { analyzeInventory } from '../../bin/application/adoption/analyze.ts';
import { builderClass } from '../../bin/domain/adoption/angular.ts';
import { InventoryView, parseLooseJson } from '../../bin/domain/adoption/source.ts';
import { majorOf, rangeAdmitsMajor, versionOf } from '../../bin/domain/adoption/version.ts';
import { inventoryOf, noTargets, targets } from './interactive-maker-adopt-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const analyze = (files, options = {}, target = targets) => analyzeInventory(inventoryOf(files, options), target, null);
const ids = report => report.findings.map(item => item.id);
const pkg = (dependencies = {}, extra = {}) => ({ name: 'sample', dependencies, ...extra });
const component = (extra = '') => `import { Component } from '@angular/core';\n@Component({ selector: 'a', ${extra} template: '' })\nexport class A {}\n`;

test('version helpers read majors, versions and ranges without a resolver', () => {
  assert.equal(majorOf('^17.3.1'), 17); assert.equal(majorOf('~15.2'), 15); assert.equal(majorOf('v20'), 20);
  assert.equal(majorOf('latest'), null); assert.equal(majorOf(null), null); assert.equal(majorOf('workspace:*'), null);
  assert.equal(versionOf('^17.3.1'), '17.3.1'); assert.equal(versionOf('18'), null); assert.equal(versionOf('22.0.0-next.1'), '22.0.0-next.1');
  const admits = (range, major) => rangeAdmitsMajor(range, major);
  assert.equal(admits('^14.20.0 || ^16.13.0 || ^18.10.0', 24), false); assert.equal(admits('^20.19.0 || ^22.12.0 || ^24.0.0', 24), true);
  assert.equal(admits('>=18', 24), true); assert.equal(admits('>=18 <21', 24), false); assert.equal(admits('>18', 24), true); assert.equal(admits('>24', 24), false);
  assert.equal(admits('<=22', 24), false); assert.equal(admits('<25', 24), true); assert.equal(admits('<24.5.0', 24), true); assert.equal(admits('24.x', 24), true);
  assert.equal(admits('*', 24), true); assert.equal(admits('', 24), true); assert.equal(admits('18 - 20', 24), null); assert.equal(admits('lts/*', 24), null);
  assert.equal(admits(null, 24), null); assert.equal(admits('=24', 24), true); assert.equal(admits('~23.1', 24), false); assert.equal(admits('^18 || lts/*', 24), null);
});
test('loose JSON accepts comments and trailing commas but never strips string content, and the view records malformed files', () => {
  assert.deepEqual(parseLooseJson('﻿// head\n{ "a": "x // not a comment", /* c */ "b": [1, 2,], }'), { a: 'x // not a comment', b: [1, 2] });
  assert.throws(() => parseLooseJson('{ "a": '));
  const view = new InventoryView(inventoryOf({ 'package.json': '{ "name": ', 'ok.json': '{"a":1}', 'src/a.ts': 'x', 'src/b/c.ts': 'y', 'empty.json': null }));
  assert.equal(view.json('package.json'), undefined); assert.equal(view.json('package.json'), undefined);
  assert.deepEqual(view.malformed, ['package.json']); assert.equal(view.json('missing.json'), undefined); assert.deepEqual(view.json('ok.json'), { a: 1 });
  assert.equal(view.has('src/a.ts'), true); assert.equal(view.hasDirectory('src'), true); assert.equal(view.hasDirectory('sr'), false);
  assert.equal(view.count(/\.ts$/), 2); assert.deepEqual(view.texts(/\.json$/).map(([path]) => path), ['ok.json', 'package.json']); assert.equal(view.text('empty.json'), undefined);
  assert.deepEqual(view.paths.slice(0, 3), ['empty.json', 'ok.json', 'package.json']);
});
test('builder identifiers map to build-tool classes', () => {
  const expected = { '@angular/build:application': 'application', '@angular-devkit/build-angular:application': 'application', '@angular-devkit/build-angular:browser-esbuild': 'esbuild',
    '@angular-devkit/build-angular:browser': 'webpack', '@nx/angular:webpack-browser': 'webpack', '@angular-devkit/build-angular:ng-packagr': 'library', '@nx/angular:package': 'library', '@angular/build:karma': 'other' };
  for (const [builder, kind] of Object.entries(expected)) assert.equal(builderClass(builder), kind, builder);
  assert.equal(builderClass(null), 'none');
});
test('package facts merge nested manifests, prefer the root file and read pins and managers', () => {
  const report = analyze({ 'package.json': pkg({ '@angular/core': '^17.0.0' }, { packageManager: 'pnpm@9.1.0+sha512.abc', engines: { node: '>=20' }, scripts: { build: 'x', test: 'y' }, workspaces: { packages: ['apps/*'] } }),
    'client/package.json': pkg({ '@angular/core': '^15.0.0', rxjs: '7.8.0' }), 'pnpm-lock.yaml': 'x', '.nvmrc': '# comment\nv20.11.0\n', '.node-version': '20.11.1', '.tool-versions': 'ruby 3.2.0\nnodejs 20.11.2\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true}}', 'tsconfig.app.json': '{}' });
  assert.deepEqual(report.runtime.packageManager, { name: 'pnpm', version: '9.1.0', lockfiles: ['pnpm-lock.yaml'] });
  assert.deepEqual(report.runtime.node, { engines: '>=20', nvmrc: 'v20.11.0', nodeVersionFile: '20.11.1', toolVersions: '20.11.2' });
  assert.equal(report.angular.major, 17); assert.deepEqual(report.runtime.scripts, ['build', 'test']); assert.equal(report.tooling.workspaces[0], 'apps/*'); assert.ok(report.tooling.monorepo.includes('package-workspaces'));
  assert.equal(report.runtime.typescript.strict, true);
  const flat = analyze({ 'package.json': pkg({}, { workspaces: ['a', 5] }), 'yarn.lock': 'x', 'bun.lockb': null });
  assert.equal(flat.runtime.packageManager.name, 'yarn'); assert.ok(ids(flat).includes('MULTIPLE_LOCKFILES')); assert.deepEqual(flat.tooling.workspaces, ['a']);
  assert.equal(analyze({ 'package.json': '[]' }).angular, null);
  assert.equal(analyze({ 'package.json': pkg({ '@angular/core': 3 }) }).angular, null);
});
test('angular detection reads workspaces, builders, source counts, routing and optional features', () => {
  const report = analyze({
    'package.json': pkg({ '@angular/core': '^21.0.0', '@angular/material': '^21', '@angular/cdk': '^21', '@ngrx/store': '^21', '@angular/ssr': '^21', '@ngx-translate/core': '^16' }),
    'angular.json': { projects: { app: { projectType: 'application', root: '', architect: { build: { builder: '@angular/build:application', i18n: true }, test: { builder: '@angular/build:karma' } } }, lib: { projectType: 'library', root: 'projects/lib', targets: { build: { builder: '@angular/build:ng-packagr' } } } } },
    'src/main.ts': 'import { bootstrapApplication } from "@angular/platform-browser";\nbootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });',
    'src/app/app.routes.ts': "export const routes: Routes = [{ path: '', redirectTo: 'home' }, { path: 'home', component: A }, { path: '**', component: A }, { path: ':id', component: A }, { path: 'a b', component: A }, { path: \"orders/:id\", component: A }, { path: 'home', component: A }];",
    'src/app/a.component.ts': component('standalone: true,') + 'export const count = signal(0); const d = computed(() => 1); const i = input.required<string>();',
    'src/app/b.component.ts': component('standalone: false,') + '@Input() x = 1; @Injectable() class S {} @Pipe() class P {} @Directive() class D {}',
    'src/app/a.component.spec.ts': component(), 'src/types.d.ts': component(), 'messages.xlf': 'x', 'server.ts': 'x',
  });
  const angular = report.angular;
  assert.equal(angular.major, 21); assert.equal(angular.version, '21.0.0'); assert.equal(angular.workspace, 'angular.json');
  assert.deepEqual(angular.projects.map(item => [item.name, item.builderClass, item.root]), [['app', 'application', ''], ['lib', 'library', 'projects/lib']]);
  assert.deepEqual(angular.builders, ['@angular/build:application', '@angular/build:karma', '@angular/build:ng-packagr']);
  assert.deepEqual(angular.sourceCounts, { components: 2, standaloneComponents: 1, ngModules: 0, services: 1, pipes: 1, directives: 1, signalCalls: 3, decoratorInputs: 1, sourceFiles: 5 });
  assert.deepEqual(angular.routing, { files: ['src/app/app.routes.ts'], routeCountEstimate: 7, paths: ['home', 'orders/:id'] });
  assert.deepEqual(angular.libraries, ['Angular CDK', 'Angular Material']); assert.deepEqual(angular.stateManagement, ['NgRx Store']);
  assert.equal(angular.ssr, true); assert.equal(angular.zoneless, true); assert.equal(angular.bootstrap, 'bootstrapApplication'); assert.deepEqual(angular.i18n, ['@ngx-translate/core', 'xlf catalogs', 'angular.json i18n']);
});
test('angular standalone counting is version aware and module style, bootstrap and Nx projects are recognised', () => {
  const legacy = analyze({ 'package.json': pkg({ '@angular/core': '~15.2.0' }), 'src/a.ts': component('standalone: true,') + component(), 'src/m.ts': '@NgModule({}) class M {}\nplatformBrowserDynamic().bootstrapModule(M);' });
  assert.equal(legacy.angular.sourceCounts.standaloneComponents, 1); assert.equal(legacy.angular.workspace, 'dependency-only'); assert.equal(legacy.angular.bootstrap, 'bootstrapModule');
  assert.ok(ids(legacy).includes('ANGULAR_NO_WORKSPACE_CONFIG')); assert.equal(legacy.angular.projects.length, 0);
  const mixed = analyze({ 'package.json': pkg({ '@angular/core': '^18' }), 'src/a.ts': 'bootstrapApplication(A);\nplatformBrowserDynamic().bootstrapModule(M);' });
  assert.equal(mixed.angular.bootstrap, 'mixed'); assert.equal(analyze({ 'package.json': pkg({ '@angular/core': 'latest' }) }).angular.major, null);
  assert.equal(analyze({ 'package.json': pkg({ '@angular/core': '^18' }), 'src/a.ts': 'x' }).angular.bootstrap, 'unknown');
  const nx = analyze({ 'package.json': pkg({ nx: '21' }), 'nx.json': {}, 'apps/web/project.json': { name: 'web', targets: { build: { executor: '@angular-devkit/build-angular:application' } } },
    'libs/util/project.json': { name: 'util', targets: { build: { executor: '@nx/js:tsc' } } }, 'apps/api/project.json': { targets: { build: { executor: '@nx/angular:webpack-browser' } } }, 'libs/x/project.json': '{ bad' });
  assert.equal(nx.angular.workspace, 'apps/api/project.json'); assert.deepEqual(nx.angular.projects.map(item => [item.name, item.builderClass, item.root]), [['apps/api', 'webpack', 'apps/api/'], ['web', 'application', 'apps/web/']]);
  assert.ok(nx.tooling.monorepo.includes('nx')); assert.ok(ids(nx).includes('MALFORMED_CONFIG'));
  const modules = analyze({ 'package.json': pkg({ '@angular/core': '^15' }), 'src/app.module.ts': '@NgModule({}) class A {}', 'src/b.ts': component() });
  assert.ok(ids(modules).includes('ANGULAR_NGMODULE_BASED'));
});
test('frameworks, styling, testing, quality, ci and monorepo tooling are recognised from dependencies and files', () => {
  const report = analyze({
    'package.json': pkg({ react: '^18.2.0', next: '14.1.0', vue: '3', '@sveltejs/kit': '2', tailwindcss: '3', sass: '1', bootstrap: '5', postcss: '8', 'styled-components': '6', storybook: '8' },
      { devDependencies: { vitest: '2', jest: '29', karma: '6', cypress: '13', '@playwright/test': '1', eslint: '9', tslint: '6', prettier: '3', '@biomejs/biome': '1', husky: '9', turbo: '2', lerna: '8' } }),
    '.eslintrc.json': '{}', 'eslint.config.mjs': '', '.prettierrc': '{}', 'biome.json': '{}', '.editorconfig': '', 'turbo.json': '{}', 'rush.json': '{}', 'pnpm-workspace.yaml': '',
    '.github/workflows/ci.yml': 'x', '.gitlab-ci.yml': 'x', 'azure-pipelines.yml': 'x', '.circleci/config.yml': 'x', Jenkinsfile: 'x', 'bitbucket-pipelines.yml': 'x', '.travis.yml': 'x', '.drone.yml': 'x',
    'src/theme/_theme.scss': '', 'src/design-tokens.json': '{}', 'src/styles/variables.scss': '', 'a.spec.ts': 'x', 'b.test.tsx': 'x', 'tailwind.config.js': '', '.storybook/main.ts': 'x', 'src/x.less': '' });
  assert.deepEqual(report.frameworks.map(item => item.id), ['react', 'next', 'vue', 'sveltekit']);
  assert.deepEqual(report.ui.styling, ['bootstrap', 'css-in-js', 'less', 'postcss', 'scss', 'storybook', 'tailwind']); assert.ok(report.ui.tokenFiles.includes('src/design-tokens.json'));
  assert.ok(report.ui.themeFiles.includes('src/theme/_theme.scss') && report.ui.themeFiles.includes('src/styles/variables.scss'));
  assert.deepEqual(report.tooling.testing, ['cypress', 'jest', 'karma', 'playwright', 'vitest']); assert.equal(report.tooling.specFiles, 2);
  assert.deepEqual(report.tooling.lint, ['biome', 'eslint', 'husky', 'tslint']); assert.deepEqual(report.tooling.format, ['biome', 'editorconfig', 'prettier']);
  assert.deepEqual(report.tooling.ciProviders, ['azure-pipelines', 'bitbucket-pipelines', 'circleci', 'drone', 'github-actions', 'gitlab-ci', 'jenkins', 'travis']);
  assert.deepEqual(report.tooling.monorepo, ['lerna', 'pnpm-workspaces', 'rush', 'turborepo']);
  for (const id of ['MULTIPLE_TEST_RUNNERS', 'TOOL_CONFIG_CONFLICT', 'NON_ANGULAR_FRONTEND']) assert.ok(ids(report).includes(id), id);
  const plain = analyze({ 'package.json': pkg(), 'src/a.ts': 'x', 'src/b.js': 'y' }), scripts = analyze({ 'src/a.js': 'x', 'src/b.d.ts': 'x' }), none = analyze({ 'README.md': 'x' });
  assert.deepEqual(plain.frameworks.map(item => item.id), ['plain-typescript']); assert.deepEqual(scripts.frameworks.map(item => item.id), ['plain-javascript']); assert.deepEqual(none.frameworks, []);
});
test('obsidian plugins, agent files and existing Workbench presence are detected from markers', () => {
  const plugin = analyze({ 'manifest.json': { id: 'p', version: '1.0.0', minAppVersion: '1.5.0' }, 'package.json': pkg({ obsidian: 'latest' }) });
  assert.deepEqual(plugin.frameworks[0], { id: 'obsidian-plugin', version: '1.0.0', detail: 'minAppVersion 1.5.0', evidence: ['manifest.json', 'package.json'] });
  assert.deepEqual(analyze({ 'manifest.json': { id: 'p' } }).frameworks, []); assert.deepEqual(analyze({ 'manifest.json': { minAppVersion: '1' } }).frameworks, []);
  const files = { 'AGENTS.md': 'x', 'CLAUDE.md': 'x', '.claude/settings.json': { hooks: { Stop: [] }, permissions: { allow: [] } }, '.claude/skills/a/SKILL.md': 'x', '.agents/skills/b/SKILL.md': 'x', '.cursor/rules/r.mdc': 'x', '.cursorrules': 'x',
    '.github/copilot-instructions.md': 'x', '.mcp.json': '{}', 'tools/shell-cli/bin/kit.json': '{}', 'design/project.json': '{}', 'docs/workbench/NOTES.md': 'x', 'shell.config.json': '{}', '.companion/x.json': '{}', 'src/not-agent.md': 'x' };
  const agents = analyze(files).agents;
  assert.deepEqual(agents.skills, ['a', 'b']); assert.deepEqual(agents.claudeSettings, { present: true, hooks: true, permissions: true }); assert.ok(agents.files.includes('.cursor/rules/r.mdc') && !agents.files.includes('src/not-agent.md'));
  const workbench = analyze(files).workbench;
  assert.equal(workbench.present, true); assert.equal(workbench.kitPath, 'tools/shell-cli'); assert.ok(workbench.evidence.includes('design/project.json (design project)'));
  assert.deepEqual(analyze({ 'bin/kit.json': '{}' }).workbench, { present: false, kitPath: '.', evidence: ['bin/kit.json (CLI kit)'] }); assert.deepEqual(analyze({ 'package.json': pkg() }).workbench, { present: false, kitPath: null, evidence: [] });
  assert.deepEqual(analyze({ '.claude/settings.json': '[]' }).agents.claudeSettings, { present: true, hooks: false, permissions: false });
});
