import { posix } from 'node:path';
import { literal, json, symbol, type Model, type Schema } from './model.ts';
import { typeCode, sampleCode } from './schema-code.ts';
export interface Entry { path: string; content: string; encoding?: 'base64'; ownership: 'managed' | 'extension' | 'framework' }
export type Add = (path: string, content: string, ownership?: Entry['ownership']) => void;
export function relativeImport(from: string, to: string): string { const path = posix.relative(posix.dirname(from),to); return path.startsWith('.') ? path : './'+path; }
function contract(name: string, schema: Schema | null): string {
  return `export type ${name} = ${typeCode(schema)};\nexport const ${name}Schema: Schema | null = ${literal(schema)};\nexport function is${name}(value: unknown): value is ${name} { return matches(value,${name}Schema); }\n`;
}
export function dataCode(m: Model, add: Add): void {
  const root = m.sourceRoot; const tests = m.testRoot; const serviceImports: string[] = []; const serviceProps: string[] = []; const sourceInit: string[] = []; const sourceTypes: string[] = [];
  for (const e of m.entities) {
    const name = symbol(e.slug); const path = `${root}/domain/entities/${e.slug}.ts`;
    add(path, `import { matches, type Schema } from '../contract.ts';\n${contract(name,e.schema)}\nexport const definition = ${literal({id:e.id,slug:e.slug,name:e.name,folder:e.folder})};\n`);
    const test = `${tests}/entities/${e.slug}.test.ts`;
    add(test, `import { it, expect } from 'vitest';\nimport { is${name} } from ${literal(relativeImport(test,path))};\nit(${literal(e.slug+' validates its declared fields')}, () => { expect(is${name}(${sampleCode(e.schema)})).toBe(true); expect(is${name}(null)).toBe(false); expect(is${name}({})).toBe(false); });\n`);
  }
  for (const source of m.sources) {
    const name = symbol(source.slug); const dir = `${root}/application/${source.slug}`; const path = `${dir}/contracts.ts`;
    let contracts = `import { matches, type Schema } from '../../domain/contract.ts';\n`;
    let methods = ''; let portMethods = ''; let actions = ''; const fixtures: string[] = [];
    const cases: string[] = []; const names: string[] = [];
    for (const op of source.operations) {
      const n = symbol(op.slug); const input = `${n}Input`; const output = `${n}Output`; names.push(input,output,`is${input}`,`is${output}`);
      contracts += contract(input,op.input) + contract(output,op.output);
      portMethods += `  ${literal(op.slug)}(input: ${input}, signal?: AbortSignal): Promise<unknown>;\n`;
      methods += `    async ${literal(op.slug)}(input: ${input}, signal?: AbortSignal): Promise<${output}> {\n      if (signal?.aborted) throw new Error('OPERATION_ABORTED');\n      if (!is${input}(input)) throw new Error('INVALID_INPUT: ${source.slug}/${op.slug}');\n      const value = await port[${literal(op.slug)}](input,signal);\n      if (!is${output}(value)) throw new Error('INVALID_OUTPUT: ${source.slug}/${op.slug}');\n      return value;\n    },\n`;
      actions += `    ${literal(op.slug)}: operation(service[${literal(op.slug)}],${literal(op.direction)}),\n`;
      fixtures.push(`${literal(op.slug)}: async () => (${sampleCode(op.output)})`);
      cases.push(`it(${literal(op.slug+' executes the real service and Pinia state')}, async () => {\n  const pinia = createPinia();\n  try { const service = create${name}Service(fixture()); const state = define${name}Store(service)(pinia);\n    expect((await state[${literal(op.slug)}].execute(${sampleCode(op.input)})).ok).toBe(true);\n    expect(state[${literal(op.slug)}].data).toEqual(${sampleCode(op.output)}); expect(state[${literal(op.slug)}].pending).toBe(false);\n  } finally { disposePinia(pinia); }\n});\n`);
      cases.push(`it(${literal(op.slug+' reports adapter failure without success')}, async () => {\n  const pinia = createPinia();\n  try { const port = fixture(); port[${literal(op.slug)}] = async () => { throw new Error('fixture'); };\n    const state = define${name}Store(create${name}Service(port))(pinia);\n    expect((await state[${literal(op.slug)}].execute(${sampleCode(op.input)})).ok).toBe(false);\n    expect(state[${literal(op.slug)}].data).toBe(null); expect(state[${literal(op.slug)}].error).toBe('operation-failed');\n  } finally { disposePinia(pinia); }\n});\n`);
    }
    contracts += `export interface ${name}Port {\n${portMethods}}\n`;
    add(path,contracts);
    const imports = names.map(n => n.startsWith('is') ? n : 'type '+n).join(', ');
    add(`${dir}/service.ts`,`import { ${imports}${imports ? ', ' : ''}type ${name}Port } from './contracts.ts';\n/** Canonical behavior belongs in this service/adapter, not the per-view Pinia store. */\nexport function create${name}Service(port: ${name}Port) {\n  return {\n${methods}  };\n}\nexport type ${name}Service = ReturnType<typeof create${name}Service>;\n`);
    const adapter = `${root}/infrastructure/sources/${source.slug}.ts`;
    add(adapter,`import type { ${name}Port } from '../../application/${source.slug}/contracts.ts';\nimport type { Services } from ${literal(relativeImport(adapter,'src/bootstrap/services.ts'))};\nimport { NotImplementedError } from '../../domain/contract.ts';\n/** ${source.kind} adapter seam. Use shell services; never introduce a second saveData owner.\n * The export describes contracts, not permission to access a vault/network/database. */\nexport function create${name}Adapter(_shell: Services): ${name}Port {\n  return {\n${source.operations.map(o => `    async ${literal(o.slug)}(_input, _signal) { throw new NotImplementedError(${literal(source.id)},${literal(o.id)}); },`).join('\n')}\n  };\n}\n`);
    add(`${root}/presentation/stores/${source.slug}.ts`,`import { defineStore } from 'pinia';\nimport { operation } from '../composables/operation.ts';\nimport type { ${name}Service } from '../../application/${source.slug}/service.ts';\nexport function define${name}Store(service: ${name}Service) {\n  return defineStore(${literal(String(m.project.id)+':source:'+source.slug)}, () => ({\n${actions}  }));\n}\n`);
    add(`${tests}/sources/${source.slug}.test.ts`,`import { it, expect } from 'vitest';\nimport { createPinia, disposePinia } from 'pinia';\nimport { create${name}Service } from ${literal(relativeImport(`${tests}/sources/${source.slug}.test.ts`,`${dir}/service.ts`))};\nimport { define${name}Store } from ${literal(relativeImport(`${tests}/sources/${source.slug}.test.ts`,`${root}/presentation/stores/${source.slug}.ts`))};\nimport type { ${name}Port } from ${literal(relativeImport(`${tests}/sources/${source.slug}.test.ts`,path))};\nconst fixture = (): ${name}Port => ({${fixtures.join(',\n')}});\n${cases.join('\n')}`);
    serviceImports.push(`import { create${name}Service } from '../application/${source.slug}/service.ts';\nimport { create${name}Adapter } from '../infrastructure/sources/${source.slug}.ts';`);
    serviceProps.push(`${literal(source.slug)}: create${name}Service(create${name}Adapter(shell))`);
    sourceTypes.push(`import type { ${name}Service } from './${source.slug}/service.ts';`);
    sourceInit.push(`${literal(source.slug)}: ${name}Service;`);
    add(`design/sources/${source.slug}.json`,json(source.contract),'managed');
  }
  add(`${root}/application/sources.ts`,sourceTypes.join('\n')+`\nexport interface Sources { ${sourceInit.join('\n')} }\n`,'managed');
  add(`${root}/bootstrap/sources.ts`,serviceImports.join('\n')+`\nimport type { Services } from ${literal(relativeImport(`${root}/bootstrap/sources.ts`,'src/bootstrap/services.ts'))};\nimport type { Sources } from '../application/sources.ts';\nexport function createSources(shell: Services): Sources { return {${serviceProps.join(',\n')}}; }\n`,'managed');
  for (const r of m.requirements) {
    add(`${root}/application/use-cases/${r.key}.ts`,`import type { Sources } from '../sources.ts';\nimport { NotImplementedError } from '../../domain/contract.ts';\nexport const requirement = ${literal(r)};\n/** Refine input/output and implement only after writing the failing acceptance test. */\nexport async function execute(_input: unknown, _sources: Sources): Promise<unknown> {\n  throw new NotImplementedError(${literal(r.prd)},${literal(r.id)});\n}\n`);
    add(`${tests}/acceptance/${r.key}.test.ts`,`import { it } from 'vitest';\n// Implement a failing behavioral assertion against application/use-cases/${r.key}.ts first.\n// This TODO is intentionally NOT verification evidence. Do not replace it with a trivial assertion.\nit.todo(${literal('['+r.id+'] '+r.title+' — '+r.acceptance)});\n`);
  }
}
