import assert from 'node:assert/strict';
import test from 'node:test';
import { arrangeSitemap } from '../companion/sitemap/arrangement.ts';
import { applySitemapCommand } from '../companion/sitemap/commands.ts';
import { sitemapSemanticKey } from '../companion/sitemap/projection.ts';
const fixture=(count=10)=>({nodes:Array.from({length:count},(_,i)=>({id:'node-'+i,kind:i?'page':'view',label:'Page '+i,parent:i?'node-'+Math.floor((i-1)/3):null})),links:[],canvas:{schema:1,positions:{},collapsed:[]}});
function disjoint(positions){const values=Object.values(positions);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
  assert.ok(Math.abs(values[i].x-values[j].x)>=242||Math.abs(values[i].y-values[j].y)>=184,JSON.stringify([values[i],values[j]]));
}}
test('stable forest arrangement has distinct bounded card rectangles and never changes saved semantics',()=>{
  for(const count of [1,10,60]){const d=fixture(count),before=JSON.stringify(d),positions=arrangeSitemap(d,'all');
    assert.equal(Object.keys(positions).length,count);disjoint(positions);assert.deepEqual(arrangeSitemap(d,'all'),positions);
    assert.equal(JSON.stringify(d),before);const after=applySitemapCommand(d,{type:'arrange',positions});assert.equal(sitemapSemanticKey(after),sitemapSemanticKey(d));
  }
});
test('unplaced cards avoid saved cards while every authored position remains exact',()=>{
  const d=fixture();d.canvas={positions:{'node-0':{x:290,y:0},'node-9':{x:290,y:200}}};
  const positions=arrangeSitemap(d);disjoint(positions);assert.deepEqual(positions['node-0'],d.canvas.positions['node-0']);
  assert.deepEqual(positions['node-9'],d.canvas.positions['node-9']);positions['node-0'].x=999;assert.equal(d.canvas.positions['node-0'].x,290);
});
test('saved overlaps are preserved until an explicit full arrangement is committed',()=>{
  const d=fixture();d.canvas={positions:{'node-0':{x:0,y:0},'node-1':{x:0,y:0}}};
  assert.deepEqual(arrangeSitemap(d)['node-0'],arrangeSitemap(d)['node-1']);disjoint(arrangeSitemap(d,'all'));
});
test('empty, malformed, cyclic, excessive and unsupported layout requests obey shared validation',()=>{
  assert.deepEqual(arrangeSitemap({nodes:[],links:[]}),{});
  assert.throws(()=>arrangeSitemap(fixture(61)));assert.throws(()=>arrangeSitemap(fixture(),'silent-replace'));
  const cycle=fixture();cycle.nodes[1].parent='node-4';assert.throws(()=>arrangeSitemap(cycle),error=>error.code==='SITEMAP_CYCLE');
  let touched=false;const hostile={get nodes(){touched=true;return [];},links:[]};assert.throws(()=>arrangeSitemap(hostile));assert.equal(touched,false);
});
