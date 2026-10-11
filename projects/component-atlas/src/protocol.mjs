/** Product Family Exchange v1. Pure data functions; no UI or storage dependencies. */
export const FORMAT = 'obsidian-product-family';
export const VERSION = 1;
export const MAX_BYTES = 32 * 1024 * 1024;
export const APPS = Object.freeze({
  'component-atlas': {name:'Component Atlas',purpose:'Define the building blocks',file:'component-atlas.html',icon:'i-lucide-boxes'},
  'storyloom': {name:'Storyloom',purpose:'Map the user’s journey',file:'storyloom-prototype.html',icon:'i-lucide-panels-top-left'},
  'sitemap-atlas': {name:'Sitemap Atlas',purpose:'Shape information architecture',file:'sitemap-atlas.html',icon:'i-lucide-network'},
  'dissect': {name:'Dissect',purpose:'Explore interfaces & interactions',file:'dissect-canvas.html',icon:'i-lucide-scan'}
});
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => {throw new Error(message);};
const required = (value,label,max=500) => typeof value === 'string' && value.trim() && value.length <= max ? value : fail(`${label} must be a non-empty string of at most ${max} characters.`);
export const clone = value => JSON.parse(JSON.stringify(value));
export function id(prefix='item') {return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}`;}
export function sourceKey(source) {return `${source.appId}/${encodeURIComponent(source.workspaceId)}`;}
export function reference(source,kind,localId) {return `opf://${[source.appId,source.workspaceId,kind,localId].map(encodeURIComponent).join('/')}`;}
export function validateSource(source) {
  if(!object(source)) fail('A source must identify its app and workspace.');
  required(source.appId,'Source app ID',80); required(source.workspaceId,'Source workspace ID',300);
  required(source.workspaceTitle,'Source workspace title',500);
  if(!/^[a-z][a-z0-9-]*$/.test(source.appId)) fail('Source app IDs may contain lowercase letters, digits and hyphens.');
  return source;
}
export function safeData(value) {
  let count=0;
  function visit(v,depth) {
    if(++count>300000 || depth>40) fail('This package is too deeply nested or contains too many values.');
    if(typeof v === 'string' && v.length>1000000) fail('A text field in this package exceeds the one-million-character limit.');
    if(typeof v === 'number' && !Number.isFinite(v)) fail('Numbers in the package must be finite.');
    if(v === null || ['string','number','boolean'].includes(typeof v)) return;
    if(!Array.isArray(v) && !object(v)) fail('Packages may contain JSON data only.');
    for(const [key,item] of Object.entries(v)) {
      if(['__proto__','prototype','constructor'].includes(key)) fail(`The reserved property “${key}” is not supported in exchange packages.`);
      visit(item,depth+1);
    }
  }
  visit(value,0); return value;
}
function unique(rows,key,label) {const seen=new Set();for(const row of rows){const value=key(row);if(seen.has(value))fail(`Duplicate ${label}: ${value}`);seen.add(value);}}
export function parsePackage(input) {
  if(typeof input === 'string' && new TextEncoder().encode(input).length>MAX_BYTES) fail('Choose a family package smaller than 32 MB.');
  let pack;
  try {pack=typeof input === 'string'?JSON.parse(input):clone(input);} catch {fail('This file is not valid JSON. Choose a Product Family package.');}
  safeData(pack);
  if(new TextEncoder().encode(JSON.stringify(pack)).length>MAX_BYTES)fail('Choose a family package smaller than 32 MB.');
  if(pack?.format!==FORMAT) fail('This is not a Product Family package. Use this editor’s native import for older JSON or ZIP exports.');
  if(pack.schemaVersion!==VERSION) fail(`Unsupported Product Family schema version ${pack.schemaVersion}. This prototype supports version 1.`);
  required(pack.packageId,'Package ID');required(pack.exportedAt,'Export timestamp');
  if(!Number.isFinite(Date.parse(pack.exportedAt)))fail('The export timestamp is invalid.');
  validateSource(pack.source);
  for(const key of ['entities','links','natives']) if(!Array.isArray(pack[key])) fail(`The package is missing its ${key} array.`);
  if(pack.entities.length>20000 || pack.links.length>40000 || pack.natives.length>100)fail('The package exceeds the supported record, link or workspace limit.');
  for(const entity of pack.entities) {
    if(!object(entity))fail('Every entity must be an object.');
    validateSource(entity.source);required(entity.id,'Entity ID',300);required(entity.title,'Entity title',1000);
    required(entity.kind,'Entity kind',120);
    if(!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(entity.kind))fail('Entity kinds must use a namespace, for example ui.component.');
    if(entity.ref!==reference(entity.source,entity.kind,entity.id))fail(`The reference for “${entity.title}” does not match its identity.`);
    for(const name of ['summary','status','path','updatedAt']) if(entity[name]!==undefined && typeof entity[name]!=='string')fail(`${name} must be text.`);
    if(entity.path && (/^(?:[\\/]|[A-Za-z]:)/.test(entity.path) || entity.path.replace(/\\/g,'/').split('/').some(p=>p==='..')))fail('Note paths must stay within a vault.');
    if(entity.data!==undefined&&!object(entity.data))fail('Entity data must be an object.');
    if(entity.missing!==undefined&&typeof entity.missing!=='boolean')fail('Snapshot availability must be true or false.');
  }
  unique(pack.entities,e=>e.ref,'entity identity');
  for(const link of pack.links) {
    if(!object(link))fail('Every link must be an object.');
    required(link.id,'Link ID');required(link.from,'Link source',2000);required(link.to,'Link target',2000);required(link.relation,'Link relation',100);
    if(!link.from.startsWith('opf://')||!link.to.startsWith('opf://'))fail('Links must use Product Family references.');
    if(link.from===link.to)fail('A link must connect two different records.');
    if(link.note!==undefined&&typeof link.note!=='string')fail('Link notes must be text.');
  }
  unique(pack.links,l=>l.id,'link ID');
  for(const native of pack.natives){validateSource(native.source);if(!object(native.data))fail('Native backups must be JSON objects.');}
  unique(pack.natives,n=>sourceKey(n.source),'native workspace');
  if(!pack.natives.some(n=>sourceKey(n.source)===sourceKey(pack.source)))fail('The source workspace’s native backup is missing.');
  if(pack.completeSources!==undefined && (!Array.isArray(pack.completeSources)||pack.completeSources.some(k=>k!==sourceKey(pack.source))))fail('A package may declare only its own source inventory complete.');
  return pack;
}
export function emptyRegistry(){return {schemaVersion:VERSION,records:[],links:[],sources:[],updatedAt:null};}
export function ownSource(snapshot){return {appId:snapshot.appId,workspaceId:snapshot.workspace.id,workspaceTitle:snapshot.workspace.title};}
export function ownEntities(snapshot) {
  const source=ownSource(snapshot);
  return (snapshot.entities||[]).map(row=>({...clone(row),source,ref:reference(source,row.kind,row.id)}));
}
function stable(value,root=true){if(Array.isArray(value))return '['+value.map(v=>stable(v,false)).join(',')+']';if(object(value))return '{'+Object.keys(value).filter(k=>!root||!['receivedAt','missing'].includes(k)).sort().map(k=>JSON.stringify(k)+':'+stable(value[k],false)).join(',')+'}';return JSON.stringify(value);}
export function packageSummary(pack,registry,localSource) {
  const existing=new Map(registry.records.map(e=>[e.ref,e]));let added=0,changed=0,unchanged=0,owned=0;
  for(const entity of pack.entities){if(sourceKey(entity.source)===sourceKey(localSource)){owned++;continue;}const old=existing.get(entity.ref);if(!old)added++;else if(stable(old)!==stable(entity))changed++;else unchanged++;}
  const all=new Set(pack.entities.map(e=>e.ref));
  const missing=registry.records.filter(e=>sourceKey(e.source)===sourceKey(pack.source)&&!all.has(e.ref)&&pack.completeSources?.includes(sourceKey(pack.source))).length;
  return {added,changed,unchanged,owned,missing,links:pack.links.length};
}
export function mergePackage(pack,registry,localSource,{updateExisting=false}={}) {
  // Validate before constructing a candidate. Callers commit the returned value atomically.
  pack=parsePackage(pack);
  const next=clone(registry),localKey=sourceKey(localSource),incoming=new Set(pack.entities.map(e=>e.ref));
  const rows=new Map(next.records.map(e=>[e.ref,e]));
  for(const entity of pack.entities){if(sourceKey(entity.source)===localKey)continue;const old=rows.get(entity.ref),ownerExport=sourceKey(entity.source)===sourceKey(pack.source);if(!old||updateExisting){rows.set(entity.ref,{...clone(entity),receivedAt:pack.exportedAt,missing:entity.missing===true||(!ownerExport&&old?.missing===true)});}else if(ownerExport){old.missing=false;}else if(entity.missing===true){old.missing=true;}}
  if(pack.completeSources?.includes(sourceKey(pack.source)))for(const row of rows.values())if(sourceKey(row.source)===sourceKey(pack.source)&&!incoming.has(row.ref))row.missing=true;
  next.records=[...rows.values()];
  const links=new Map(next.links.map(l=>[l.id,l]));
  const signature=l=>`${l.from}\n${l.to}\n${l.relation}`;
  const counts=new Map();
  for(const link of links.values()){const key=signature(link);counts.set(key,(counts.get(key)||0)+1);}
  for(const link of pack.links){
    const old=links.get(link.id);if(old&&!updateExisting)continue;
    const key=signature(link),oldKey=old&&signature(old);
    if((counts.get(key)||0)-(oldKey===key?1:0)>0)continue;
    if(oldKey)counts.set(oldKey,counts.get(oldKey)-1);
    links.set(link.id,clone(link));counts.set(key,(counts.get(key)||0)+1);
  }
  next.links=[...links.values()];
  const sources=new Map(next.sources.map(n=>[sourceKey(n.source),n]));
  for(const native of pack.natives){const key=sourceKey(native.source);if(key!==localKey&&(!sources.has(key)||updateExisting))sources.set(key,clone(native));}
  next.sources=[...sources.values()];next.updatedAt=new Date().toISOString();
  if(next.records.length>20000||next.links.length>40000||next.sources.length>100)fail('The combined workspace would exceed the supported exchange limits.');
  return next;
}
export function makePackage(snapshot,registry,native) {
  const source=ownSource(snapshot),localKey=sourceKey(source),own=ownEntities(snapshot),refs=new Set(own.map(e=>e.ref));
  const entities=[...own,...registry.records.filter(e=>sourceKey(e.source)!==localKey&&!refs.has(e.ref)).map(({receivedAt,...e})=>e)];
  const pack={format:FORMAT,schemaVersion:VERSION,packageId:id('package'),exportedAt:new Date().toISOString(),source,completeSources:[localKey],entities,links:clone(registry.links),natives:[{source,data:clone(native)},...registry.sources.filter(n=>sourceKey(n.source)!==localKey).map(clone)]};
  return parsePackage(pack);
}
export function linkRecords(registry,from,to,relation='relates-to',note='') {
  if(!from||!to||from===to)fail('Choose two different records to link.');
  if(registry.links.some(l=>l.from===from&&l.to===to&&l.relation===relation))fail('These records already have this link.');
  const next=clone(registry);next.links.push({id:id('link'),from,to,relation,note:String(note).slice(0,10000),createdAt:new Date().toISOString()});next.updatedAt=new Date().toISOString();return next;
}
export function linkHealth(link,entities){const map=new Map(entities.map(e=>[e.ref,e]));const a=map.get(link.from),b=map.get(link.to);if(!a||!b)return 'unresolved';if(a.missing||b.missing)return 'missing';return 'resolved';}
export function familyMarkdown(snapshot,registry,folder='Product/Family') {
  if(!folder||folder.length>240||/^(?:[\\/]|[A-Za-z]:)/.test(folder)||/[\u0000-\u001f<>:"|?*]/.test(folder)||folder.replace(/\\/g,'/').split('/').some(p=>p==='..'))fail('Use a relative vault folder without traversal or reserved path characters.');
  const lines=['---','product_family_schema: 1','product_family_app: '+JSON.stringify(snapshot.appId),'product_family_workspace: '+JSON.stringify(snapshot.workspace.id),'title: '+JSON.stringify(snapshot.workspace.title+' — family links'),'product_family_links: '+JSON.stringify(registry.links),'---','','# '+snapshot.workspace.title.replace(/[\r\n]/g,' ')+' — family links','','External records are snapshots. Their source plugin remains the owner.','','| Record | Kind | Source | State |','| --- | --- | --- | --- |'];
  const cell=s=>String(s||'').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
  for(const e of registry.records)lines.push(`| ${cell(e.title)} | ${cell(e.kind)} | ${cell(APPS[e.source.appId]?.name||e.source.appId)} · ${cell(e.source.workspaceTitle)} | ${e.missing?'Missing in last source export':'Snapshot'} |`);
  lines.push('','## Portable reference data','','```json',JSON.stringify({schemaVersion:1,records:registry.records,links:registry.links},null,2),'```','');
  return {path:folder.replace(/\\/g,'/').replace(/\/+$/,'')+'/'+snapshot.appId+'-links.md',content:lines.join('\n')};
}
