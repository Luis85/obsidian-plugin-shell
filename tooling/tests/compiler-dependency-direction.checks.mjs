import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectModule } from '../compiler/check-architecture.mjs';

// Dependency direction between the compiler and the companion contracts: executable compiler modules,
// including the code emitters in src/cli/compiler/emitters, may consume companion contracts, never the reverse.
const root = fileURLToPath(new URL('../../', import.meta.url));
// The former companion facades and the whole compiler moved to src/cli/compiler;
// nothing may recreate or import the removed paths.
const owners = new Map([
  ['scripts/companion/compiler/plan.ts', 'src/cli/compiler/adapters/project-plan.ts'],
  ['scripts/companion/compiler/cli.ts', 'src/cli/adapters/framework-cli.ts'],
  ['scripts/companion/compiler/fixture-code.ts', 'src/cli/compiler/adapters/fixture-emitter.ts'],
  ['scripts/companion/compiler/project-files.ts', 'src/cli/compiler/adapters/plugin-emitter.ts'],
  // The inward-only compiler core moved to src/cli/compiler; its former scripts/compiler paths are gone too.
  ...['artifacts', 'contracts', 'diagnostics', 'project-starter', 'references', 'selection', 'source-references']
    .map(name => [`scripts/compiler/domain/${name}.ts`, `src/cli/compiler/domain/${name}.ts`]),
  ...['pipeline', 'ports'].map(name => [`scripts/compiler/application/${name}.ts`, `src/cli/compiler/application/${name}.ts`]),
  // The compiler composition root and host adapters moved to src/cli/compiler.
  ['scripts/compiler/index.ts', 'src/cli/compiler/index.ts'],
  // Unreleased compatibility entries were removed without a successor file; their callers use these owners.
  ['scripts/compiler/adapters/fixture-code.ts', 'src/cli/compiler/adapters/fixture-emitter.ts'],
  ['scripts/compiler/adapters/generator-cli.ts', 'src/cli/adapters/framework-cli.ts'],
  ['scripts/compiler/adapters/project-files.ts', 'src/cli/compiler/adapters/plugin-emitter.ts'],
  ...['cli', 'clickdummy-emitter', 'dependencies', 'fixture-emitter', 'frontend', 'origins', 'plugin-emitter', 'project-plan', 'reporting', 'selection',
    'target-lowering', 'template-snapshot', 'workspace-plan']
    .map(name => [`scripts/compiler/adapters/${name}.ts`, `src/cli/compiler/adapters/${name}.ts`]),
  ...['angular-brick-runtime', 'angular-brick-templates', 'angular-bricks', 'angular-linker', 'build-source', 'configuration', 'emitter',
    'framework-adapter', 'framework-registry', 'plugin-extension', 'serve-source', 'sources']
    .map(name => [`scripts/compiler/adapters/project/${name}.ts`, `src/cli/compiler/adapters/project/${name}.ts`]),
]);
const executableCompiler = /^src\/cli\/compiler\/(?:index\.ts$|adapters\/|application\/|emitters\/)/;
const compilerDomain = /^src\/cli\/compiler\/domain\//;
// Package imports (#shared/*, #tui/*) resolve to their source projects like relative specifiers.
const packageImports = [['#shared/', 'src/shared/'], ['#tui/', 'src/tui/']];
function resolved(from, specifier) {
  const mapped = packageImports.find(([prefix]) => specifier.startsWith(prefix));
  if (mapped) return mapped[1] + specifier.slice(mapped[0].length);
  return specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(from), specifier)) : null;
}
// The companion contracts live in src/shared/companion; the qualification entries in tooling/companion-tools are not companion library code.
function companionFindings(path, dependency, target) {
  const findings = [];
  if (executableCompiler.test(target))
    findings.push(`${path}: companion library cannot import executable compiler module ${target}`);
  if (compilerDomain.test(target) && !dependency.typeOnly)
    findings.push(`${path}: companion code may import ${target} only with import type`);
  return findings;
}
/** Pure over an in-memory source map so negative fixtures prove actual checker failure. */
function directionFindings(sources) {
  const findings = [];
  for (const [path, text] of sources) {
    if (owners.has(path)) findings.push(`${path}: removed facade was recreated; use ${owners.get(path)}`);
    for (const dependency of inspectModule(path, text).dependencies) {
      const target = resolved(path, dependency.specifier);
      if (!target) continue;
      if (path.startsWith('src/shared/companion/')) findings.push(...companionFindings(path, dependency, target));
      if (owners.has(target)) findings.push(`${path}: import ${owners.get(target)} instead of removed facade ${target}`);
    }
  }
  return findings.sort();
}
async function sourceInventory() {
  const sources = new Map();
  async function walk(folder) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory() && entry.name !== 'node_modules') await walk(path);
      else if (entry.isFile() && /\.(?:ts|mts|mjs)$/.test(path)) sources.set(path, await readFile(resolve(root, path), 'utf8'));
    }
  }
  for (const folder of ['src', 'tooling', 'templates', 'tests']) await walk(folder);
  return sources;
}

test('repository sources keep the compiler -> companion dependency direction', async () => {
  const sources = await sourceInventory();
  assert.ok(sources.size > 400, 'expected the src/tooling/templates/tests inventory');
  assert.deepEqual(directionFindings(sources), []);
});

test('the former companion compiler facades are gone and their compiler owners exist', async () => {
  // E4: the code emitters moved to src/cli/compiler/emitters; the whole former folder is gone.
  await assert.rejects(readdir(resolve(root, 'scripts/companion/compiler')), { code: 'ENOENT' });
  for (const [path, owner] of owners) {
    await assert.rejects(readFile(resolve(root, path), 'utf8'), { code: 'ENOENT' }, path);
    assert.ok((await readFile(resolve(root, owner), 'utf8')).includes('export '), owner);
  }
});

test('companion code cannot import executable compiler modules, re-exports included', () => {
  const companionModule = 'src/shared/companion/visual/example-contract.ts';
  for (const specifier of ['../../../cli/compiler/index.ts', '../../../cli/compiler/adapters/selection.ts', '../../../cli/compiler/application/compile.ts',
    '../../../cli/compiler/emitters/model.ts']) {
    const findings = directionFindings(new Map([[companionModule, `import { x } from '${specifier}';\nexport const y = x;`]]));
    assert.equal(findings.length, 1, specifier);
    assert.match(findings[0], /executable compiler module/);
  }
  const lazy = directionFindings(new Map([[companionModule, "export const load = () => import('../../../cli/compiler/adapters/cli.ts');"]]));
  assert.equal(lazy.length, 1);
  const contract = 'src/shared/companion/project-store.mjs';
  assert.equal(directionFindings(new Map([[contract, "import '../../cli/compiler/adapters/project-plan.ts';"]])).length, 1);
  const reexport = "export * from '../../../cli/compiler/adapters/selection.ts';";
  assert.equal(directionFindings(new Map([[companionModule, reexport]])).length, 1);
  assert.equal(directionFindings(new Map([['src/shared/companion/qualify-example.mjs', "import '../../cli/compiler/adapters/project-plan.ts';"]])).length, 1);
  assert.deepEqual(directionFindings(new Map([['tooling/companion-tools/qualify-example.mjs', "import '../../src/cli/compiler/adapters/project-plan.ts';"]])), []);
  const moved = directionFindings(new Map([['scripts/compiler/qualify-example.mjs', "import { compileProject } from './index.ts';"]]));
  assert.equal(moved.length, 1); assert.match(moved[0], /src\/cli\/compiler\/index\.ts instead of removed facade/);
});

test('companion code reaches compiler domain contracts through import type only', () => {
  const companionModule = 'src/shared/companion/visual/example-contract.ts';
  const typed = "import type { TemplateSnapshot } from '../../../cli/compiler/domain/contracts.ts';\nexport type T = TemplateSnapshot;";
  assert.deepEqual(directionFindings(new Map([[companionModule, typed]])), []);
  const value = directionFindings(new Map([[companionModule, "import { CompilationFailure } from '../../../cli/compiler/domain/diagnostics.ts';\nexport { CompilationFailure };"]]));
  assert.equal(value.length, 1);
  assert.match(value[0], /only with import type/);
});

test('no source may import or recreate a removed companion facade', () => {
  for (const [path, statement] of [
    ['src/cli/adapters/example.ts', "import { planProject } from '../../../scripts/companion/compiler/plan.ts';"],
    ['src/cli/adapters/example.ts', "const cli = await import('../../../scripts/companion/compiler/cli.ts');"],
    ['src/cli/adapters/starters/example.ts', "import { projectFiles } from '../../../../scripts/companion/compiler/project-files.ts';"],
    ['scripts/compiler/adapters/example.ts', "export { fixtureCode } from '../../companion/compiler/fixture-code.ts';"],
    ['plugins/example/index.ts', "import '../../scripts/companion/compiler/plan.ts';"],
    ['src/cli/adapters/example.ts', "import { CompilerError } from '../../../scripts/compiler/domain/diagnostics.ts';"],
    ['scripts/compiler/adapters/example.ts', "import { runCompiler } from '../application/pipeline.ts';"],
    ['tests/tooling/example.checks.mjs', "import { planProject } from '../../scripts/companion/compiler/plan.ts';"],
  ]) {
    const findings = directionFindings(new Map([[path, statement]]));
    assert.equal(findings.length, 1, `${path}: ${statement}`);
    assert.match(findings[0], /instead of removed facade/);
  }
  const recreated = directionFindings(new Map([['scripts/companion/compiler/plan.ts', 'export const planProject = 1;']]));
  assert.equal(recreated.length, 1);
  assert.match(recreated[0], /removed facade was recreated/);
  const generated = 'const output = `import { planProject } from "../companion/compiler/plan.ts";`;';
  assert.deepEqual(directionFindings(new Map([['src/cli/adapters/example.ts', generated]])), []);
});
