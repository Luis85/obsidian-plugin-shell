import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSitemapSurface } from '../companion/sitemap/create.ts';
import { applySitemapCommand } from '../companion/sitemap/commands.ts';
import { validateAuthoringDocument as validateCompanionDocument } from '../companion/authoring-contract.ts';
import { selfProject } from '#shared/testing/starter-documents.mjs';
const original=selfProject();
const owner=original.design.nodes.find(n=>n.kind==='view');

test('new surfaces use complete canonical defaults and retain all existing definitions',()=>{
  for(const kind of ['page','view','modal','settings','group']){
    const parent=kind==='page'||kind==='group'?owner.id:null;
    const node=newSitemapSurface(original.design,'Acceptance '+kind,kind,parent);
    const next=applySitemapCommand(original.design,{type:'create',surface:node});
    validateCompanionDocument({...original,design:next});
    assert.equal(next.nodes.length,original.design.nodes.length+1);
    assert.ok(next.nextId>Number(node.id.slice(5)));
    assert.deepEqual(next.visualDesigns,original.design.visualDesigns);
  }
});
test('duplicate names receive distinct portable slugs without mutating existing IDs',()=>{
  const a=newSitemapSurface(original.design,'123 test','page',owner.id);
  const next=applySitemapCommand(original.design,{type:'create',surface:a});
  const b=newSitemapSurface(next,'123 test','page',owner.id);
  assert.notEqual(a.slug,b.slug);assert.notEqual(a.id,b.id);
  assert.match(b.slug,/^[a-z][a-z0-9-]*$/);
});
test('new navigation reuses canonical endpoints and does not change their parent',()=>{
  const pages=original.design.nodes.filter(n=>n.kind==='page');
  const next=applySitemapCommand(original.design,{type:'link',transition:{id:'edge-'+original.design.nextId,from:pages[0].id,to:pages[1].id,kind:'navigate',label:'Review'}});
  validateCompanionDocument({...original,design:next});
  assert.deepEqual(next.nodes,original.design.nodes);
  assert.equal(next.links.length,original.design.links.length+1);
  assert.equal(next.nextId,original.design.nextId+1);
});
test('duplicate identities and dangling creation links fail without touching the source',()=>{
  const before=JSON.stringify(original);
  assert.throws(()=>applySitemapCommand(original.design,{type:'create',surface:owner}));
  assert.throws(()=>applySitemapCommand(original.design,{type:'link',transition:{id:'new-link',from:owner.id,to:'missing',kind:'navigate',label:'Bad'}}));
  assert.equal(JSON.stringify(original),before);
});
