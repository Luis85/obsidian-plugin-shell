import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkCompilerArchitecture, checkCompilerBoundaries, inspectModule } from '../../scripts/compiler/check-architecture.mjs';
const domain='scripts/compiler/domain/example.ts', app='scripts/compiler/application/example.ts';
test('compiler dependency rules hold on resolved production sources',async()=>{
  const result=await checkCompilerArchitecture(fileURLToPath(new URL('../../',import.meta.url)));assert.ok(result.files>20);
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
