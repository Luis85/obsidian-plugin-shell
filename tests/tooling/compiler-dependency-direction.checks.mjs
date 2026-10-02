import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectModule } from '../../scripts/compiler/check-architecture.mjs';

// Dependency direction between the compiler and the companion generator library:
// executable compiler modules may consume companion emitters, never the reverse.
const root = fileURLToPath(new URL('../../', import.meta.url));
// The former companion facades moved to scripts/compiler/adapters and the compiler core to bin/compiler;
// nothing may recreate or import the removed paths.
const owners = new Map([
  ['scripts/companion/compiler/plan.ts', 'scripts/compiler/adapters/project-plan.ts'],
  ['scripts/companion/compiler/cli.ts', 'scripts/compiler/adapters/generator-cli.ts'],
  ['scripts/companion/compiler/fixture-code.ts', 'bin/compiler/adapters/fixture-code.ts'],
  ['scripts/companion/compiler/project-files.ts', 'scripts/compiler/adapters/project-files.ts'],
  // The inward-only compiler core moved to bin/compiler; its former scripts/compiler paths are gone too.
  ...['artifacts', 'contracts', 'diagnostics', 'project-starter', 'references', 'selection', 'source-references']
    .map(name => [`scripts/compiler/domain/${name}.ts`, `bin/compiler/domain/${name}.ts`]),
  ...['pipeline', 'ports'].map(name => [`scripts/compiler/application/${name}.ts`, `bin/compiler/application/${name}.ts`]),
  // The compiler host adapters moved to bin/compiler/adapters.
  ...['cli', 'clickdummy-emitter', 'dependencies', 'fixture-code', 'fixture-emitter', 'frontend', 'origins', 'reporting', 'target-lowering', 'template-snapshot']
    .map(name => [`scripts/compiler/adapters/${name}.ts`, `bin/compiler/adapters/${name}.ts`]),
]);
const executableCompiler = /^(?:scripts\/compiler\/(?:index\.ts$|adapters\/)|bin\/compiler\/(?:index\.ts$|adapters\/|application\/))/;
const compilerDomain = /^bin\/compiler\/domain\//;
const qualificationEntry = /^scripts\/companion\/qualify-[^/]+\.mjs$/;
function resolved(from, specifier) {
  return specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(from), specifier)) : null;
}
function companionFindings(path, dependency, target) {
  if (qualificationEntry.test(path)) return [];
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
      if (path.startsWith('scripts/companion/')) findings.push(...companionFindings(path, dependency, target));
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
  for (const folder of ['bin', 'scripts', 'plugins', 'tests']) await walk(folder);
  return sources;
}

test('repository sources keep the compiler -> companion dependency direction', async () => {
  const sources = await sourceInventory();
  assert.ok(sources.size > 400, 'expected the bin/scripts/plugins/tests inventory');
  assert.deepEqual(directionFindings(sources), []);
});

test('the former companion compiler facades are gone and their compiler owners exist', async () => {
  for (const [path, owner] of owners) {
    await assert.rejects(readFile(resolve(root, path), 'utf8'), { code: 'ENOENT' }, path);
    assert.ok((await readFile(resolve(root, owner), 'utf8')).includes('export '), owner);
  }
});

test('companion code cannot import executable compiler modules, re-exports included', () => {
  const emitter = 'scripts/companion/compiler/example-code.ts';
  for (const specifier of ['../../compiler/index.ts', '../../compiler/adapters/selection.ts', '../../../bin/compiler/application/compile.ts']) {
    const findings = directionFindings(new Map([[emitter, `import { x } from '${specifier}';\nexport const y = x;`]]));
    assert.equal(findings.length, 1, specifier);
    assert.match(findings[0], /executable compiler module/);
  }
  const lazy = directionFindings(new Map([[emitter, "export const load = () => import('../../../bin/compiler/adapters/cli.ts');"]]));
  assert.equal(lazy.length, 1);
  const contract = 'scripts/companion/project-store.mjs';
  assert.equal(directionFindings(new Map([[contract, "import '../compiler/adapters/project-plan.ts';"]])).length, 1);
  const reexport = "export * from '../../compiler/adapters/selection.ts';";
  assert.equal(directionFindings(new Map([[emitter, reexport]])).length, 1);
  assert.deepEqual(directionFindings(new Map([['scripts/companion/qualify-example.mjs', "import '../compiler/adapters/project-plan.ts';"]])), []);
});

test('companion code reaches compiler domain contracts through import type only', () => {
  const emitter = 'scripts/companion/compiler/example-code.ts';
  const typed = "import type { TemplateSnapshot } from '../../../bin/compiler/domain/contracts.ts';\nexport type T = TemplateSnapshot;";
  assert.deepEqual(directionFindings(new Map([[emitter, typed]])), []);
  const value = directionFindings(new Map([[emitter, "import { CompilationFailure } from '../../../bin/compiler/domain/diagnostics.ts';\nexport { CompilationFailure };"]]));
  assert.equal(value.length, 1);
  assert.match(value[0], /only with import type/);
});

test('no source may import or recreate a removed companion facade', () => {
  for (const [path, statement] of [
    ['bin/adapters/example.ts', "import { planProject } from '../../scripts/companion/compiler/plan.ts';"],
    ['bin/adapters/example.ts', "const cli = await import('../../scripts/companion/compiler/cli.ts');"],
    ['scripts/starters/example.ts', "import { projectFiles } from '../companion/compiler/project-files.ts';"],
    ['scripts/compiler/adapters/example.ts', "export { fixtureCode } from '../../companion/compiler/fixture-code.ts';"],
    ['plugins/example/index.ts', "import '../../scripts/companion/compiler/plan.ts';"],
    ['bin/adapters/example.ts', "import { CompilerError } from '../../scripts/compiler/domain/diagnostics.ts';"],
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
  assert.deepEqual(directionFindings(new Map([['bin/adapters/example.ts', generated]])), []);
});
