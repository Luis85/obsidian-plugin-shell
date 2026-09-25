import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { literal, requireValue, symbol, type Model, type Entity } from './model.ts';
import type { Schema } from '../runtime/contract.ts';
import { relativeImport, type Add } from './file-code.ts';
import { sampleCode, typeCode } from './schema-code.ts';
import { validateNoteWire } from './note-contracts.ts';
function field(s: Schema, index: number): string {
  requireValue(['string','number','integer','boolean'].includes(String(s.type)) || s.type === 'array' && s.items?.type === 'string', 'Native notes require scalar values or string lists; nested objects need a separate declared codec.');
  const kind = s.type === 'array' ? 'list' : s.type === 'string' ? (s.format === 'date' ? 'date' : 'text') : s.type === 'boolean' ? 'boolean' : 'number';
  return `function isF${index}(value: unknown): value is ${typeCode(s)} { return matches(value,${literal(s)}); }
const f${index} = {required:true as const,kind:${literal(kind)} as const,read(value:unknown) { return isF${index}(value) ? success(${s.type === 'array' ? 'Object.freeze([...value])' : 'value'}) : failure('validation','error.entity'); }};`;
}
export function noteEntity(m: Model, sourceId: string, operationId: string): Entity | undefined {
  const source = m.sources.find(s => s.id === sourceId)!; const op = source.operations.find(o => o.id === operationId)!;
  const declared = op.contract.implementation as { kind?: string; entity?: string; operation?: string } | undefined;
  if (declared) {
    requireValue(Object.keys(declared).length === 3 && Object.keys(declared).every(key=>['kind','entity','operation'].includes(key)) && source.kind === 'vault' && declared.kind === 'note' && ['list','create','update','delete'].includes(String(declared.operation)), 'Unsupported persistence adapter.');
    const entity = m.entities.find(e => e.id === declared.entity); requireValue(entity && entity.folder !== '' && entity.folder === op.contract.resource, 'Native repository needs an exact declared entity folder.');
    validateNoteWire(entity,op,String(declared.operation));
    return entity;
  }
  const output = op.contract.output as { mode?: string; entity?: string; many?: boolean };
  if (source.kind === 'vault' && op.direction === 'read' && op.input === null && output.mode === 'entity' && output.many) return m.entities.find(e => e.id === output.entity && e.folder === op.contract.resource && e.folder !== '');
  return undefined;
}
export async function persistenceCode(templateRoot: string, m: Model, add: Add): Promise<void> {
  const selected = new Map<string, Entity>();
  for (const source of m.sources) for (const op of source.operations) { const entity = noteEntity(m, source.id, op.id); if (entity) selected.set(entity.id, entity); }
  if (!selected.size) return;
  const imports: string[] = []; const registrations: string[] = [];
  for (const entity of selected.values()) {
    requireValue(!['task','project','items'].includes(entity.slug), 'Remove/rename the corresponding framework example before registering its canonical entity key.');
    const props = Object.entries(entity.schema.properties ?? {}).filter(([key]) => !['id','type'].includes(key));
    requireValue(props.length && props.every(([key]) => /^[a-z][a-zA-Z0-9_]*$/.test(key) && !['schema_version','created_at','constructor','prototype'].includes(key)), 'Native property mapping requires portable frontmatter keys.');
    const title = props.find(([key, s]) => key === 'title' && s.type === 'string');
    requireValue(title && entity.schema.required?.includes('title') && entity.slug.length <= 50, 'Declare a title field for a native note repository.');
    const name = symbol(entity.slug); const file = `${m.sourceRoot}/application/documents/${entity.slug}.ts`;
    const fields = props.map(([key],index) => `${literal(key)}: ${entity.schema.required?.includes(key) ? 'f'+index : `fields.optional(f${index})`}`).join(',\n');
    const validators = props.map(([,schema],index) => field(schema,index)).join('\n');
    add(file, `import { defineEntity, fields } from ${literal(relativeImport(file, 'src/domain/entity.ts'))};
import { matches } from '../../domain/contract.ts';
import { success, failure } from ${literal(relativeImport(file, 'src/domain/outcome.ts'))};
import { defineDocument, heading } from ${literal(relativeImport(file, 'src/application/document-definition.ts'))};
import { defineNoteFeature } from ${literal(relativeImport(file, 'src/application/note-feature.ts'))};
${validators}
export const entity = defineEntity(${literal(entity.slug)},1,{${fields}});
export const document = defineDocument(entity,{mappings:${literal(props.map(([key]) => ({field:key,property:key})))},title: values => String(values.title ?? ''),body: values => '# ' + heading(String(values.title ?? '')) + '\\n'});
export const feature = defineNoteFeature({document,defaultFolder:${literal(entity.folder)}});
`);
    imports.push(`import { feature as ${name} } from ${literal(relativeImport('src/bootstrap/features.ts', file))};`);
    registrations.push(`    ${name}: register(${name}),`);
    const test = `${m.testRoot}/persistence/${entity.slug}.test.ts`;
    const input: Schema = {...entity.schema, properties:Object.fromEntries(props), required:props.map(([key])=>key), additionalProperties:false};
    add(test, `import { it, expect } from 'vitest';
import { NoteRepository } from ${literal(relativeImport(test,'src/application/note-repository.ts'))};
import { markdownCodec } from ${literal(relativeImport(test,'src/infrastructure/markdown.ts'))};
import { success, failure } from ${literal(relativeImport(test,'src/domain/outcome.ts'))};
import { document as recipe } from ${literal(relativeImport(test,file))};
it('persists every ${entity.slug} field, rejects stale edits and preserves unrelated Markdown', async () => {
  const files = new Map<string,string>(); let writes = 0;
  const storage = {
    list: async () => success([...files.keys()]), read: async (path:string) => files.has(path) ? success(files.get(path)!) : failure('storage','error.read'),
    create: async (path:string, body:string) => { if(files.has(path)) return failure('conflict','error.conflict'); files.set(path,body); writes++; return success(undefined); },
    replace: async (path:string, before:string, after:string) => { if(files.get(path)!==before) return failure('stale','error.stale'); files.set(path,after); writes++; return success(undefined); },
    trash: async (path:string, before:string) => { if(files.get(path)!==before) return failure('stale','error.stale'); files.delete(path); writes++; return success(undefined); },
  };
  const events: string[] = []; const repository = new NoteRepository(recipe,storage,markdownCodec,{publish:e=>{events.push(e.type);}},()=>${literal(entity.folder)},()=> 'fixture-id',()=> '2026-01-01T00:00:00Z',{report:()=>{}});
  const values = ${sampleCode(input)};
  const first = await repository.create(values,'create-1'); expect(first.ok).toBe(true); if(!first.ok) throw new Error('CREATE_FAILED');
  expect((await repository.create(values,'create-1')).ok).toBe(true); expect(writes).toBe(1);
  expect(first.value.values).toEqual(values); const path=first.value.path;
  files.set(path,files.get(path)!.replace('---\\n','---\\nforeign: retained\\n')+'\\nUnrelated body');
  expect((await repository.update(first.value,values)).ok).toBe(false); expect(writes).toBe(1);
  const current = await repository.get(path); if(!current.ok) throw new Error('READ_FAILED');
  expect((await repository.update(current.value,{...values,title:'Changed'})).ok).toBe(true);
  expect(files.get(path)).toContain('foreign: retained'); expect(files.get(path)).toContain('Unrelated body');
  const latest=await repository.get(path); if(!latest.ok) throw new Error('READ_FAILED');
  expect((await repository.delete(latest.value)).ok).toBe(true); expect(files.size).toBe(0);
  expect(events).toEqual(['documents.created','documents.updated','documents.deleted']);
  repository.dispose(); expect((await repository.create(values,'after-dispose')).ok).toBe(false);
});
`);
  }
  const original = await readFile(join(templateRoot, 'src/bootstrap/features.ts'), 'utf8');
  requireValue(original.includes('    items: register(itemFeature),'), 'Review customized feature registry before generating native repositories.');
  add('src/bootstrap/features.ts', imports.join('\n')+'\n'+original.replace('    items: register(itemFeature),','    items: register(itemFeature),\n'+registrations.join('\n')));
  const registryTest = `${m.testRoot}/persistence/registry.test.ts`;
  add(registryTest, `import { it, expect } from 'vitest';
import { createFeatures } from ${literal(relativeImport(registryTest,'src/bootstrap/features.ts'))};
import { PluginDataStore } from ${literal(relativeImport(registryTest,'src/application/plugin-data-store.ts'))};
import { PreferenceService } from ${literal(relativeImport(registryTest,'src/application/preference-service.ts'))};
import { markdownCodec } from ${literal(relativeImport(registryTest,'src/infrastructure/markdown.ts'))};
import { success, failure } from ${literal(relativeImport(registryTest,'src/domain/outcome.ts'))};
it('composes every generated repository with the actual retained framework registry', async () => {
  const errors={report:()=>{}}; const events={publish:()=>{}};
  const data=new PluginDataStore({load:async()=>null,save:async()=>{}},errors);
  const preferences=new PreferenceService(data,events,errors); await preferences.load();
  const storage={list:async()=>success([] as string[]),read:async()=>failure('storage','error.read'),create:async()=>success(undefined),replace:async()=>success(undefined),trash:async()=>success(undefined)};
  const registry=createFeatures({storage,codec:markdownCodec,events,errors,pluginData:data,newId:()=> 'fixture-id',now:()=> '2026-01-01T00:00:00Z'},preferences);
  try { ${[...selected.values()].map(e=>`expect((await registry.repositories.${symbol(e.slug)}.list()).ok).toBe(true);`).join('\n')} }
  finally { registry.dispose(); preferences.dispose(); data.dispose(); }
});
`);
  const sourceFile = `${m.sourceRoot}/application/note-operations.ts`;
  add(sourceFile, await readFile(join(templateRoot,'scripts/companion/runtime/note-operations.ts'),'utf8'));
}
