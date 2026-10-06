import { relationshipScope } from './relationship-model.ts';
import { noteEntity } from './persistence-code.ts';
import type { Schema } from '#shared/companion/runtime-contract.ts';
import { literal, json, symbol, type Entity, type Model, type Source } from './model.ts';
import { typeCode, sampleCode } from './schema-code.ts';
import { relativeImport, type Add } from './file-code.ts';
function contract(name: string, schema: Schema | null): string {
  return `export type ${name} = ${typeCode(schema)};\nexport const ${name}Schema: Schema | null = ${literal(schema)};\nexport function is${name}(value: unknown): value is ${name} { return matches(value,${name}Schema); }\n`;
}
/** Declare only the adapter parameters the generated body reads; the exported type keeps the full signature. */
function adapterParameters(body: string): string {
  return /\bintegrity\b/.test(body) ? '_shell, integrity' : /\b_shell\b/.test(body) ? '_shell' : '';
}
type Integrity = ReturnType<typeof relationshipScope>;
function entityFiles(m: Model, add: Add): void {
  for (const e of m.entities) {
    const name = symbol(e.slug); const path = `${m.sourceRoot}/domain/entities/${e.slug}.ts`;
    add(path, `import { matches, type Schema } from '../contract.ts';\n${contract(name,e.schema)}\nexport const definition = ${literal({id:e.id,slug:e.slug,name:e.name,folder:e.folder})};\n`);
    const test = `${m.testRoot}/entities/${e.slug}.test.ts`;
    add(test, `import { it, expect } from 'vitest';\nimport { is${name} } from ${literal(relativeImport(test,path))};\nit(${literal(e.slug+' validates its declared fields')}, () => { expect(is${name}(${sampleCode(e.schema)})).toBe(true); expect(is${name}(null)).toBe(false); expect(is${name}({})).toBe(false); });\n`);
  }
}
/** Per-operation text of a source: contract types, port and service methods, store action, fixture and store tests. */
interface SourceParts { contracts: string; methods: string; portMethods: string; actions: string; fixtures: string[]; cases: string[]; names: string[] }
function operationParts(source: Source, name: string): SourceParts {
  const parts: SourceParts = { contracts: `import { matches, type Schema } from '../../domain/contract.ts';\n`, methods: '', portMethods: '', actions: '', fixtures: [], cases: [], names: [] };
  for (const op of source.operations) {
    const n = symbol(op.slug); const input = `${n}Input`; const output = `${n}Output`; parts.names.push(input,output,`is${input}`,`is${output}`);
    parts.contracts += contract(input,op.input) + contract(output,op.output);
    parts.portMethods += `  ${literal(op.slug)}(input: ${input}, signal?: AbortSignal): Promise<unknown>;\n`;
    parts.methods += `    async ${literal(op.slug)}(input: ${input}, signal?: AbortSignal): Promise<${output}> {\n      if (signal?.aborted) throw new Error('OPERATION_ABORTED');\n      if (!is${input}(input)) throw new Error('INVALID_INPUT: ${source.slug}/${op.slug}');\n      const value = await port[${literal(op.slug)}](input,signal);\n      if (!is${output}(value)) throw new Error('INVALID_OUTPUT: ${source.slug}/${op.slug}');\n      return value;\n    },\n`;
    parts.actions += `    ${literal(op.slug)}: operation(service[${literal(op.slug)}],${literal(op.direction)}),\n`;
    parts.fixtures.push(`${literal(op.slug)}: async () => (${sampleCode(op.output)})`);
    parts.cases.push(`it(${literal(op.slug+' executes the real service and Pinia state')}, async () => {\n  const pinia = createPinia();\n  try { const service = create${name}Service(fixture()); const state = define${name}Store(service)(pinia);\n    expect((await state[${literal(op.slug)}].execute(${sampleCode(op.input)})).ok).toBe(true);\n    expect(state[${literal(op.slug)}].data).toEqual(${sampleCode(op.output)}); expect(state[${literal(op.slug)}].pending).toBe(false);\n  } finally { disposePinia(pinia); }\n});\n`);
    parts.cases.push(`it(${literal(op.slug+' reports adapter failure without success')}, async () => {\n  const pinia = createPinia();\n  try { const port = fixture(); port[${literal(op.slug)}] = async () => { throw new Error('fixture'); };\n    const state = define${name}Store(create${name}Service(port))(pinia);\n    expect((await state[${literal(op.slug)}].execute(${sampleCode(op.input)})).ok).toBe(false);\n    expect(state[${literal(op.slug)}].data).toBe(null); expect(state[${literal(op.slug)}].error).toBe('operation-failed');\n  } finally { disposePinia(pinia); }\n});\n`);
  }
  return parts;
}
/** One adapter member: HTTPS port, explicit implementation point, native note operation or native read-only list. */
function adapterMethod(m: Model, source: Source, op: Source['operations'][number]): string {
  const entity = noteEntity(m,source.id,op.id);
  if (source.kind === 'api') return `    ${literal(op.slug)}: http.port[${literal(op.slug)}],`;
  if (!entity) return `    async ${literal(op.slug)}() { throw new NotImplementedError(${literal(source.id)},${literal(op.id)}); },`;
  if (op.contract.implementation) return `    ${literal(op.slug)}: ${symbol(entity.slug)}Notes.${(op.contract.implementation as {operation:string}).operation},`;
  return `    async ${literal(op.slug)}(_input, signal) { if(signal?.aborted) throw new Error('OPERATION_ABORTED'); const result=await _shell.repositories.${symbol(entity.slug)}.list(); if(!result.ok) throw new Error('NOTE_READ_FAILED'); return result.value.map(snapshot=>({...snapshot.values,id:snapshot.id,type:${literal(entity.slug)}})); },`;
}
function adapterSource(m: Model, source: Source, integrity: Integrity, adapter: string): string {
  const name = symbol(source.slug), rules = integrity.rules.length > 0;
  const native = new Map(source.operations.flatMap(op => { const e = noteEntity(m,source.id,op.id); return e && op.contract.implementation ? [[e.id,e] as const] : []; }));
  const protectedEntity = (e: Entity) => integrity.entities.some(x=>x.id===e.id);
  const nativeImports = [...native.values()].map(e => `import { entity as ${symbol(e.slug)}Entity } from '../../application/documents/${e.slug}.ts';`).join('\n');
  const nativeInit = [...native.values()].map(e => `  const ${symbol(e.slug)}Notes = noteOperations(${protectedEntity(e)?`protectNoteRelationships(_shell.repositories.${symbol(e.slug)}, integrity)`:`_shell.repositories.${symbol(e.slug)}`},${literal(e.slug)},input => { const result=${symbol(e.slug)}Entity.decode(input); if(!result.ok) throw new Error('NOTE_VALUES_INVALID'); return result.value; });`).join('\n');
  const adapterMethods = source.operations.map(op => adapterMethod(m, source, op)).join('\n');
  const api = source.kind==='api';
  return `import type { ${name}Port } from '../../application/${source.slug}/contracts.ts';
import type { Services } from ${literal(relativeImport(adapter,'src/bootstrap/services.ts'))};
${adapterMethods.includes('NotImplementedError') ? "import { NotImplementedError } from '../../domain/contract.ts';" : ''}
${native.size ? "import { noteOperations } from '../../application/note-operations.ts';" : ''}
${rules?"import type { RelationshipSession } from '../../application/relationship-session.ts';":''}
${[...native.values()].some(protectedEntity)?"import { protectNoteRelationships } from '../../application/relationship-session.ts';":''}
${api?`import { create${name}HttpProvider } from './${source.slug}-http.ts';`:''}
${nativeImports}
/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const create${name}Adapter: (shell: Services${rules?', integrity: RelationshipSession':''}) => ${name}Port = (${adapterParameters(nativeInit+adapterMethods)}) => {
${nativeInit}
${api?`  const http=create${name}HttpProvider();`:''}
  return {
${adapterMethods}
  };
};
`;
}
/** Registry lines one source contributes to application/sources.ts and bootstrap/sources.ts. */
interface SourceRegistry { serviceImports: string[]; serviceProps: string[]; sourceInit: string[]; sourceTypes: string[]; portTypes: string[]; portProps: string[] }
function sourceFiles(m: Model, source: Source, integrity: Integrity, add: Add, registry: SourceRegistry): void {
  const root = m.sourceRoot, tests = m.testRoot, name = symbol(source.slug), dir = `${root}/application/${source.slug}`, path = `${dir}/contracts.ts`;
  const parts = operationParts(source, name);
  add(path, parts.contracts + `export interface ${name}Port {\n${parts.portMethods}}\n`);
  const imports = parts.names.map(n => n.startsWith('is') ? n : 'type '+n).join(', ');
  add(`${dir}/service.ts`,`import { ${imports}${imports ? ', ' : ''}type ${name}Port } from './contracts.ts';\n/** Canonical behavior belongs in this service/adapter, not the per-view Pinia store. */\nexport function create${name}Service(port: ${name}Port) {\n  return {\n${parts.methods}  };\n}\nexport type ${name}Service = ReturnType<typeof create${name}Service>;\n`);
  const adapter = `${root}/infrastructure/sources/${source.slug}.ts`;
  add(adapter, adapterSource(m, source, integrity, adapter));
  add(`${root}/presentation/stores/${source.slug}.ts`,`import { defineStore } from 'pinia';\nimport { operation } from '../composables/operation.ts';\nimport type { ${name}Service } from '../../application/${source.slug}/service.ts';\nexport function define${name}Store(service: ${name}Service) {\n  return defineStore(${literal(String(m.project.id)+':source:'+source.slug)}, () => ({\n${parts.actions}  }));\n}\n`);
  const test = `${tests}/sources/${source.slug}.test.ts`;
  add(test,`import { it, expect } from 'vitest';\nimport { createPinia, disposePinia } from 'pinia';\nimport { create${name}Service } from ${literal(relativeImport(test,`${dir}/service.ts`))};\nimport { define${name}Store } from ${literal(relativeImport(test,`${root}/presentation/stores/${source.slug}.ts`))};\nimport type { ${name}Port } from ${literal(relativeImport(test,path))};\nconst fixture = (): ${name}Port => ({${parts.fixtures.join(',\n')}});\n${parts.cases.join('\n')}`);
  registry.serviceImports.push(`import { create${name}Service } from '../application/${source.slug}/service.ts';\nimport { create${name}Adapter } from '../infrastructure/sources/${source.slug}.ts';`);
  registry.serviceProps.push(`${literal(source.slug)}: create${name}Service(overrides[${literal(source.slug)}] ?? create${name}Adapter(shell${integrity.rules.length?', integrity':''}))`);
  registry.portTypes.push(`import type { ${name}Port } from './${source.slug}/contracts.ts';`);
  registry.portProps.push(`${literal(source.slug)}: ${name}Port;`);
  registry.sourceTypes.push(`import type { ${name}Service } from './${source.slug}/service.ts';`);
  registry.sourceInit.push(`${literal(source.slug)}: ${name}Service;`);
  add(`design/sources/${source.slug}.json`,json(source.contract),'managed');
}
function registryFiles(m: Model, integrity: Integrity, registry: SourceRegistry, add: Add): void {
  const root = m.sourceRoot, { serviceImports, serviceProps, sourceInit, sourceTypes, portTypes, portProps } = registry;
  add(`${root}/application/sources.ts`,sourceTypes.join('\n')+'\n'+portTypes.join('\n')+`\n${sourceInit.length ? `export interface Sources { ${sourceInit.join('\n')} }\nexport interface SourcePorts { ${portProps.join('\n')} }` : 'export type Sources = Record<string, never>;\nexport type SourcePorts = Record<string, never>;'}\n`,'managed');
  add(`${root}/bootstrap/sources.ts`,serviceImports.join('\n')+`\n${integrity.rules.length ? "import { createRelationshipIntegrity } from './relationships.ts';" : ''}\nimport type { Services } from ${literal(relativeImport(`${root}/bootstrap/sources.ts`,'src/bootstrap/services.ts'))};\nimport type { Sources, SourcePorts } from '../application/sources.ts';\nimport { validateSourceOverrides } from '../application/source-overrides.ts';\nexport function createSources(shell: Services, overrides: Partial<SourcePorts> = {}): Sources {\n validateSourceOverrides(overrides,${literal(Object.fromEntries(m.sources.map(source=>[source.slug,source.operations.map(op=>op.slug)])))});\n ${integrity.rules.length ? 'const integrity=createRelationshipIntegrity(shell);' : ''}\n return {${serviceProps.join(',\n')}}; }\n`,'managed');
}
function requirementFiles(m: Model, add: Add): void {
  for (const r of m.requirements) {
    add(`${m.sourceRoot}/application/use-cases/${r.key}.ts`,`import type { Sources } from '../sources.ts';\nimport { NotImplementedError } from '../../domain/contract.ts';\nexport const requirement = ${literal(r)};\n/** Refine input/output and implement only after writing the failing acceptance test. */\nexport const execute: (input: unknown, sources: Sources) => Promise<unknown> = async () => {\n  throw new NotImplementedError(${literal(r.prd)},${literal(r.id)});\n};\n`);
    add(`${m.testRoot}/acceptance/${r.key}.test.ts`,`import { it } from 'vitest';\n// Implement a failing behavioral assertion against application/use-cases/${r.key}.ts first.\n// This TODO is intentionally NOT verification evidence. Do not replace it with a trivial assertion.\nit.todo(${literal('['+r.id+'] '+r.title+' — '+r.acceptance)});\n`);
  }
}
export function dataCode(m: Model, add: Add): void {
  const integrity=relationshipScope(m);
  const registry: SourceRegistry = { serviceImports: [], serviceProps: [], sourceInit: [], sourceTypes: [], portTypes: [], portProps: [] };
  entityFiles(m, add);
  for (const source of m.sources) sourceFiles(m, source, integrity, add, registry);
  registryFiles(m, integrity, registry, add);
  requirementFiles(m, add);
}
