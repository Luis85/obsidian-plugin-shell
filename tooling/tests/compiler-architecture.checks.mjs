import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkCompilerArchitecture, checkCompilerBoundaries, compilerSourceInventory, inspectModule, missingPureEntrypoints, pureEntrypoints } from '../compiler/check-architecture.mjs';
const domain='src/cli/compiler/domain/example.ts', app='src/cli/compiler/application/example.ts';
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
  const emitter='src/cli/compiler/adapters/plugin-emitter.ts', helper='src/cli/compiler/adapters/helper.ts';
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
  assert.ok([...sources.keys()].some(path=>path.startsWith('src/cli/compiler/domain/'))&&[...sources.keys()].some(path=>path.startsWith('src/cli/compiler/application/')));
  const without=new Map(sources);without.delete(pureEntrypoints[0]);
  assert.deepEqual(missingPureEntrypoints(without),[`${pureEntrypoints[0]}: pure entrypoint is missing from the compiler source inventory`]);
});
test('the former scripts/compiler core paths are no longer treated as the inward-only layer',()=>{
  const legacy='scripts/compiler/domain/example.ts';
  assert.equal(checkCompilerBoundaries(new Map([[domain,"import '../adapters/cli.ts';"]])).length,1);
  assert.deepEqual(checkCompilerBoundaries(new Map([[legacy,"export {};"]])),[]);
});
test('#name/* aliases resolve through package.json "imports", so a pure entrypoint reaching I/O through #shared is caught',()=>{
  const emitter='src/cli/compiler/adapters/plugin-emitter.ts', helper='src/shared/platform/helper.ts';
  const sources=new Map([[emitter,"import '#shared/platform/helper.ts';"],[helper,"import 'node:fs';"]]);
  assert.ok(checkCompilerBoundaries(sources).some(f=>f.includes('plugin-emitter.ts -> src/shared/platform/helper.ts')&&f.includes('node:fs')));
  // Without the alias the specifier is an unknown package import, reported as such rather than followed.
  assert.ok(checkCompilerBoundaries(sources,{}).some(f=>f.includes('cannot import #shared/platform/helper.ts')));
  assert.deepEqual(checkCompilerBoundaries(new Map([[domain,"import '#shared/x.ts';"],['src/shared/x.ts','export {};']]),{'#shared/*':'./src/shared/*'}).length,1);
});
