import { it, expect } from 'vitest';
import { NoteRepository } from "../../../src/application/note-repository.ts";
import { markdownCodec } from "../../../src/infrastructure/markdown.ts";
import { success, failure } from "../../../src/domain/outcome.ts";
import { document as recipe } from "../../../src/generated/application/documents/plugin-project.ts";
it('persists every plugin-project field, rejects stale edits and preserves unrelated Markdown', async () => {
  const files = new Map<string,string>(); let writes = 0;
  const storage = {
    list: async () => success([...files.keys()]), read: async (path:string) => files.has(path) ? success(files.get(path)!) : failure('storage','error.read'),
    create: async (path:string, body:string) => { if(files.has(path)) return failure('conflict','error.conflict'); files.set(path,body); writes++; return success(undefined); },
    replace: async (path:string, before:string, after:string) => { if(files.get(path)!==before) return failure('stale','error.stale'); files.set(path,after); writes++; return success(undefined); },
    trash: async (path:string, before:string) => { if(files.get(path)!==before) return failure('stale','error.stale'); files.delete(path); writes++; return success(undefined); },
  };
  const events: string[] = []; const repository = new NoteRepository(recipe,storage,markdownCodec,{publish:e=>{events.push(e.type);}},()=>"Companion/PluginProject",()=> 'fixture-id',()=> '2026-01-01T00:00:00Z',{report:()=>{}});
  const values = {"plugin_id":"fixture","title":"fixture","description":"fixture","codebase_folder":"fixture","tests_folder":"fixture"};
  const first = await repository.create(values,'create-1'); expect(first.ok).toBe(true); if(!first.ok) throw new Error('CREATE_FAILED');
  expect((await repository.create(values,'create-1')).ok).toBe(true); expect(writes).toBe(1);
  expect(first.value.values).toEqual(values); const path=first.value.path;
  files.set(path,files.get(path)!.replace('---\n','---\nforeign: retained\n')+'\nUnrelated body');
  expect((await repository.update(first.value,values)).ok).toBe(false); expect(writes).toBe(1);
  const current = await repository.get(path); if(!current.ok) throw new Error('READ_FAILED');
  expect((await repository.update(current.value,{...values,title:'Changed'})).ok).toBe(true);
  expect(files.get(path)).toContain('foreign: retained'); expect(files.get(path)).toContain('Unrelated body');
  const latest=await repository.get(path); if(!latest.ok) throw new Error('READ_FAILED');
  expect((await repository.delete(latest.value)).ok).toBe(true); expect(files.size).toBe(0);
  expect(events).toEqual(['documents.created','documents.updated','documents.deleted']);
  repository.dispose(); expect((await repository.create(values,'after-dispose')).ok).toBe(false);
});
