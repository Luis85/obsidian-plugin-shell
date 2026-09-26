// Data-only source catalog. Rendering and source previews never open a connection.
const DS_KINDS = Object.freeze({vault:'Obsidian vault',api:'External service / API',database:'Database'});
const DS_DIRECTIONS = Object.freeze({read:'Read · source → card',write:'Write · card → source',both:'Read & write · source ↔ card'});
const DS_TYPES = ['string','number','integer','boolean','object','array','null'];
const DS_LIMITS = Object.freeze({sources:24,operations:12,flows:120,fields:40,schemaBytes:12000});
function emptyDataSources(){return {schema:1,nextId:1,sources:[],flows:[],positions:{}};}
function dataSources(d=design()){if(!d.dataSources)d.dataSources=emptyDataSources();return d.dataSources;}
function dsPlain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function dsKeys(v,keys){return dsPlain(v)&&Object.keys(v).every(k=>keys.includes(k));}
function dsText(v,max=120){return typeof v==='string'&&v.length<=max;}
function dsKey(v){return typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);}
function dsSlug(v){return typeof v==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)&&v.length<=60&&!['constructor','prototype'].includes(v);}
function dsId(v,prefix){return typeof v==='string'&&new RegExp('^ds-'+prefix+'-[1-9][0-9]*$').test(v)&&Number.isSafeInteger(Number(v.split('-').at(-1)));}
function dsNext(m,prefix){if(!Number.isSafeInteger(m.nextId)||m.nextId>=Number.MAX_SAFE_INTEGER-10000)throw Error('Source ID range exhausted.');return 'ds-'+prefix+'-'+m.nextId++;}
function dsNewShape(mode='unspecified'){return {mode,entity:null,many:false,fields:[],schema:null};}
function dsSchemaValid(value,depth=0,budget={count:0}){
 if(depth>6||++budget.count>120||!dsKeys(value,['$schema','type','properties','required','additionalProperties','items','description','format','enum']))return false;
 if(!(DS_TYPES.includes(value.type)||Array.isArray(value.type)&&value.type.length>0&&value.type.length<=5&&new Set(value.type).size===value.type.length&&value.type.every(t=>['string','number','integer','boolean','null'].includes(t)))||value.$schema!==undefined&&value.$schema!=='https://json-schema.org/draft/2020-12/schema')return false;
 if(value.description!==undefined&&!dsText(value.description,300))return false;
 if(value.format!==undefined&&(value.type!=='string'||!['date','date-time','uuid','email','uri'].includes(value.format)))return false;
 if(value.enum!==undefined){
  const types=Array.isArray(value.type)?value.type:[value.type],matches=x=>types.some(t=>t==='null'?x===null:t==='integer'?Number.isSafeInteger(x):t==='number'?typeof x==='number'&&Number.isFinite(x):t==='string'?dsText(x,120):t==='boolean'?typeof x==='boolean':false);
  if(!Array.isArray(value.enum)||!value.enum.length||value.enum.length>30||new Set(value.enum.map(x=>JSON.stringify(x))).size!==value.enum.length||!value.enum.every(matches))return false;
 }
 if(value.type==='object'){
  if(value.items!==undefined||value.format!==undefined)return false;
  if(value.properties!==undefined&&(!dsPlain(value.properties)||Object.keys(value.properties).length>40||!Object.entries(value.properties).every(([k,v])=>dsKey(k)&&dsSchemaValid(v,depth+1,budget))))return false;
  if(value.required!==undefined&&(!Array.isArray(value.required)||new Set(value.required).size!==value.required.length||!value.required.every(k=>Object.hasOwn(value.properties||{},k))))return false;
  return value.additionalProperties===undefined||typeof value.additionalProperties==='boolean';
 }
 if(['properties','required','additionalProperties'].some(k=>Object.hasOwn(value,k)))return false;
 return value.type==='array'?dsSchemaValid(value.items,depth+1,budget):value.items===undefined;
}
function dsShapeValid(s){
 if(!dsKeys(s,['mode','entity','many','fields','schema'])||!['unspecified','none','entity','fields','schema'].includes(s.mode)||typeof s.many!=='boolean'||!Array.isArray(s.fields)||s.fields.length>DS_LIMITS.fields)return false;
 if(!s.fields.every(p=>dsKeys(p,['name','type','required'])&&dsKey(p.name)&&DS_TYPES.includes(p.type)&&typeof p.required==='boolean')||new Set(s.fields.map(p=>p.name)).size!==s.fields.length)return false;
 if(s.mode==='entity')return typeof s.entity==='string'&&/^er-entity-[1-9][0-9]*$/.test(s.entity)&&!s.fields.length&&s.schema===null;
 if(s.entity!==null)return false;
 if(s.mode==='fields')return s.schema===null;
 if(s.fields.length)return false;
 if(s.mode==='schema')return s.many===false&&dsPlain(s.schema)&&JSON.stringify(s.schema).length<=DS_LIMITS.schemaBytes&&dsSchemaValid(s.schema);
 return s.schema===null&&s.many===false;
}
function dsLocatorValid(source){
 if(source.kind==='vault')return source.locator==='vault://active'&&source.auth==='none'&&source.credentialRef==='';
 if(source.kind==='database')return source.locator===''||dsKey(source.locator);
 if(!source.locator)return true;
 try{const u=new URL(source.locator);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&!/[\s\\\x00-\x1f]/.test(source.locator)&&!/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(source.locator);}catch{return false;}
}
function dsResourceValid(source,resource){
 if(!dsText(resource,240)||/[\\\x00-\x1f?#]/.test(resource)||resource.split('/').some(p=>['..','.','.obsidian','.git'].includes(p)))return false;
 if(source.kind==='api')return resource===''||/^\/[a-zA-Z0-9_\-/{},.]*$/.test(resource);
 if(source.kind==='vault')return resource===''||validVaultRelativePath(resource)&&!resource.split('/').some(p=>p.startsWith('.'));
 return resource===''||/^[a-zA-Z][a-zA-Z0-9_.-]{0,119}$/.test(resource);
}
function dataSourcesShape(m){
 if(m===undefined)return true;
 if(!dsKeys(m,['schema','nextId','sources','flows','positions','testing'])||m.schema!==1||!Number.isSafeInteger(m.nextId)||m.nextId<1||m.nextId>=Number.MAX_SAFE_INTEGER-10000||!Array.isArray(m.sources)||m.sources.length>DS_LIMITS.sources||!Array.isArray(m.flows)||m.flows.length>DS_LIMITS.flows||!dsPlain(m.positions))return false;
 const ids=[];
 for(const s of m.sources){
  if(!dsKeys(s,['id','slug','name','kind','status','description','locator','auth','credentialRef','operations'])||!dsId(s.id,'source')||!dsSlug(s.slug)||!dsText(s.name,80)||!s.name.trim()||!Object.hasOwn(DS_KINDS,s.kind)||!['draft','active','deprecated'].includes(s.status)||!dsText(s.description,1000)||!dsText(s.locator,240)||!['none','api-key','oauth','runtime'].includes(s.auth)||!dsText(s.credentialRef,60)||s.credentialRef!==''&&!dsKey(s.credentialRef)||!dsLocatorValid(s)||!Array.isArray(s.operations)||s.operations.length>DS_LIMITS.operations)return false;
  ids.push(s.id);
  for(const o of s.operations){
   if(o.implementation!==undefined&&(!dsKeys(o.implementation,['kind','entity','operation'])||s.kind!=='vault'||o.implementation.kind!=='note'||!/^er-entity-[1-9][0-9]*$/.test(o.implementation.entity)||!['list','create','update','delete'].includes(o.implementation.operation)))return false;
   if(!dsKeys(o,['id','slug','name','direction','method','resource','description','input','output','implementation'])||!dsId(o.id,'operation')||!dsSlug(o.slug)||!dsText(o.name,80)||!o.name.trim()||!Object.hasOwn(DS_DIRECTIONS,o.direction)||!['GET','POST','PUT','PATCH','DELETE','HEAD','adapter'].includes(o.method)||!dsResourceValid(s,o.resource)||!dsText(o.description,1000)||!dsShapeValid(o.input)||!dsShapeValid(o.output))return false;
   if(s.kind!=='api'&&o.method!=='adapter'||s.kind==='api'&&o.method==='adapter')return false;
   if(['GET','HEAD'].includes(o.method)&&o.direction!=='read')return false;
   ids.push(o.id);
  }
  if(new Set(s.operations.map(o=>o.slug)).size!==s.operations.length)return false;
 }
 for(const f of m.flows){
  if(!dsKeys(f,['id','source','operation','card','direction','label','trigger','notes'])||!dsId(f.id,'flow')||!dsId(f.source,'source')||!dsId(f.operation,'operation')||!dsText(f.card,120)||!Object.hasOwn(DS_DIRECTIONS,f.direction)||!dsText(f.label,80)||!f.label.trim()||!['on-open','on-submit','manual','background','event'].includes(f.trigger)||!dsText(f.notes,1000))return false;
  const source=m.sources.find(s=>s.id===f.source),op=source?.operations.find(o=>o.id===f.operation);
  if(!op||op.direction!==f.direction&&op.direction!=='both'||!Object.hasOwn(m.positions,f.source))return false;
  ids.push(f.id);
 }
 if(new Set(ids).size!==ids.length||ids.some(id=>Number(id.split('-').at(-1))>=m.nextId)||new Set(m.sources.map(s=>s.slug)).size!==m.sources.length)return false;
 if(new Set(m.flows.map(f=>JSON.stringify([f.source,f.operation,f.card,f.direction]))).size!==m.flows.length)return false;
 if(!tdValidSettings(m.testing,m))return false;
 return Object.keys(m.positions).length<=DS_LIMITS.sources&&Object.entries(m.positions).every(([id,p])=>m.sources.some(s=>s.id===id)&&dsKeys(p,['x','y'])&&[p.x,p.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=50000));
}
function dsReferences(d){
 const m=d.dataSources;if(!m)return [];
 return m.sources.flatMap(s=>s.operations.flatMap(o=>['input','output'].filter(k=>o[k].mode==='entity').map(k=>({source:s,operation:o,side:k,entity:o[k].entity}))));
}
function dataSourceIssues(d,qualify=true){
 const m=d.dataSources;if(!m)return [];
 const issues=[],add=(level,code,message)=>issues.push({level,code:'data-source-'+code,message});
 if(!dataSourcesShape(m)){add('error','schema','Invalid data-source declaration, duplicate identity, unsupported shape or incompatible connection.');return issues;}
 const usedIds=new Set([...d.nodes,...d.links].map(x=>x.id));
 for(const x of [...m.sources,...m.flows])if(usedIds.has(x.id))add('error','collision','Data-source and sitemap identities must be distinct.');
 for(const r of dsReferences(d))if(!d.semantic?.entities.some(e=>e.id===r.entity))add('error','entity','Data shape for '+r.source.name+' / '+r.operation.name+' references a missing entity.');
 for(const f of m.flows){
  const card=d.nodes.find(n=>n.id===f.card),source=m.sources.find(s=>s.id===f.source),op=source.operations.find(o=>o.id===f.operation);
  if(!card||card.kind==='group')add('error','card','Data flow '+f.label+' needs an existing view, screen, dialog, settings surface or action.');
  if(!qualify)continue;
  if(source.status!=='active')add('warning','status',source.name+' is '+source.status+'. This is design intent, not an available connection.');
  if(source.auth!=='none'&&!source.credentialRef)add('warning','credential',source.name+': declare a runtime credential reference before implementing its adapter.');
  for(const side of f.direction==='both'?['input','output']:f.direction==='read'?['output']:['input'])if(['unspecified','none'].includes(op[side].mode))add('error','shape',f.label+': declare the '+side+' data shape required by this flow.');
  const shape=f.direction==='write'?op.input:op.output;
  if(card?.entity&&shape.mode==='entity'&&![shape.entity,d.semantic?.entities.find(e=>e.id===shape.entity)?.slug].includes(card.entity))add('warning','mapping',f.label+': source and card use different entities. Implement an explicit mapping; no transformation is inferred.');
 }
 return issues;
}
function dsGeneration(d){
 const m=d.dataSources;if(!m?.sources.length)return null;
 return {schema:1,...(m.testing?{testing:designCopy(m.testing)}:{}),sources:designCopy(m.sources),flows:designCopy(m.flows),resolvedShapes:m.sources.flatMap(s=>s.operations.map(o=>({source:s.id,operation:o.id,input:dsResolveShape(o.input,d),output:dsResolveShape(o.output,d)})))};
}
function dsResolveShape(s,d=design()){
 if(s.mode==='unspecified')return {declared:false};
 if(s.mode==='none')return {declared:true,payload:false};
 if(s.mode==='schema')return designCopy(s.schema);
 let fields=s.fields;
 if(s.mode==='entity'){
  const e=d.semantic?.entities.find(e=>e.id===s.entity);if(!e)return {missingEntity:s.entity};
  fields=[{name:'id',type:'string',required:true},{name:'type',type:'string',required:true},...erFields(e,d.semantic).map(p=>({name:p.key,type:({text:'string',number:'number',checkbox:'boolean',date:'string',datetime:'string',tags:'array',list:'array'})[p.type],required:p.required,listItems:p.type==='list'&&!p.relationship?['string','number']:'string'}))];
 }
 const properties=Object.fromEntries(fields.map(p=>[p.name,p.type==='array'?{type:'array',items:{type:p.listItems||'string'}}:p.type==='object'?{type:'object',additionalProperties:true}:{type:p.type}]));
 const schema={type:'object',properties,required:fields.filter(p=>p.required).map(p=>p.name),additionalProperties:true};
 return s.many?{type:'array',items:schema}:schema;
}
function dsShapeLabel(s,d=design()){
 if(s.mode==='none')return 'No payload';if(s.mode==='unspecified')return 'Not declared';
 if(s.mode==='entity')return (d.semantic?.entities.find(e=>e.id===s.entity)?.name||'Missing entity')+(s.many?'[]':'');
 if(s.mode==='fields')return s.fields.length+(s.fields.length===1?' field':' fields')+(s.many?' · collection':'');
 return 'JSON Schema · '+s.schema?.type;
}
