import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkCompilerArchitecture, checkCompilerBoundaries, compilerSourceInventory, inspectModule, missingPureEntrypoints, pureEntrypoints } from '../../scripts/compiler/check-architecture.mjs';
const domain='bin/compiler/domain/example.ts', app='bin/compiler/application/example.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('compiler dependency rules hold on resolved production sources',async()=>{
  const result=await checkCompilerArchitecture(root);assert.ok(result.files>20);
});
test('domain and application reject framework, filesystem, dynamic imports and global I/O',()=>{
  for(const source of ["import { readFile } from 'node:fs/promises';", "await import(variable);", "fetch('https://example.test');", 'process.stdout.write("bad");', 'Date.now();']){
    assert.ok(checkCompilerBoundaries(new Map([[domain,source]])).length,source);
  }
  assert.ok(checkCompilerBoundaries(new Map([[domain,"import '../application/example.ts';"],[app,'export {};']])).length);
  assert.deepEqual(checkCompilerBoundaries(new Map([[app,"import '../domain/example.ts';"],[domain,'export {};']])),[]);
});
test('pure emitters cannot reach filesystem through a transitive helper',()=>{
  const emitter='scripts/compiler/adapters/plugin-emitter.ts', helper='scripts/compiler/adapters/helper.ts';
  const findings=checkCompilerBoundaries(new Map([[emitter,"import './helper.ts';"],[helper,"import 'node:fs';"]]));
  assert.ok(findings.some(f=>f.includes('plugin-emitter.ts ->')&&f.includes('node:fs')));
});
test('generated source string imports are not mistaken for compiler effects',()=>{
  const source='const output = `import { readFile } from "node:fs"; process.exit();`;';
  assert.deepEqual(inspectModule(domain,source),{dependencies:[],globals:[]});
});
test('every pure entrypoint exists in the inventory; a missing one fails instead of being skipped',async()=>{
  const sources=await compilerSourceInventory(root);
  assert.deepEqual(missingPureEntrypoints(sources),[]);
  assert.ok([...sources.keys()].some(path=>path.startsWith('bin/compiler/domain/'))&&[...sources.keys()].some(path=>path.startsWith('bin/compiler/application/')));
  const without=new Map(sources);without.delete(pureEntrypoints[0]);
  assert.deepEqual(missingPureEntrypoints(without),[`${pureEntrypoints[0]}: pure entrypoint is missing from the compiler source inventory`]);
});
test('the former scripts/compiler core paths are no longer treated as the inward-only layer',()=>{
  const legacy='scripts/compiler/domain/example.ts';
  assert.equal(checkCompilerBoundaries(new Map([[domain,"import '../../../scripts/compiler/adapters/cli.ts';"]])).length,1);
  assert.deepEqual(checkCompilerBoundaries(new Map([[legacy,"export {};"]])),[]);
});
