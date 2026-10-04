import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createFixtureEngine } from "../../../scripts/test-data/engine.mjs";
import { NoteRepository } from "../../../src/application/note-repository.ts";
import { markdownCodec } from "../../../src/infrastructure/markdown.ts";
import { success, failure } from "../../../src/domain/outcome.ts";
import { document } from "../../../src/generated/application/documents/requirement.ts";
import { createGAuthoringVaultService } from "../../../src/generated/application/authoring-vault/service.ts";
it("list-requirements consumes actual seeded Markdown through the canonical repository",async()=>{
 const manifest=JSON.parse(await readFile(new URL("../../../scripts/test-data/manifest.json",import.meta.url),'utf8'));
 const generated=createFixtureEngine().generate(manifest);const files=new Map(generated.files.map(f=>[f.path,f.content]));
 const storage={list:async(folder)=>success([...files.keys()].filter(p=>p.startsWith(folder+'/')&&p.endsWith('.md'))),read:async(p)=>files.has(p)?success(files.get(p)):failure('storage','error.read'),create:async()=>{throw Error('NO_WRITE');},replace:async()=>{throw Error('NO_WRITE');},trash:async()=>{throw Error('NO_WRITE');}};
 const repository=new NoteRepository(document,storage,markdownCodec,{publish:()=>{}},()=>"Companion/Requirement",()=> 'unused',()=>manifest.referenceDate,{report:()=>{}});
 try{const port={"list-requirements":async()=>{const result=await repository.list();if(!result.ok)throw Error(result.error.code);return result.value.map(s=>({...s.values,id:s.id,type:"requirement"}));}};
 const records=await createGAuthoringVaultService(port)["list-requirements"](undefined);expect(records).toHaveLength(manifest.count);expect(new Set(records.map(r=>r.id)).size).toBe(manifest.count);
 }finally{repository.dispose();}
});
