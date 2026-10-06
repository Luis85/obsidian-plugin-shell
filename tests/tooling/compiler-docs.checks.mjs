import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseCliArguments } from '../../src/cli/adapters/framework/catalog.ts';
import { diagnosticCatalog } from '../../src/cli/compiler/domain/diagnostics.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('compiler documentation includes every stable diagnostic with the exact repair guidance',async()=>{
  const text=await readFile(join(root,'docs/development/compiler/DIAGNOSTICS.md'),'utf8');
  for(const [code,help] of Object.entries(diagnosticCatalog)){assert.ok(text.includes('`'+code+'`'),code);assert.ok(text.includes(help),code+' guidance');}
});
test('documented read commands are accepted by the real CLI catalog',()=>{
  for(const args of [['compiler','check','--input','project.json','--json'],['compiler','inspect','--input','project.json','--stage','artifacts','--output-kind','clickdummy'],['compiler','explain','COMPILER_REFERENCE_MISSING'],['compiler','check','--input','project.json','--report-dir','reports/compiler','--debug']])assert.ok(parseCliArguments(args));
});

test('compiler coverage includes selection and project starter contracts without lowering any gate',async()=>{
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['test:compiler:coverage'],'node scripts/compiler/coverage.mjs');
  const { compilerCoverageArguments } = await import('../../scripts/compiler/coverage.mjs');
  const command=compilerCoverageArguments();
  for(const token of ['--test-coverage-lines=95','--test-coverage-branches=90','--test-coverage-functions=90',
    'tests/tooling/compiler-selection.checks.mjs', 'tests/tooling/interactive-maker-project-starters.checks.mjs', 'tests/tooling/interactive-maker-compiler-core.checks.mjs',
    '--test-coverage-include=src/cli/compiler/domain/**', '--test-coverage-include=src/cli/compiler/application/**']) assert.ok(command.includes(token),token);
});
