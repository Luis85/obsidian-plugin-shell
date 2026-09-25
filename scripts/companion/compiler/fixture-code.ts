import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFixtureEngine } from '../../../docs/concepts/companion/test-kit/engine.mjs';
import { createFixtureAdapter } from '../../../docs/concepts/companion/test-kit/adapters.mjs';
import { json, literal, row, rows, text, requireValue, symbol, type Model, type Row } from './model.ts';
import { matches, type Schema } from '../runtime/contract.ts';
import { noteEntity } from './persistence-code.ts';
import { relativeImport, type Add } from './file-code.ts';
const kit = ['engine.mjs','adapters.mjs','storage.mjs','server.mjs','client.mjs','cli.mjs','faker-provider.mjs'];
/** Resolve portable recipe data; live endpoints and credential references never enter the kit. */
export function fixtureManifest(m: Model): Row | null {
  const design = row(m.document.design); const sourceDesign = row(design.dataSources ?? {});
  if (!sourceDesign.testing) return null;
  const settings = row(sourceDesign.testing); const recipes = rows(settings.recipes,288);
  requireValue(settings.schema === 1 && recipes.every(r=>typeof r.enabled==='boolean'), 'Invalid recipe settings.');
  const seen = new Set<string>();
  for (const recipe of recipes) {
    const id = text(recipe.operation); requireValue(!seen.has(id), 'Duplicate recipe operation.'); seen.add(id);
    requireValue(m.sources.some(s=>s.id===recipe.source && s.operations.some(o=>o.id===id)), 'Dangling test recipe.');
  }
  if (!recipes.some(r=>r.enabled)) return null;
  const relationships = rows(row(design.semantic ?? {}).relationships ?? [],120);
  const native = new Set(m.sources.flatMap(s=>s.operations.flatMap(o=>{const e=noteEntity(m,s.id,o.id);return e?[e.id]:[];})));
  // Related fixture notes must also be readable by canonical repositories.
  for (let changed=true; changed;) { changed=false; for(const r of relationships) if(native.has(String(r.source)) && !native.has(String(r.target))){native.add(String(r.target));changed=true;} }
  const entities = m.entities.map(entity=>{
    const schema:Schema & {properties?:Record<string,Schema & {default?:unknown}>} = structuredClone(entity.schema); schema.additionalProperties=false;
    schema.properties = {...schema.properties,id:{type:'string',format:'uuid'}};
    const authored=rows(row(design.semantic).entities,60).find(e=>e.id===entity.id)!;
    for(const property of rows(authored.properties ?? [],40))if(Object.hasOwn(property,'defaultValue')){
      const field=schema.properties[text(property.key)];requireValue(field && matches(property.defaultValue,field),'Invalid entity fixture default.');field.default=structuredClone(property.defaultValue);
    }
    if(native.has(entity.id)) {
      requireValue(!Object.hasOwn(schema.properties,'schema_version') && !Object.hasOwn(schema.properties,'created_at'), 'Reserved native fixture metadata.');
      Object.assign(schema.properties,{schema_version:{type:'integer',enum:[1]},created_at:{type:'string',enum:[String(settings.referenceDate)]}});
      schema.required=[...schema.required ?? [],'schema_version','created_at'];
    }
    return {id:entity.id,slug:entity.slug,folder:entity.folder,schema,relationships:relationships.filter(r=>r.source===entity.id).map(r=>({key:r.key,target:r.target,many:String(r.targetCard).endsWith('*')}))};
  });
  const operations = recipes.filter(r=>r.enabled).map(recipe=>{
    const source=m.sources.find(s=>s.id===recipe.source)!; const op=source.operations.find(o=>o.id===recipe.operation)!;
    requireValue(source.contract.status!=='deprecated','Disable recipes for deprecated sources.');
    const shape=(side:'input'|'output')=>{
      const original=row(op.contract[side]); const schema=op[side];
      if(schema===null)return {none:true};
      if(original.mode==='entity') {
        const entity=entities.find(e=>e.id===original.entity)!;
        return {entity:entity.id,many:original.many,schema:original.many?{type:'array',items:entity.schema}:entity.schema};
      }
      return {schema};
    };
    return {id:op.id,source:source.slug,slug:op.slug,kind:source.kind,direction:op.direction,method:op.contract.method,resource:op.contract.resource || (source.kind==='api'?'/':''),input:shape('input'),output:shape('output'),
      behavior:recipe.behavior,dataset:recipe.dataset,keyField:recipe.keyField,scenario:recipe.scenario,latencyMs:recipe.latencyMs,errorStatus:recipe.errorStatus,rules:recipe.rules};
  });
  const manifest={schema:1,engine:'shell-fixtures/1',target:'.test-vault',seed:settings.seed,count:settings.count,locale:settings.locale,referenceDate:settings.referenceDate,entities,operations};
  // Execute only our pinned, pure engine. No imported code, filesystem or live source access.
  createFixtureEngine().generate(manifest); createFixtureAdapter(manifest).dispose();
  return manifest;
}
export async function fixtureCode(template: string, m: Model, add: Add): Promise<boolean> {
  const manifest=fixtureManifest(m); if(!manifest)return false;
  for(const name of kit) add('scripts/test-data/'+name,await readFile(join(template,'docs/concepts/companion/test-kit',name),'utf8'),'managed');
  add('scripts/test-data/manifest.json',json(manifest),'managed');
  add('scripts/test-data/README.md',`# Project test-data tooling\n\nResolved from design/project.json. Development-only; no live endpoint or credential is copied.\n\nRun npm run testdata:plan, inspect its full file list, then npm run testdata:apply -- --approve HASH. This seeds only .test-vault, never the authoring vault. Reset requires testdata:reset-plan followed by testdata:reset -- --approve HASH; only unchanged receipt-owned files can be removed. Plugin installation and activation remain separate.\n\nNative entity fixtures contain schema_version and created_at required by the canonical Markdown codec. Generated recipe tests read those notes through real NoteRepository instances, not a fake Pinia action.\n\nAPI/database fixtures use the application-port simulator, not a real database driver. Testdata:serve provides the existing loopback-only HTTP server. Never fall back to live data when a recipe is absent. Seed, count, UTC reference date and the retained engine determine output. Empty/error/slow and stateful list/upsert/delete recipes retain their declared semantics.\n\nUse the generated scripts/test-data/source-ports.mjs to adapt simulator cancellation to the generated port signature. Pass complete per-source overrides into createSources(shell, overrides); partial source overrides are rejected rather than mixing simulated and live operations. Dispose the fixture adapter when its scope ends. No fixture code is imported by the production bootstrap.\n`,'managed');
  const adapter='scripts/test-data/source-ports.mjs';
  add(adapter,`import { createFixtureAdapter } from './adapters.mjs';\nexport function createProjectTestPorts(manifest) {\n  const adapter=createFixtureAdapter(manifest);\n  const sources=[...new Set(manifest.operations.filter(op=>op.kind!=='vault').map(op=>op.source))];\n  const ports=Object.fromEntries(sources.map(source=>{const port=adapter.port(source);return [source,Object.fromEntries(Object.entries(port).map(([slug,run])=>[slug,(input,signal)=>run(input,{signal})]))];}));\n  return {ports,dispose:()=>adapter.dispose()};\n}\n`,'managed');
  const test=`${m.testRoot}/recipes.test.mjs`;
  add(test,`import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createFixtureEngine } from ${literal(relativeImport(test,'scripts/test-data/engine.mjs'))};
import { createProjectTestPorts } from ${literal(relativeImport(test,adapter))};
const manifest=JSON.parse(await readFile(new URL(${literal(relativeImport(test,'scripts/test-data/manifest.json'))},import.meta.url),'utf8'));
it('exported recipes create deterministic contract-valid data without live I/O',()=>{
 const engine=createFixtureEngine();const before=JSON.stringify(manifest);const first=engine.generate(manifest);const second=engine.generate(manifest);
 expect(second).toEqual(first);expect(JSON.stringify(manifest)).toBe(before);expect(first.files.length).toBeGreaterThan(0);
 for(const op of first.operations)for(const side of ['input','output'])if(!op[side].none)expect(engine.matches(op[side+'Value'],op[side].schema)).toBe(true);
});
it('fixture source ports never expose vault adapters or a live fallback',()=>{
 const fixture=createProjectTestPorts(manifest);try{for(const op of manifest.operations)if(op.kind==='vault')expect(fixture.ports[op.source]).toBeUndefined();}finally{fixture.dispose();}
});
`,'managed');
  for(const source of m.sources) for(const op of source.operations) {
    const entity=noteEntity(m,source.id,op.id);
    const recipe=rows(manifest.operations,288).find(r=>r.id===op.id);
    if(!entity || !recipe || op.contract.implementation || ['error','empty'].includes(String(recipe.scenario)))continue;
    const path=`${m.testRoot}/recipes/${source.slug}-${op.slug}.test.mjs`;
    add(path,`import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createFixtureEngine } from ${literal(relativeImport(path,'scripts/test-data/engine.mjs'))};
import { NoteRepository } from ${literal(relativeImport(path,'src/application/note-repository.ts'))};
import { markdownCodec } from ${literal(relativeImport(path,'src/infrastructure/markdown.ts'))};
import { success, failure } from ${literal(relativeImport(path,'src/domain/outcome.ts'))};
import { document } from ${literal(relativeImport(path,`${m.sourceRoot}/application/documents/${entity.slug}.ts`))};
import { create${symbol(source.slug)}Service } from ${literal(relativeImport(path,`${m.sourceRoot}/application/${source.slug}/service.ts`))};
it(${literal(op.slug+' consumes actual seeded Markdown through the canonical repository')},async()=>{
 const manifest=JSON.parse(await readFile(new URL(${literal(relativeImport(path,'scripts/test-data/manifest.json'))},import.meta.url),'utf8'));
 const generated=createFixtureEngine().generate(manifest);const files=new Map(generated.files.map(f=>[f.path,f.content]));
 const storage={list:async(folder)=>success([...files.keys()].filter(p=>p.startsWith(folder+'/')&&p.endsWith('.md'))),read:async(p)=>files.has(p)?success(files.get(p)):failure('storage','error.read'),create:async()=>{throw Error('NO_WRITE');},replace:async()=>{throw Error('NO_WRITE');},trash:async()=>{throw Error('NO_WRITE');}};
 const repository=new NoteRepository(document,storage,markdownCodec,{publish:()=>{}},()=>${literal(entity.folder)},()=> 'unused',()=>manifest.referenceDate,{report:()=>{}});
 try{const port={${literal(op.slug)}:async()=>{const result=await repository.list();if(!result.ok)throw Error(result.error.code);return result.value.map(s=>({...s.values,id:s.id,type:${literal(entity.slug)}}));}};
 const records=await create${symbol(source.slug)}Service(port)[${literal(op.slug)}](undefined);expect(records).toHaveLength(manifest.count);expect(new Set(records.map(r=>r.id)).size).toBe(manifest.count);
 }finally{repository.dispose();}
});
`,'managed');
  }
  return true;
}
