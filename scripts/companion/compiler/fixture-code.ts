import { fixtureNoteTests } from './fixture-notes-code.ts';
import { sampleCode } from './schema-code.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCompanionFixtureManifest } from '../test-data-manifest.mjs';
import { createFixtureEngine } from '../../../docs/concepts/companion/test-kit/engine.mjs';
import { createFixtureAdapter } from '../../../docs/concepts/companion/test-kit/adapters.mjs';
import { noteEntity } from './persistence-code.ts';
import { json, literal, row, symbol, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
const kitFiles = ['engine.mjs', 'adapters.mjs', 'storage.mjs', 'server.mjs', 'client.mjs', 'cli.mjs', 'faker-provider.mjs'];
export function fixtureManifest(m: Model) {
  const manifest = buildCompanionFixtureManifest(row(m.document.design));
  if (!manifest.operations.length) return null;
  createFixtureEngine().generate(manifest);
  createFixtureAdapter(manifest).dispose();
  return manifest;
}
/** The same reviewed fixture engine used by the browser validates recipes before any writes. */
export async function fixtureCode(templateRoot: string, m: Model, add: Add): Promise<boolean> {
  const manifest = fixtureManifest(m);
  if (!manifest) return false;
  createFixtureEngine().generate(manifest);
  fixtureNoteTests(m,add);
  createFixtureAdapter(manifest).dispose();
  for (const name of kitFiles) add('scripts/test-data/' + name, await readFile(join(templateRoot, 'docs/concepts/companion/test-kit', name), 'utf8'), 'managed');
  add('scripts/test-data/manifest.json', json(manifest), 'managed');
  add('scripts/test-data/adapters.d.mts', `export interface FixtureAdapter {
execute(id: string, input?: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
port(source: string): Readonly<Record<string, (input?: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>>>;
reset(): void; captured(): Array<{operation: string; direction: string; input: unknown}>; dispose(): void;
}
export function createFixtureAdapter(manifest: unknown): FixtureAdapter;
`, 'managed');
  add('scripts/test-data/engine.d.mts', `export interface GeneratedFixtures {
files: Array<{path: string; content: string; owner: string}>;
operations: Array<{id: string; source: string; slug: string; kind: string; input: {none?: boolean; schema?: unknown}; output: {none?: boolean; schema?: unknown}; inputValue: unknown; outputValue: unknown}>;
bytes: number;
}
export function createFixtureEngine(): {generate(manifest: unknown): GeneratedFixtures; matches(value: unknown, schema: unknown): boolean};
`, 'managed');
  add('scripts/test-data/verify.mjs', `import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createFixtureEngine } from './engine.mjs';
import { createFixtureAdapter } from './adapters.mjs';
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const engine = createFixtureEngine(), first = engine.generate(manifest);
assert.deepEqual(engine.generate(manifest), first, 'Seeded fixtures must be deterministic');
const adapter = createFixtureAdapter(manifest); adapter.dispose();
console.log(JSON.stringify({status:'fixture-contracts-verified',operations:first.operations.length,files:first.files.length,bytes:first.bytes,nativeAcceptance:'not-run'}));
`, 'managed');
  add('scripts/test-data/README.md', `# Generated test data

The exported DataSource recipes are compiled into manifest.json by the same data-only translator as the companion prototype. Generation validates the actual fixture engine and simulator but never seeds notes, starts a server, installs a package, or contacts a provider.

Run npm run testdata:check to check reproducibility. Run npm run testdata:plan, review the approval and file list, then npm run testdata:apply -- --approve HASH. The writer is contained in this project's .test-vault and refuses foreign/edited files. Regeneration of code does not re-seed or reset data. Use npm run testdata:reset-plan followed by npm run testdata:reset -- --approve HASH for explicit receipt-owned cleanup.

API recipes support npm run testdata:serve: an explicit loopback server with an ephemeral session token, no live fallback. Database recipes simulate application ports, not a database engine. Vault recipes seed actual Markdown with schema_version and created_at for the canonical repositories rather than substituting a memory port. Native operation JSON examples are payload examples, not live snapshot leases: list records through the running repository before updating or deleting them.

Typed fixture port factories live under ${m.testRoot}/fixtures for API/database sources. They translate the generated AbortSignal argument to the simulator's options object. Inject them into the actual generated service or pass them as explicit source overrides. Unknown/disabled operations reject, even when a production adapter exists. Dispose every test adapter after the test. Fixture code is never imported by the production bootstrap.

The built-in provider is dependency-free. faker-provider.mjs remains an optional explicit seam; no Faker dependency, network font, credential, executable expression or production endpoint is imported from the design.
`, 'managed');
  const test = `${m.testRoot}/fixtures/recipes.test.ts`;
  add(test, `import { it, expect } from 'vitest';
import { createFixtureEngine } from ${literal(relativeImport(test, 'scripts/test-data/engine.mjs'))};
import { createFixtureAdapter } from ${literal(relativeImport(test, 'scripts/test-data/adapters.mjs'))};
import manifest from ${literal(relativeImport(test, 'scripts/test-data/manifest.json'))};
it('compiles the authored recipes into deterministic bounded fixture data', () => {
  const engine = createFixtureEngine(); const first = engine.generate(manifest);
  expect(engine.generate(manifest)).toEqual(first); expect(first.operations).toHaveLength(manifest.operations.length);
  expect(first.bytes).toBeLessThanOrEqual(5000000);
  const adapter = createFixtureAdapter(manifest); adapter.dispose();
  expect(() => adapter.reset()).toThrow('disposed');
});
`, 'managed');
  for (const source of m.sources.filter(s => s.kind !== 'vault' && manifest.operations.some((op: {source: string}) => op.source === s.slug))) {
    const name = symbol(source.slug), file = `${m.testRoot}/fixtures/${source.slug}.ts`;
    add(file, `import { createFixtureAdapter, type FixtureAdapter } from ${literal(relativeImport(file, 'scripts/test-data/adapters.mjs'))};
import manifest from ${literal(relativeImport(file, 'scripts/test-data/manifest.json'))} with { type: 'json' };
import type { ${name}Port } from ${literal(relativeImport(file, `${m.sourceRoot}/application/${source.slug}/contracts.ts`))};
/** A full typed port: disabled/missing recipes reject instead of reaching a live provider. */
export function create${name}FixturePort(adapter: FixtureAdapter = createFixtureAdapter(manifest)): {port: ${name}Port; dispose(): void} {
  return { port: {
${source.operations.map(op => `    ${literal(op.slug)}: (input, signal) => adapter.execute(${literal(op.id)}, input, {signal}),`).join('\n')}
  }, dispose: () => adapter.dispose() };
}
`, 'extension');
    const testPath = `${m.testRoot}/fixtures/${source.slug}.test.ts`;
    add(testPath, `import { it, expect } from 'vitest';
import { create${name}FixturePort } from './${source.slug}.ts';
import { createPinia, disposePinia } from 'pinia';
import { create${name}Service } from ${literal(relativeImport(testPath,`${m.sourceRoot}/application/${source.slug}/service.ts`))};
import { define${name}Store } from ${literal(relativeImport(testPath,`${m.sourceRoot}/presentation/stores/${source.slug}.ts`))};
${source.operations.filter(op=>op.input===null && manifest.operations.some((r:{id:string;behavior:string})=>r.id===op.id && r.behavior==='list')).map(op=>`it('executes ${op.slug} against its actual seeded port through Pinia', async () => {
  const fixture=create${name}FixturePort(), pinia=createPinia();
  try { const store=define${name}Store(create${name}Service(fixture.port))(pinia);
    const result=await store[${literal(op.slug)}].execute(undefined);
    expect(result.ok).toBe(${manifest.operations.find((r:{id:string})=>r.id===op.id).scenario!=='error'}); expect(store[${literal(op.slug)}].pending).toBe(false);
  } finally { disposePinia(pinia); fixture.dispose(); }
});`).join('\n')}
it('the ${source.slug} fixture never falls back to live operations after disposal', async () => {
  const fixture = create${name}FixturePort(); fixture.dispose();
${source.operations.map(op => `  await expect(fixture.port[${literal(op.slug)}](${sampleCode(op.input)})).rejects.toThrow('disposed');`).join('\n')}
});
`, 'managed');
  }
  const adapter='scripts/test-data/source-ports.mjs';
  add(adapter,`import { createFixtureAdapter } from './adapters.mjs';\nexport function createProjectTestPorts(manifest) {\n  const adapter=createFixtureAdapter(manifest);\n  const sources=[...new Set(manifest.operations.filter(op=>op.kind!=='vault').map(op=>op.source))];\n  const ports=Object.fromEntries(sources.map(source=>{const port=adapter.port(source);return [source,Object.fromEntries(Object.entries(port).map(([slug,run])=>[slug,(input,signal)=>run(input,{signal})]))];}));\n  return {ports,dispose:()=>adapter.dispose()};\n}\n`,'managed');
  for(const source of m.sources) for(const op of source.operations) {
    const entity=noteEntity(m,source.id,op.id);
    const recipe=manifest.operations.find((r: {id:string;scenario:string})=>r.id===op.id);
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
