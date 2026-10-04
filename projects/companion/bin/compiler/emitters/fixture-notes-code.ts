import { noteEntity } from './persistence-code.ts';
import { relationshipScope } from './relationship-model.ts';
import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
/** Test the emitted Markdown against actual canonical repositories and the actual YAML codec. */
export function fixtureNoteTests(m: Model, add: Add): void {
  const initial = new Map(m.sources.flatMap(source => source.operations.flatMap(op => { const e=noteEntity(m,source.id,op.id);return e?[[e.id,e] as const]:[]; })));
  for (const entity of relationshipScope(m,true).entities) initial.set(entity.id, entity);
  for (const entity of initial.values()) {
    const file = `${m.testRoot}/fixtures/canonical-${entity.slug}.test.ts`;
    const relative = (path: string) => literal(relativeImport(file,path));
    add(file, `import { it, expect } from 'vitest';
import { createFixtureEngine } from ${relative('scripts/test-data/engine.mjs')};
import manifest from ${relative('scripts/test-data/manifest.json')};
import { NoteRepository } from ${relative('src/application/note-repository.ts')};
import { markdownCodec } from ${relative('src/infrastructure/markdown.ts')};
import { success, failure } from ${relative('src/domain/outcome.ts')};
import { document } from ${relative(`${m.sourceRoot}/application/documents/${entity.slug}.ts`)};
it('seeded ${entity.slug} Markdown is readable by the canonical repository without a fake codec', async () => {
  const generated=createFixtureEngine().generate(manifest);
  const notes=generated.files.filter(file=>file.path.startsWith(${literal(entity.folder+'/')}) && file.path.endsWith('.md'));
  const files=new Map(notes.map(file=>[file.path,file.content]));
  const storage={list:async()=>success([...files.keys()]),read:async(path:string)=>files.has(path)?success(files.get(path)!):failure('storage','error.read'),create:async()=>{throw new Error('READ_ONLY_TEST');},replace:async()=>{throw new Error('READ_ONLY_TEST');},trash:async()=>{throw new Error('READ_ONLY_TEST');}};
  const repository=new NoteRepository(document,storage,markdownCodec,{publish:()=>{}},()=>${literal(entity.folder)},()=> 'unused',()=>manifest.referenceDate,{report:()=>{}});
  try { const result=await repository.list(); expect(result.ok).toBe(true); if(!result.ok) throw new Error(result.error.code);
    expect(result.value).toHaveLength(notes.length);
    for(const note of result.value) { expect(note.entity).toBe(${literal(entity.slug)}); expect(note.schemaVersion).toBe(1); expect(note.values.title).toBeTypeOf('string'); }
  } finally { repository.dispose(); }
});
`, 'managed');
  }
}
