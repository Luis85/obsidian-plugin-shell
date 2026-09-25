import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { fixtureManifest, fixtureCode } from '../../scripts/companion/compiler/fixture-code.ts';
import { validateSourceOverrides } from '../../scripts/companion/runtime/source-overrides.ts';
import { createFixtureEngine } from '../../docs/concepts/companion/test-kit/engine.mjs';
import { planFixtures, applyFixtures } from '../../docs/concepts/companion/test-kit/storage.mjs';
const root=process.cwd();
const seed=JSON.parse(await readFile('docs/concepts/companion/companion-project.json','utf8'));

test('actual companion export resolves every enabled recipe with readable native metadata and no credentials',()=>{
 const manifest=fixtureManifest(projectModel(seed));const engine=createFixtureEngine();const before=JSON.stringify(seed);
 const first=engine.generate(manifest);assert.deepEqual(first,engine.generate(manifest));assert.equal(JSON.stringify(seed),before);
 assert.equal(first.operations.length,seed.design.dataSources.testing.recipes.filter(r=>r.enabled).length);
 assert.ok(first.files.filter(f=>f.path.endsWith('.md')).length>0);
 for(const note of first.files.filter(f=>f.path.endsWith('.md'))){assert.match(note.content,/"schema_version": 1/);assert.match(note.content,/"created_at": "2026-01-01T00:00:00.000Z"/);}
 assert.equal(JSON.stringify(manifest).includes('vault://active'),false);assert.equal(Object.hasOwn(manifest.operations[0],'credentialRef'),false);
});
test('recipe generation is absent when recipes are not enabled',()=>{
 const data=structuredClone(seed);delete data.design.dataSources.testing;assert.equal(fixtureManifest(projectModel(data)),null);
 data.design.dataSources.testing={...seed.design.dataSources.testing,recipes:[]};assert.equal(fixtureManifest(projectModel(data)),null);
});
test('malformed and dangling recipes fail generation rather than generating broken test tools',()=>{
 for(const change of [d=>d.design.dataSources.testing.seed=-1,d=>d.design.dataSources.testing.recipes[0].operation='missing',d=>d.design.dataSources.testing.recipes.push(d.design.dataSources.testing.recipes[0]),d=>d.design.dataSources.testing.recipes[0].rules=[{side:'output',path:'/id',provider:'literal',argument:'not-json'}]]){
  const data=structuredClone(seed);change(data);assert.throws(()=>fixtureManifest(projectModel(data)));
 }
});
test('generated kit preserves engine bytes, creates a read-only plan, and applies only approved test-vault notes',async()=>{
 const m=projectModel(seed);const files=new Map();assert.equal(await fixtureCode(root,m,(p,c)=>files.set(p,c)),true);
 assert.equal(files.get('scripts/test-data/engine.mjs'),await readFile('docs/concepts/companion/test-kit/engine.mjs','utf8'));
 assert.ok(files.has('tests/project/recipes/authoring-vault-list-requirements.test.mjs'));
 const scratch=await mkdtemp(join(tmpdir(),'generator-recipes-'));
 try{const manifest=fixtureManifest(m);const plan=await planFixtures(scratch,manifest);assert.ok(plan.changes.length>0);assert.deepEqual(await readdir(scratch),[]);
  await assert.rejects(applyFixtures(scratch,manifest,'0'.repeat(64)));
  assert.deepEqual(await readdir(scratch),[]);
  await applyFixtures(scratch,manifest,plan.approval);
  const first=plan.changes.find(f=>f.path.endsWith('.md'));assert.ok(first);assert.match(await readFile(join(scratch,'.test-vault',first.path),'utf8'),/schema_version/);
 }finally{await rm(scratch,{recursive:true,force:true});}
});
test('complete typed source overrides are accepted and partial, unknown or executable accessors are rejected',()=>{
 const contracts={'items':['list','save']};validateSourceOverrides({},contracts);validateSourceOverrides({items:{list:async()=>[],save:async()=>{}}},contracts);
 assert.throws(()=>validateSourceOverrides({items:{list:()=>[]}},contracts),/INCOMPLETE/);
 assert.throws(()=>validateSourceOverrides({other:{}},contracts),/UNKNOWN/);
 let accessed=false;assert.throws(()=>validateSourceOverrides({get items(){accessed=true;return {};}},contracts),/ACCESSOR/);assert.equal(accessed,false);
 assert.throws(()=>validateSourceOverrides(Object.create({items:{}}),contracts),/INVALID/);
 assert.throws(()=>validateSourceOverrides({items:{list:[],save(){}}},contracts),/OPERATION/);
});
test('fixture schemas preserve authored false, zero and empty-text defaults',()=>{
 const data=structuredClone(seed);const entity=data.design.semantic.entities[0];
 entity.properties.push({id:'p-default-text',key:'default_text',type:'text',required:false,defaultValue:''},{id:'p-default-number',key:'default_number',type:'number',required:false,defaultValue:0},{id:'p-default-flag',key:'default_flag',type:'checkbox',required:false,defaultValue:false});
 const manifest=fixtureManifest(projectModel(data));const resolved=manifest.entities.find(e=>e.id===entity.id).schema;
 for(const [key,value]of Object.entries({default_text:'',default_number:0,default_flag:false}))assert.equal(resolved.properties[key].default,value);
 entity.properties.at(-1).defaultValue='not-a-boolean';assert.throws(()=>fixtureManifest(projectModel(data)),/Generated entity violates its declared property types/);
});
