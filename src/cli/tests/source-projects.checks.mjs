const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { parseSourceManifest, findCycle, topologicalOrder, importAliases, resolveSourceProject, unknownReferences, implicitSourceManifest, projectTsconfig, solutionTsconfig } from '../domain/source-projects.ts';

const repo = { schemaVersion: 1, projects: [
  { name: 'shared', kind: 'library', path: 'src/shared', references: [] },
  { name: 'tui', kind: 'library', path: 'src/tui', references: ['shared'] },
  { name: 'cli', kind: 'cli', path: 'src/cli', references: ['shared', 'tui'] },
  { name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['shared'] },
] };

test('valid manifest parses and orders dependencies first', () => {
  const m = parseSourceManifest(structuredClone(repo));
  assert.deepEqual(topologicalOrder(m), ['shared', 'tui', 'cli', 'plugin']);
});
test('unknown key, bad name, path outside src and unknown schema are rejected', () => {
  for (const bad of [{ ...repo, extra: 1 }, { ...repo, schemaVersion: 2 },
    { ...repo, projects: [{ ...repo.projects[0], name: 'Bad Name' }] },
    { ...repo, projects: [{ ...repo.projects[0], path: '../shared' }] }])
    assert.throws(() => parseSourceManifest(bad), /INVALID_DATA|Expected/);
});
test('cycle is reported with its path', () => {
  const m = structuredClone(repo); m.projects[0].references = ['cli'];
  assert.deepEqual(findCycle(m), ['shared', 'cli', 'shared']);
  assert.throws(() => topologicalOrder(m), /shared -> cli -> shared/);
  assert.equal(findCycle(structuredClone(repo)), null);
});
test('aliases exist for library kinds only', () => {
  assert.deepEqual(importAliases(parseSourceManifest(structuredClone(repo))), { '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' });
});
test('maker target resolution: single plugin default, ambiguity lists candidates', () => {
  const m = parseSourceManifest(structuredClone(repo));
  assert.equal(resolveSourceProject(m, 'plugin').path, 'src/plugin');
  const two = structuredClone(repo); two.projects.push({ name: 'mobile', kind: 'plugin', path: 'src/mobile', references: [] });
  assert.throws(() => resolveSourceProject(parseSourceManifest(two), 'plugin'), /plugin, mobile|mobile, plugin/);
  assert.equal(resolveSourceProject(parseSourceManifest(two), 'plugin', 'mobile').path, 'src/mobile');
});
test('resolution reports a missing kind and an unknown name', () => {
  const m = parseSourceManifest(structuredClone(repo));
  assert.throws(() => resolveSourceProject(m, 'companion'), error => error.code === 'SOURCE_NOT_FOUND' && /companion/.test(error.message));
  assert.throws(() => resolveSourceProject(m, 'plugin', 'nope'), error => error.code === 'SOURCE_NOT_FOUND' && /plugin/.test(error.message));
});
test('legacy flat src is one implicit plugin project', () => {
  assert.deepEqual(implicitSourceManifest(false, true).projects, [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }]);
  assert.deepEqual(implicitSourceManifest(true, false).projects, [{ name: 'plugin', kind: 'plugin', path: 'src/plugin', references: [] }]);
  assert.deepEqual(implicitSourceManifest(false, false).projects, []);
});
test('duplicate names or paths, and platform outside libraries, are rejected', () => {
  const dup = structuredClone(repo); dup.projects[1].name = 'shared';
  const samePath = structuredClone(repo); samePath.projects[1].path = 'src/shared';
  const platform = structuredClone(repo); platform.projects[2].platform = 'node';
  for (const bad of [dup, samePath, platform]) assert.throws(() => parseSourceManifest(bad), error => error.code === 'INVALID_DATA');
  const legacy = { schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }] };
  assert.equal(parseSourceManifest(legacy).projects[0].path, 'src');
});
test('unknown and self references are findings, not parse failures', () => {
  const unknown = structuredClone(repo); unknown.projects[1].references = ['ghost'];
  assert.deepEqual(unknownReferences(parseSourceManifest(unknown)), [{ project: 'tui', reference: 'ghost' }]);
  assert.deepEqual(unknownReferences(parseSourceManifest(structuredClone(repo))), []);
  const self = structuredClone(repo); self.projects[1].references = ['tui'];
  assert.deepEqual(findCycle(parseSourceManifest(self)), ['tui', 'tui']);
  assert.throws(() => projectTsconfig(parseSourceManifest(unknown).projects[1], parseSourceManifest(unknown)), error => error.code === 'INVALID_DATA');
});
test('project tsconfig extends the platform base, references dependencies and excludes tests', () => {
  const m = parseSourceManifest(structuredClone(repo));
  const byName = name => m.projects.find(project => project.name === name);
  assert.deepEqual(projectTsconfig(byName('cli'), m), {
    extends: '../../configs/types/tsconfig.node.json',
    compilerOptions: { rootDir: '.', declarationDir: '../../.cache/tsbuild/cli', tsBuildInfoFile: '../../.cache/tsbuild/cli.tsbuildinfo' },
    include: ['**/*.ts'],
    exclude: ['tests/**'],
    references: [{ path: '../shared' }, { path: '../tui' }],
  });
  const plugin = projectTsconfig(byName('plugin'), m);
  assert.equal(plugin.extends, '../../configs/types/tsconfig.browser.json');
  assert.deepEqual(plugin.include, ['**/*.ts', '**/*.vue']);
  const shared = projectTsconfig(byName('shared'), m);
  assert.equal(shared.extends, '../../configs/types/tsconfig.node.json');
  assert.deepEqual(shared.include, ['**/*.ts', '**/*.mjs', '**/*.d.mts']);
  assert.deepEqual(shared.references, []);
  const web = { name: 'web', kind: 'library', path: 'src/web', references: [], platform: 'browser' };
  assert.equal(projectTsconfig(web, m).extends, '../../configs/types/tsconfig.browser.json');
  const companion = { name: 'companion', kind: 'companion', path: 'src/companion', references: ['shared'] };
  const withCompanion = { ...m, projects: [...m.projects, companion] };
  const generated = projectTsconfig(companion, withCompanion);
  assert.equal(generated.extends, '../../configs/types/tsconfig.browser.json');
  assert.deepEqual(generated.include, ['**/*.ts', '**/*.vue']);
});
test('a flat src project resolves its relative paths one level up', () => {
  const m = parseSourceManifest({ schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }] });
  const config = projectTsconfig(m.projects[0], m);
  assert.equal(config.extends, '../configs/types/tsconfig.browser.json');
  assert.equal(config.compilerOptions.declarationDir, '../.cache/tsbuild/plugin');
});
test('solution tsconfig lists every project in dependency order', () => {
  assert.deepEqual(solutionTsconfig(parseSourceManifest(structuredClone(repo))), {
    files: [], references: [{ path: './src/shared' }, { path: './src/tui' }, { path: './src/cli' }, { path: './src/plugin' }],
  });
});
