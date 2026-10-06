import { it, expect } from 'vitest';
import { createFixtureEngine } from "../../../scripts/test-data/engine.mjs";
import manifest from "../../../scripts/test-data/manifest.json";
import { NoteRepository } from "../../../src/application/note-repository.ts";
import { markdownCodec } from "../../../src/infrastructure/markdown.ts";
import { success, failure } from "../../../src/domain/outcome.ts";
import { document } from "../../../src/generated/application/documents/data-source.ts";
it('seeded data-source Markdown is readable by the canonical repository without a fake codec', async () => {
  const generated=createFixtureEngine().generate(manifest);
  const notes=generated.files.filter(file=>file.path.startsWith("Companion/DataSource/") && file.path.endsWith('.md'));
  const files=new Map(notes.map(file=>[file.path,file.content]));
  const storage={list:async()=>success([...files.keys()]),read:async(path:string)=>files.has(path)?success(files.get(path)!):failure('storage','error.read'),create:async()=>{throw new Error('READ_ONLY_TEST');},replace:async()=>{throw new Error('READ_ONLY_TEST');},trash:async()=>{throw new Error('READ_ONLY_TEST');}};
  const repository=new NoteRepository(document,storage,markdownCodec,{publish:()=>{}},()=>"Companion/DataSource",()=> 'unused',()=>manifest.referenceDate,{report:()=>{}});
  try { const result=await repository.list(); expect(result.ok).toBe(true); if(!result.ok) throw new Error(result.error.code);
    expect(result.value).toHaveLength(notes.length);
    for(const note of result.value) { expect(note.entity).toBe("data-source"); expect(note.schemaVersion).toBe(1); expect(note.values.title).toBeTypeOf('string'); }
  } finally { repository.dispose(); }
});
