/**
 * Portable product-family exchange gate. No browser, plugin, or external app is
 * loaded here. Native backups are deliberately opaque data fixtures: each
 * editor's separate adapter/browser checks validate its native domain schema.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPS, FORMAT, VERSION, MAX_BYTES, clone, sourceKey, reference, safeData,
  parsePackage, emptyRegistry, ownSource, ownEntities, makePackage,
  packageSummary, mergePackage, linkRecords, linkHealth, familyMarkdown
} from '../src/protocol.mjs';

const appIds=Object.keys(APPS);
const kinds={
  'component-atlas':['ui.component','architecture.component'],
  'storyloom':['story.story','story.map'],
  'sitemap-atlas':['ia.page','ia.navigation'],
  'dissect':['dissect.instance','dissect.scenario']
};
function snapshot(appId,workspaceId='renovation-planner'){
  return {
    appId,workspace:{id:workspaceId,title:'Renovation Planner'},view:'editor',title:APPS[appId].name,
    entities:kinds[appId].map((kind,index)=>({
      // Equal native IDs are intentional. Product + workspace + kind supplies
      // the namespace; users must never rename native IDs to share an export.
      id:'record-1',kind,title:index?'Supporting record':'Project overview',
      summary:'A portable '+kind+' record.',status:'draft',updatedAt:'2026-10-11T10:00:00.000Z',
      data:{id:'record-1',purpose:'Understand and plan a renovation',revision:1,properties:{density:'comfortable'}}
    }))
  };
}
function native(appId,workspaceId='renovation-planner',revision=1){
  return {format:appId,schemaVersion:1,workspaceId,revision,ownedData:{sentinel:appId+'-only',values:[1,2,3]}};
}
function pack(appId,workspaceId='renovation-planner'){
  return makePackage(snapshot(appId,workspaceId),emptyRegistry(),native(appId,workspaceId));
}
function mutate(value,fn){const next=clone(value);fn(next);return next;}
function sourceSnapshot(appId,workspaceId='renovation-planner'){return ownSource(snapshot(appId,workspaceId));}

for(const producer of appIds)for(const consumer of appIds.filter(app=>app!==producer)){
  test(`${producer} → ${consumer}: independent import, native ownership, and third-app transit`,()=>{
    const producerSnapshot=snapshot(producer),consumerSnapshot=snapshot(consumer);
    const producerNative=native(producer),consumerNative=native(consumer);
    const consumerBefore=clone(consumerSnapshot),consumerNativeBefore=clone(consumerNative);
    const exported=makePackage(producerSnapshot,emptyRegistry(),producerNative);
    const sourceBefore=clone(exported),empty=emptyRegistry(),emptyBefore=clone(empty);
    const received=mergePackage(JSON.stringify(exported),empty,ownSource(consumerSnapshot));
    assert.deepEqual(empty,emptyBefore,'Import must construct a new registry.');
    assert.deepEqual(exported,sourceBefore,'Import must never edit the original source package.');
    assert.equal(received.records.length,producerSnapshot.entities.length);
    assert.deepEqual(received.records.map(e=>e.ref),ownEntities(producerSnapshot).map(e=>e.ref));
    assert.equal(received.sources.length,1);
    assert.deepEqual(received.sources[0].data,producerNative);
    assert.ok(received.sources.every(n=>sourceKey(n.source)!==sourceKey(ownSource(consumerSnapshot))));
    assert.deepEqual(consumerSnapshot,consumerBefore,'The consumer model stays owned by its editor.');
    assert.deepEqual(consumerNative,consumerNativeBefore,'Imported source backups cannot replace local native data.');
    const reexported=makePackage(consumerSnapshot,received,consumerNative);
    assert.equal(reexported.source.appId,consumer);
    assert.equal(reexported.entities.length,producerSnapshot.entities.length+consumerSnapshot.entities.length);
    assert.deepEqual(reexported.natives.find(n=>n.source.appId===producer).data,producerNative);
    assert.deepEqual(reexported.natives.find(n=>n.source.appId===consumer).data,consumerNative);
    assert.deepEqual(reexported.completeSources,[sourceKey(ownSource(consumerSnapshot))]);
    const third=appIds.find(app=>app!==producer&&app!==consumer),thirdSnapshot=snapshot(third);
    const transit=mergePackage(JSON.stringify(reexported),emptyRegistry(),ownSource(thirdSnapshot));
    const final=makePackage(thirdSnapshot,transit,native(third));
    for(const original of exported.entities){
      const forwarded=final.entities.find(e=>e.ref===original.ref);
      assert.ok(forwarded,'A forwarded record retains its canonical identity.');
      assert.deepEqual(forwarded.data,original.data);
      assert.equal(forwarded.source.appId,producer,'Transit must not transfer ownership to the forwarding app.');
    }
    assert.deepEqual(final.natives.find(n=>n.source.appId===producer).data,producerNative);
    assert.equal(new Set(final.entities.map(e=>e.ref)).size,final.entities.length);
  });
}

test('Canonical references distinguish kinds, apps, workspaces, and URI-sensitive IDs',()=>{
  const a=sourceSnapshot('component-atlas','shared/space:one'),b=sourceSnapshot('component-atlas','shared/space:two');
  const candidates=[reference(a,'ui.component','same'),reference(a,'architecture.component','same'),reference(b,'ui.component','same'),reference(sourceSnapshot('storyloom','shared/space:one'),'story.story','same')];
  assert.equal(new Set(candidates).size,candidates.length);
  const special=reference(a,'ui.component','card / ? # ü');
  assert.match(special,/card%20%2F%20%3F%20%23%20%C3%BC$/);
  assert.ok(special.includes('shared%2Fspace%3Aone'));
  const one=pack('component-atlas','workspace-one'),two=pack('component-atlas','workspace-two'),consumer=sourceSnapshot('sitemap-atlas');
  const combined=mergePackage(two,mergePackage(one,emptyRegistry(),consumer),consumer);
  assert.equal(combined.records.length,4);
  assert.equal(new Set(combined.records.map(e=>e.ref)).size,4);
});

test('A package cannot overwrite local records or local native backup, even when it forwards them',()=>{
  const local=snapshot('sitemap-atlas'),localSource=ownSource(local),foreign=pack('component-atlas');
  foreign.entities.push(...ownEntities(local).map(e=>({...e,title:'Untrusted replacement'})));
  foreign.natives.push({source:localSource,data:{format:'sitemap-atlas',ownedData:{sentinel:'overwrite-attempt'}}});
  const before=clone(local),received=mergePackage(foreign,emptyRegistry(),localSource,{updateExisting:true});
  assert.ok(received.records.every(e=>sourceKey(e.source)!==sourceKey(localSource)));
  assert.ok(received.sources.every(n=>sourceKey(n.source)!==sourceKey(localSource)));
  assert.deepEqual(local,before);
  const ownImported=mergePackage(pack('sitemap-atlas'),emptyRegistry(),localSource,{updateExisting:true});
  assert.deepEqual(ownImported.records,[]);assert.deepEqual(ownImported.sources,[]);
});

test('Keep existing and use incoming policies apply consistently to records and opaque native snapshots',()=>{
  const local=sourceSnapshot('sitemap-atlas'),initial=pack('component-atlas');
  const original=mergePackage(initial,emptyRegistry(),local),untouched=clone(original);
  const changed=mutate(initial,p=>{p.entities[0].title='Revised component';p.entities[0].data.revision=2;p.natives[0].data.revision=2;p.exportedAt='2026-10-12T10:00:00.000Z';});
  assert.deepEqual(packageSummary(changed,original,local),{added:0,changed:1,unchanged:1,owned:0,missing:0,links:0});
  const kept=mergePackage(changed,original,local,{updateExisting:false});
  assert.equal(kept.records[0].title,initial.entities[0].title);assert.equal(kept.records[0].data.revision,1);assert.equal(kept.sources[0].data.revision,1);
  const updated=mergePackage(changed,original,local,{updateExisting:true});
  assert.equal(updated.records[0].title,'Revised component');assert.equal(updated.records[0].data.revision,2);assert.equal(updated.sources[0].data.revision,2);
  assert.deepEqual(original,untouched,'Both conflict policies must preserve their input registry.');
  const repeat=mergePackage(changed,updated,local,{updateExisting:true});
  assert.equal(repeat.records.length,2);assert.equal(repeat.sources.length,1);
  assert.deepEqual(packageSummary(changed,repeat,local),{added:0,changed:0,unchanged:2,owned:0,missing:0,links:0});
});

test('Conflict summaries compare native payload fields named missing, receivedAt, and packageId',()=>{
  const local=sourceSnapshot('storyloom'),base=pack('component-atlas'),registry=mergePackage(base,emptyRegistry(),local);
  for(const key of ['missing','receivedAt','packageId']){
    const modified=mutate(base,p=>{p.entities[0].data[key]='meaningful changed domain value';});
    assert.equal(packageSummary(modified,registry,local).changed,1,'Native data.'+key+' must not be treated as transport metadata.');
  }
  assert.equal(packageSummary(base,registry,local).unchanged,2,'Transport receivedAt should not create spurious conflicts.');
});

test('Deleted source records remain linked, travel through a third app, and recover from an owner export',()=>{
  const producer=snapshot('component-atlas'),consumer=snapshot('sitemap-atlas'),third=snapshot('storyloom');
  const initial=makePackage(producer,emptyRegistry(),native('component-atlas'));
  let registry=mergePackage(initial,emptyRegistry(),ownSource(consumer));
  const localRef=ownEntities(consumer)[0].ref,foreignRef=initial.entities[0].ref;
  registry=linkRecords(registry,localRef,foreignRef,'uses','Page uses this definition.');
  const deleted=mutate(initial,p=>{p.entities=p.entities.slice(1);p.natives[0].data.revision=2;p.exportedAt='2026-10-12T10:00:00.000Z';});
  assert.equal(packageSummary(deleted,registry,ownSource(consumer)).missing,1);
  const missing=mergePackage(deleted,registry,ownSource(consumer),{updateExisting:true});
  assert.equal(missing.records.find(e=>e.ref===foreignRef).missing,true);
  assert.equal(missing.records.length,2,'Deletion retains the last known reference data.');
  assert.equal(missing.links.length,1,'Missing source records must not delete local links.');
  assert.equal(linkHealth(missing.links[0],[...ownEntities(consumer),...missing.records]),'missing');
  const forwarded=makePackage(consumer,missing,native('sitemap-atlas'));
  assert.equal(forwarded.entities.find(e=>e.ref===foreignRef).missing,true);
  const received=mergePackage(forwarded,emptyRegistry(),ownSource(third),{updateExisting:true});
  assert.equal(received.records.find(e=>e.ref===foreignRef).missing,true);
  const staleHealthy=mutate(forwarded,p=>{p.entities.find(e=>e.ref===foreignRef).missing=false;});
  for(const updateExisting of [false,true]){
    const protectedState=mergePackage(staleHealthy,received,ownSource(third),{updateExisting});
    assert.equal(protectedState.records.find(e=>e.ref===foreignRef).missing,true,'A forwarding app cannot clear an observed source deletion.');
  }
  const restored=mutate(initial,p=>{p.exportedAt='2026-10-13T10:00:00.000Z';p.entities[0].data.revision=3;});
  for(const updateExisting of [false,true]){
    const recovered=mergePackage(restored,received,ownSource(third),{updateExisting});
    assert.equal(recovered.records.find(e=>e.ref===foreignRef).missing,false,'The owner can establish that its record exists again.');
    assert.equal(linkHealth(recovered.links[0],recovered.records),'resolved');
  }
});

test('Only an owner-complete inventory marks absent records missing',()=>{
  const initial=pack('component-atlas'),local=sourceSnapshot('sitemap-atlas');
  const registry=mergePackage(initial,emptyRegistry(),local);
  const partial=mutate(initial,p=>{p.entities=p.entities.slice(1);delete p.completeSources;});
  const retained=mergePackage(partial,registry,local,{updateExisting:true});
  assert.equal(retained.records.length,2);assert.equal(retained.records[0].missing,false);
  const third=pack('storyloom');third.entities.push(initial.entities[1]);
  const forwarded=mergePackage(third,registry,local,{updateExisting:true});
  assert.equal(forwarded.records.find(e=>e.ref===initial.entities[0].ref).missing,false);
  const invalid=mutate(third,p=>p.completeSources.push(sourceKey(initial.source)));
  assert.throws(()=>parsePackage(invalid),/only its own source inventory complete/);
});

test('Detached references survive import and re-export when their foreign native backup is unavailable',()=>{
  const initial=pack('component-atlas'),detached=ownEntities(snapshot('dissect','detached-workspace'))[0];
  initial.entities.push(detached);
  const consumer=snapshot('sitemap-atlas'),registry=mergePackage(initial,emptyRegistry(),ownSource(consumer));
  assert.ok(registry.records.some(e=>e.ref===detached.ref));
  assert.ok(!registry.sources.some(n=>sourceKey(n.source)===sourceKey(detached.source)));
  const exported=makePackage(consumer,registry,native('sitemap-atlas'));
  assert.deepEqual(exported.entities.find(e=>e.ref===detached.ref).data,detached.data);
  assert.ok(!exported.natives.some(n=>sourceKey(n.source)===sourceKey(detached.source)));
});

test('Links survive transit and repeated imports without semantic duplication',()=>{
  const producer=snapshot('component-atlas'),consumer=snapshot('sitemap-atlas');
  const refs=ownEntities(producer).map(e=>e.ref);
  let sourceRegistry=linkRecords(emptyRegistry(),refs[0],refs[1],'implemented-by','An explicit architecture mapping.');
  assert.throws(()=>linkRecords(sourceRegistry,refs[0],refs[1],'implemented-by'),/already have this link/);
  assert.throws(()=>linkRecords(sourceRegistry,refs[0],refs[0]),/two different records/);
  const exported=makePackage(producer,sourceRegistry,native('component-atlas'));
  let received=mergePackage(exported,emptyRegistry(),ownSource(consumer));
  received=mergePackage(exported,received,ownSource(consumer));assert.equal(received.links.length,1);
  const duplicate=mutate(exported,p=>{p.links[0].id='another-link-id';});
  received=mergePackage(duplicate,received,ownSource(consumer),{updateExisting:true});assert.equal(received.links.length,1);
  const transit=makePackage(consumer,received,native('sitemap-atlas'));
  assert.deepEqual(transit.links,received.links);
  const reverse=linkRecords(received,refs[1],refs[0],'implemented-by');assert.equal(reverse.links.length,2,'Direction is part of relation identity.');
});

test('Link ID conflicts honor keep/update policy and preserve semantic uniqueness after retargeting',()=>{
  const producer=snapshot('component-atlas'),consumer=sourceSnapshot('sitemap-atlas');
  const [a,b]=ownEntities(producer).map(e=>e.ref),c=reference(ownSource(producer),'ui.component','third-record');
  const registry=emptyRegistry();registry.links=[{id:'retargetable',from:a,to:b,relation:'uses',note:'Existing target'}];
  const incoming=makePackage(producer,emptyRegistry(),native('component-atlas'));
  incoming.links=[{id:'retargetable',from:a,to:c,relation:'uses',note:'Incoming target'},{id:'semantic-alias',from:a,to:c,relation:'uses',note:'Same relation'}];
  const kept=mergePackage(incoming,registry,consumer,{updateExisting:false});
  assert.equal(kept.links.find(l=>l.id==='retargetable').to,b);
  const updated=mergePackage(incoming,registry,consumer,{updateExisting:true});
  assert.equal(updated.links.find(l=>l.id==='retargetable').to,c);
  assert.equal(updated.links.filter(l=>l.from===a&&l.to===c&&l.relation==='uses').length,1,'Retargeting must update the semantic deduplication index.');
  const both=mutate(incoming,p=>{p.links[1]={id:'original-target',from:a,to:b,relation:'uses'};});
  const retainedBoth=mergePackage(both,registry,consumer,{updateExisting:true});
  assert.equal(retainedBoth.links.length,2,'After retargeting, the old destination may be added as a distinct relation.');
});

test('Link health distinguishes resolved, missing, and unresolved endpoints',()=>{
  const entities=ownEntities(snapshot('component-atlas')),link={from:entities[0].ref,to:entities[1].ref};
  assert.equal(linkHealth(link,entities),'resolved');
  assert.equal(linkHealth(link,[{...entities[0],missing:true},entities[1]]),'missing');
  assert.equal(linkHealth(link,[entities[0]]),'unresolved');
  assert.equal(linkHealth({from:'opf://unknown/workspace/ui.component/missing',to:entities[1].ref},entities),'unresolved');
});

test('Malformed JSON, unsupported envelopes, invalid metadata, duplicate identities, and foreign completeness are rejected',()=>{
  assert.throws(()=>parsePackage('{broken'),/not valid JSON/);
  assert.throws(()=>parsePackage({format:'sitemap-atlas',schemaVersion:1}),/not a Product Family package/);
  const base=pack('component-atlas');
  const cases=[
    [p=>{p.schemaVersion=VERSION+1;},/Unsupported Product Family schema/],
    [p=>{p.exportedAt='tomorrow';},/timestamp is invalid/],
    [p=>{p.source.appId='Unsafe App';},/Source app IDs/],
    [p=>{p.entities[0].ref+='-wrong';},/does not match its identity/],
    [p=>{p.entities[0].kind='component';},/namespace/],
    [p=>{p.entities.push(clone(p.entities[0]));},/Duplicate entity identity/],
    [p=>{p.natives.push(clone(p.natives[0]));},/Duplicate native workspace/],
    [p=>{p.natives=[];},/native backup is missing/],
    [p=>{p.entities[0].path='../outside-vault.md';},/within a vault/],
    [p=>{p.entities[0].missing='yes';},/availability must be true or false/],
    [p=>{p.links=[{id:'bad',from:'https://example.com',to:p.entities[0].ref,relation:'uses'}];},/Product Family references/],
    [p=>{p.links=[{id:'self',from:p.entities[0].ref,to:p.entities[0].ref,relation:'uses'}];},/two different records/],
    [p=>{p.completeSources.push(sourceKey(sourceSnapshot('storyloom')));},/only its own source/]
  ];
  for(const [change,pattern] of cases)assert.throws(()=>parsePackage(mutate(base,change)),pattern);
  assert.equal(base.format,FORMAT);assert.equal(base.entities.length,2,'Invalid-candidate checks cannot mutate their valid baseline.');
});

test('Reserved keys and excessively deep JSON cannot enter the exchange registry',()=>{
  for(const key of ['__proto__','constructor','prototype']){
    const candidate=pack('component-atlas');candidate.entities[0].data=JSON.parse('{"'+key+'":{"polluted":true}}');
    assert.throws(()=>parsePackage(candidate),/reserved property/);
  }
  assert.equal({}.polluted,undefined);
  let deep={leaf:true};for(let i=0;i<45;i++)deep={child:deep};
  const nested=pack('component-atlas');nested.entities[0].data=deep;assert.throws(()=>parsePackage(nested),/too deeply nested/);
  assert.throws(()=>safeData({number:Infinity}),/finite/);
  assert.throws(()=>safeData({execute(){}}),/JSON data only/);
});

test('A generated or object package cannot exceed the same 32 MB limit as an imported JSON file',()=>{
  const huge=pack('component-atlas');
  huge.entities[0].data.chunks=Array(Math.floor(MAX_BYTES/(512*1024))+1).fill('x'.repeat(512*1024));
  assert.throws(()=>parsePackage(huge),/smaller than 32 MB/,'Object inputs must enforce the same byte budget.');
  const tooLargeText=' '.repeat(MAX_BYTES+1);
  assert.throws(()=>parsePackage(tooLargeText),/smaller than 32 MB/,'String inputs are bounded before parsing.');
  const state=snapshot('component-atlas');state.entities[0].data.chunks=huge.entities[0].data.chunks;
  assert.throws(()=>makePackage(state,emptyRegistry(),native('component-atlas')),/smaller than 32 MB/,'Exports must not create files that the importer refuses to open.');
});

test('Markdown sidecars contain frontmatter, stable references, missing status, and restorable reference data',()=>{
  const local=snapshot('sitemap-atlas');local.workspace.title='Renovation | "Planner"';
  let registry=mergePackage(pack('component-atlas'),emptyRegistry(),ownSource(local));registry.records[0].title='Project | card';registry.records[0].missing=true;
  registry=linkRecords(registry,ownEntities(local)[0].ref,registry.records[0].ref,'uses','Needs review.');
  const note=familyMarkdown(local,registry,'Product/Connections');
  assert.equal(note.path,'Product/Connections/sitemap-atlas-links.md');
  assert.ok(note.content.startsWith('---\nproduct_family_schema: 1\n'));
  assert.match(note.content,/product_family_app: "sitemap-atlas"/);
  assert.ok(note.content.includes('Project \\| card'));
  assert.match(note.content,/Missing in last source export/);
  assert.ok(note.content.includes(registry.records[0].ref));
  const json=note.content.match(/```json\n([\s\S]+?)\n```/);assert.ok(json);
  assert.deepEqual(JSON.parse(json[1]),{schemaVersion:1,records:registry.records,links:registry.links});
  for(const path of ['../escape','/absolute','C:\\outside','Product/../escape','Bad\u0000folder','Product/<bad>'])assert.throws(()=>familyMarkdown(local,registry,path),/relative vault folder/);
  assert.equal(familyMarkdown(local,registry,'Product\\Connections').path,'Product/Connections/sitemap-atlas-links.md');
});
