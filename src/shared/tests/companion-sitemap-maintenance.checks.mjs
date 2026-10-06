import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applySitemapCommand} from '../companion/sitemap/commands.ts';
import {planRecordRemoval} from '../companion/sitemap/maintenance.ts';
const design=()=>({nodes:[{id:'a',label:'A',kind:'view',parent:null},{id:'b',label:'B',kind:'page',parent:'a'},{id:'c',label:'C',kind:'page',parent:'a'}],
  links:[{id:'ab',from:'a',to:'b',kind:'navigate',label:'Open B'}],sitemap:{schema:1,routes:[{id:'ra',surface:'a',path:'/a'}],journeys:[{id:'j',name:'Review',steps:[{id:'s1',surface:'a',via:null},{id:'s2',surface:'b',via:'ab'}]}]}});
for(const [kind,id] of [['transition','ab'],['route','ra'],['journey','j']]){
 test(`reviewed ${kind} removal preserves other records and refuses stale approval`,()=>{
  const before=design(),plan=planRecordRemoval(before,kind,id),copy=structuredClone(before);
  const after=applySitemapCommand(before,{type:kind+'-remove',id,review:plan.review});
  assert.deepEqual(before,copy);assert.deepEqual(after.nodes,before.nodes);
  if(kind==='transition'){assert.equal(after.links.length,0);assert.equal(after.sitemap.journeys[0].steps[1].unresolved,true);assert.equal(after.sitemap.journeys[0].steps[1].via,'ab');}
  else if(kind==='route'){assert.equal(after.sitemap.routes.length,0);assert.deepEqual(after.links,before.links);}
  else {assert.equal(after.sitemap.journeys.length,0);assert.deepEqual(after.sitemap.routes,before.sitemap.routes);}
  const changed=design();changed.nodes[0].label='External';
  assert.throws(()=>applySitemapCommand(changed,{type:kind+'-remove',id,review:plan.review}),/Removal impact changed/);
 });
 test(`${kind} removal refuses unowned references instead of deleting them`,()=>{
  const before=design();before.other={ref:id};const plan=planRecordRemoval(before,kind,id);assert.equal(plan.canRemove,false);
  assert.deepEqual(plan.references,['/other/ref']);assert.throws(()=>applySitemapCommand(before,{type:kind+'-remove',id,review:plan.review}),/external references/);
 });
}
test('editing an incoming action keeps identities and marks changed adjacency unresolved',()=>{
 const before=design();const after=applySitemapCommand(before,{type:'transition-edit',transition:{...before.links[0],to:'c',label:'Open C'}});
 assert.equal(after.links[0].id,'ab');assert.equal(after.sitemap.journeys[0].steps[1].id,'s2');assert.equal(after.sitemap.journeys[0].steps[1].unresolved,true);
 assert.deepEqual(before,design());assert.throws(()=>applySitemapCommand(before,{type:'transition-edit',transition:{...before.links[0],from:'b'}}),/reassigned/);
});
test('renaming an action preserves resolved journey steps and routes',()=>{
 const before=design(),after=applySitemapCommand(before,{type:'transition-edit',transition:{...before.links[0],label:'Changed label'}});
 assert.deepEqual(after.sitemap,before.sitemap);assert.equal(after.links[0].label,'Changed label');
});
test('missing records and arbitrary removal fields are rejected',()=>{
 assert.throws(()=>planRecordRemoval(design(),'route','missing'));
 assert.throws(()=>applySitemapCommand(design(),{type:'route-remove',id:'ra',review:'',overwrite:true}));
});
