import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { literal, json, symbol, type Model } from './model.ts';
import { relationshipDefinitions, relationshipScope } from './relationship-model.ts';
import { sample } from './schema-code.ts';
import { relativeImport, type Add } from './file-code.ts';
export async function relationshipCode(template:string,m:Model,add:Add):Promise<void>{
  const all=relationshipDefinitions(m);if(!all.length)return;
  const scope=relationshipScope(m); const auditScope=relationshipScope(m,true);
  add('design/relationships.json',json({rules:all,writeGuard:scope.rules.map(r=>r.id),scope:'generated-runtime-preflight-not-cross-process-transaction'}),'managed');
  add(`${m.sourceRoot}/domain/note-values.ts`,await readFile(join(template,'scripts/companion/runtime/note-values.ts'),'utf8'),'managed');
  add(`${m.sourceRoot}/domain/relationships.ts`,await readFile(join(template,'scripts/companion/runtime/relationships.ts'),'utf8'),'managed');
  const tests=await readFile(join(template,'tests/tooling/project-generator-relationships.checks.mjs'),'utf8');
  const testPath=`${m.testRoot}/relationships.test.mjs`;
  // This is the same executable suite against the emitted runtime, not source-text assertions.
  add(testPath,tests.replace("import { test } from 'node:test';","import { test } from 'vitest';")
    .replace("../../scripts/companion/runtime/relationships.ts",relativeImport(testPath,`${m.sourceRoot}/domain/relationships.ts`))
    .replace("../../scripts/companion/runtime/relationship-session.ts",relativeImport(testPath,`${m.sourceRoot}/application/relationship-session.ts`)),'managed');
  add(`${m.sourceRoot}/application/relationship-session.ts`,(await readFile(join(template,'scripts/companion/runtime/relationship-session.ts'),'utf8')).replace("'./relationships.ts'","'../domain/relationships.ts'").replace("'./note-values.ts'","'../domain/note-values.ts'"),'managed');
  if(!auditScope.rules.length)return;
  nativeRelationshipTests(m,add);
  const file=`${m.sourceRoot}/bootstrap/relationships.ts`;
  add(file,`import type { Services } from ${literal(relativeImport(file,'src/bootstrap/services.ts'))};
import { createRelationshipSession } from '../application/relationship-session.ts';
const sessions = new WeakMap<Services,ReturnType<typeof createRelationshipSession>>();
/** Shared across this runtime's generated adapters. External vault changes still require reconciliation. */
export function createRelationshipIntegrity(shell:Services){
 const existing=sessions.get(shell);if(existing)return existing;
 const session=createRelationshipSession(${literal(auditScope.rules)},async()=>{
  const results=await Promise.all([${auditScope.entities.map(e=>`shell.repositories.${symbol(e.slug)}.list()`).join(',')}]);
  const records:import('../domain/relationships.ts').RelationshipRecord[]=[];
 for(const result of results){if(!result.ok)throw new Error('RELATIONSHIP_READ_FAILED');records.push(...result.value);}return records;
 });
 sessions.set(shell,session);return session;
}
export function disposeRelationshipIntegrity(shell:Services){sessions.get(shell)?.dispose();sessions.delete(shell);}
`,'managed');
}

function nativeRelationshipTests(m:Model,add:Add):void {
  for(const rule of relationshipScope(m).rules.filter(r=>r.source===r.target&&r.sourceCard==='0..*'&&r.targetCard==='0..1')){
    const entity=m.entities.find(e=>e.slug===rule.source)!;
    const source=m.sources.find(s=>['create','update','delete'].every(kind=>s.operations.some(op=>{
      const impl=op.contract.implementation as {entity?:string;operation?:string}|undefined;return impl?.entity===entity.id&&impl.operation===kind;
    })));if(!source)continue;
    const operations=Object.fromEntries(source.operations.flatMap(op=>{const impl=op.contract.implementation as {entity?:string;operation?:string}|undefined;return impl?.entity===entity.id?[[impl.operation,op.slug]]:[];}));
    const schema={...entity.schema,properties:Object.fromEntries(Object.entries(entity.schema.properties ?? {}).filter(([key])=>!['id','type',rule.key].includes(key))),required:(entity.schema.required ?? []).filter(key=>!['id','type',rule.key].includes(key))};
    const values=sample(schema);const name=symbol(entity.slug);const sourceName=symbol(source.slug);
    const path=`${m.testRoot}/relationships/${entity.slug}.test.mjs`;
    add(path,`import { test, expect } from 'vitest';
import { NoteRepository } from ${literal(relativeImport(path,'src/application/note-repository.ts'))};
import { markdownCodec } from ${literal(relativeImport(path,'src/infrastructure/markdown.ts'))};
import { success, failure } from ${literal(relativeImport(path,'src/domain/outcome.ts'))};
import { document } from ${literal(relativeImport(path,`${m.sourceRoot}/application/documents/${entity.slug}.ts`))};
import { create${sourceName}Adapter } from ${literal(relativeImport(path,`${m.sourceRoot}/infrastructure/sources/${source.slug}.ts`))};
import { createRelationshipIntegrity } from ${literal(relativeImport(path,`${m.sourceRoot}/bootstrap/relationships.ts`))};
test('native source adapter prevents dangling writes and restrict deletion without changing Markdown',async()=>{
 const files=new Map();let writes=0,ids=0;
 const storage={list:async(folder)=>success([...files.keys()].filter(p=>p.startsWith(folder+'/'))),read:async(p)=>files.has(p)?success(files.get(p)):failure('storage','error.read'),
 create:async(p,body)=>{if(files.has(p))return failure('conflict','error.conflict');files.set(p,body);writes++;return success(undefined);},
 replace:async(p,before,after)=>{if(files.get(p)!==before)return failure('stale','error.stale');files.set(p,after);writes++;return success(undefined);},
 trash:async(p,before)=>{if(files.get(p)!==before)return failure('stale','error.stale');files.delete(p);writes++;return success(undefined);}};
 const repository=new NoteRepository(document,storage,markdownCodec,{publish:()=>{}},()=>${literal(entity.folder)},()=> 'record-'+(++ids),()=> '2026-01-01T00:00:00Z',{report:()=>{}});
 const shell={repositories:{${name}:repository}};const port=create${sourceName}Adapter(shell,createRelationshipIntegrity(shell));const base=${literal(values)};
 try{
  const parent=await port[${literal(operations.create)}]({values:{...base,title:'Parent'},requestId:'parent'});
  const child=await port[${literal(operations.create)}]({values:{...base,title:'Child',${literal(rule.key)}:parent.record.id},requestId:'child'});
  expect(writes).toBe(2);const before=[...files];
  await expect(port[${literal(operations.update)}]({id:child.record.id,revision:child.revision,values:{...base,title:'Child',${literal(rule.key)}:'absent'}})).rejects.toThrow('RELATIONSHIP');
  await expect(port[${literal(operations.delete)}]({id:parent.record.id,revision:parent.revision})).rejects.toThrow('RELATIONSHIP');
  expect(writes).toBe(2);expect([...files]).toEqual(before);
  await port[${literal(operations.update)}]({id:child.record.id,revision:child.revision,values:{...base,title:'Child'}});
  await port[${literal(operations.delete)}]({id:parent.record.id,revision:parent.revision});expect(files.size).toBe(1);expect(writes).toBe(4);
 }finally{repository.dispose();}
});
`,'managed');
  }
}
