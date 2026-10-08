const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { parseSourceManifest, projectTsconfig, testsTsconfig } from '../domain/source-projects.ts';
import { addProject, linkProjects, manifestDocument, reconcileImports, reconcileSolution, removeProject, renameProject, solutionDrift, unlinkProjects } from '../domain/source-projects-edit.ts';

const repo = () => parseSourceManifest({ schemaVersion: 1, projects: [
  { name: 'shared', kind: 'library', path: 'src/shared', references: [] },
  { name: 'tui', kind: 'library', path: 'src/tui', references: ['shared'], include: ['**/*.ts'] },
  { name: 'cli', kind: 'cli', path: 'src/cli', references: ['shared', 'tui'], extraReferences: ['configs/types/tsconfig.templates.json'] },
  { name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['shared'], compilerOptions: { paths: { '#build/*': ['../../node_modules/.nuxt-ui/*'] } } },
] });

test('schema extensions: include, compiler options, extra references and gate exemptions shape the derived tsconfig', () => {
  const m = repo(), byName = name => m.projects.find(project => project.name === name);
  assert.deepEqual(projectTsconfig(byName('tui'), m).include, ['**/*.ts']);
  assert.deepEqual(projectTsconfig(byName('cli'), m).references, [{ path: '../shared' }, { path: '../tui' }, { path: '../../configs/types/tsconfig.templates.json' }]);
  assert.deepEqual(projectTsconfig(byName('plugin'), m).compilerOptions, { rootDir: '.', declarationDir: '../../.cache/tsbuild/plugin',
    tsBuildInfoFile: '../../.cache/tsbuild/plugin.tsbuildinfo', paths: { '#build/*': ['../../node_modules/.nuxt-ui/*'] } });
  const exempt = { schemaVersion: 1, projects: [{ name: 'app', kind: 'companion', path: 'src/app', references: [], gateExemptions: { lint: 'owner decision' } }] };
  assert.equal(parseSourceManifest(exempt).projects[0].gateExemptions.lint, 'owner decision');
});
test('extension fields are validated: derived options, paths outside the repository, unknown gates and empty reasons are rejected', () => {
  const base = { name: 'app', kind: 'cli', path: 'src/app', references: [] };
  for (const extra of [{ compilerOptions: { rootDir: '..' } }, { compilerOptions: { composite: false } }, { extraReferences: ['../outside.json'] },
    { extraReferences: ['/abs.json'] }, { include: [] }, { include: ['a', 'a'] }, { gateExemptions: { typecheck: 'x' } }, { gateExemptions: { lint: ' ' } }])
    assert.throws(() => parseSourceManifest({ schemaVersion: 1, projects: [{ ...base, ...extra }] }), error => error.code === 'INVALID_DATA', JSON.stringify(extra));
});
test('a flat src project cannot share src with src/<name> projects', () => {
  const mixed = { schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }, { name: 'util', kind: 'library', path: 'src/util', references: [] }] };
  assert.throws(() => parseSourceManifest(mixed), error => error.code === 'INVALID_DATA' && /flat "src" project/.test(error.message));
  const flat = parseSourceManifest({ schemaVersion: 1, projects: [mixed.projects[0]] });
  assert.throws(() => addProject(flat, { name: 'util', kind: 'library', references: [] }), error => error.code === 'SOURCE_FLAT_SRC');
});
test('tests tsconfig references the project and its references from the tests folder', () => {
  const m = repo();
  assert.deepEqual(testsTsconfig(m.projects[2], m), {
    extends: '../../../configs/types/tsconfig.node.json',
    compilerOptions: { rootDir: '.', composite: false, declaration: false, emitDeclarationOnly: false, noEmit: true, incremental: true, tsBuildInfoFile: '../../../.cache/tsbuild/cli-tests.tsbuildinfo' },
    include: ['**/*'],
    references: [{ path: '..' }, { path: '../../shared' }, { path: '../../tui' }],
  });
});
test('add, link, unlink, rename and remove keep the manifest valid and refuse unsafe edits', () => {
  const added = addProject(repo(), { name: 'util', kind: 'library', platform: 'browser', references: ['shared'] });
  assert.deepEqual(added.projects.at(-1), { name: 'util', kind: 'library', path: 'src/util', references: ['shared'], platform: 'browser' });
  assert.throws(() => addProject(added, { name: 'util', kind: 'cli', references: [] }), error => error.code === 'SOURCE_EXISTS');
  assert.throws(() => addProject(repo(), { name: 'x', kind: 'cli', references: ['ghost'] }), error => error.code === 'SOURCE_NOT_FOUND');
  assert.deepEqual(linkProjects(added, 'plugin', 'util').projects.find(item => item.name === 'plugin').references, ['shared', 'util']);
  assert.throws(() => linkProjects(repo(), 'shared', 'cli'), error => error.code === 'SOURCE_CYCLE' && /shared -> cli -> shared/.test(error.message));
  assert.throws(() => linkProjects(repo(), 'cli', 'cli'), error => error.code === 'SOURCE_CYCLE');
  assert.throws(() => linkProjects(repo(), 'cli', 'tui'), error => error.code === 'SOURCE_LINKED');
  assert.deepEqual(unlinkProjects(repo(), 'cli', 'tui').projects.find(item => item.name === 'cli').references, ['shared']);
  assert.throws(() => unlinkProjects(repo(), 'plugin', 'tui'), error => error.code === 'SOURCE_NOT_LINKED');
  const renamed = renameProject(repo(), 'shared', 'core');
  assert.deepEqual(renamed.projects.map(item => [item.name, item.path, item.references]), [['core', 'src/core', []], ['tui', 'src/tui', ['core']], ['cli', 'src/cli', ['core', 'tui']], ['plugin', 'src/plugin', ['core']]]);
  assert.throws(() => renameProject(repo(), 'shared', 'tui'), error => error.code === 'SOURCE_EXISTS');
  assert.throws(() => removeProject(repo(), 'shared'), error => error.code === 'SOURCE_REFERENCED' && /tui, cli, plugin/.test(error.message));
  assert.deepEqual(removeProject(repo(), 'plugin').projects.map(item => item.name), ['shared', 'tui', 'cli']);
});
test('manifest documents keep a stable key order', () => {
  const document = manifestDocument(addProject(repo(), { name: 'util', kind: 'library', platform: 'node', references: [] }));
  assert.deepEqual(Object.keys(document.projects[1]), ['name', 'kind', 'path', 'references', 'include']);
  assert.deepEqual(Object.keys(document.projects.at(-1)), ['name', 'kind', 'path', 'references', 'platform']);
});
test('solution drift finds missing and stale src references and keeps non-source references in place', () => {
  const solution = { files: [], references: [{ path: './src/shared' }, { path: './src/old' }, { path: './configs/types/tsconfig.templates.json' }, { path: './src/shared/tests' }, { path: './tooling' }] };
  const required = ['src/shared', 'src/cli', 'src/shared/tests', 'src/cli/tests'];
  assert.deepEqual(solutionDrift(solution, required), { missing: ['src/cli', 'src/cli/tests'], stale: ['src/old'], solution: true });
  assert.deepEqual(reconcileSolution(solution, required).references.map(item => item.path),
    ['./src/shared', './src/cli', './configs/types/tsconfig.templates.json', './src/shared/tests', './src/cli/tests', './tooling']);
  assert.equal(solutionDrift({ compilerOptions: {}, include: ['src'] }, required).solution, false);
  assert.deepEqual(reconcileSolution(null, ['src/a']), { files: [], references: [{ path: './src/a' }] });
});
test('package.json imports: library aliases are set, stale aliases into src removed, other entries kept', () => {
  assert.deepEqual(reconcileImports({ '#build/*': './node_modules/x/*', '#old/*': './src/old/*', '#shared/*': './src/elsewhere/*' }, { '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' }),
    { '#build/*': './node_modules/x/*', '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' });
  assert.deepEqual(reconcileImports(undefined, {}), {});
});
