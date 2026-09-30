import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
test('authoring contracts stay framework-free and the new editor has no host-process access',async()=>{
 const files=['scripts/companion/native-contract.mjs','scripts/companion/authoring-contract.ts',...(await readdir(new URL('scripts/companion/sitemap/',root))).filter(n=>n.endsWith('.ts')).map(n=>'scripts/companion/sitemap/'+n)];
 for(const file of files){
  const source=await readFile(new URL(file,root),'utf8');
  assert.doesNotMatch(source,/from\s+['"](?:node:|vue['"/]|pinia|obsidian|@nuxt)/,file);
 }
 const config=JSON.parse(await readFile(new URL('configs/quality/fallow.json',root),'utf8'));
 const rules=config.boundaries.rules;
 assert.ok(config.boundaries.zones.find(z=>z.name==='companion-authoring-contract').patterns.includes('scripts/companion/native-contract.mjs'));
 assert.deepEqual(rules.find(r=>r.from==='companion-concept').allow,[],'retained standalone concept isolation stays closed');
 assert.deepEqual(rules.find(r=>r.from==='companion-authoring-contract').allow,['companion-authoring-contract','cli-data-contract']);
 assert.deepEqual(rules.find(r=>r.from==='companion-editor').allow,['companion-editor','companion-authoring-contract']);
});
