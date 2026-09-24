// Persistent, data-only recipes are independent from canvas placement and live credentials.
const TD_PROVIDERS=Object.freeze({auto:'From shape / entity default',sequence:'Sequence / prefix',name:'Synthetic person name',email:'Reserved-domain email',integer:'Integer',boolean:'Checkbox / boolean',date:'Date',uuid:'Stable UUID',literal:'Literal JSON value'});
function tdDefaults(){return {schema:1,seed:42,referenceDate:'2026-01-01T00:00:00.000Z',locale:'en',count:12,recipes:[]};}
function tdSettings(d=design()){return d.dataSources?.testing||tdDefaults();}
function tdValidSettings(v,m){
 if(v===undefined)return true;
 if(!dsKeys(v,['schema','seed','referenceDate','locale','count','recipes'])||v.schema!==1||!Number.isSafeInteger(v.seed)||v.seed<0||v.seed>2147483647||!Number.isInteger(v.count)||v.count<1||v.count>100||!['en','de'].includes(v.locale)||!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(v.referenceDate)||!Number.isFinite(Date.parse(v.referenceDate))||new Date(v.referenceDate).toISOString()!==v.referenceDate||!Array.isArray(v.recipes)||v.recipes.length>288)return false;
 const ids=new Set();
 for(const r of v.recipes){
  const source=m.sources.find(s=>s.id===r.source),op=source?.operations.find(o=>o.id===r.operation);
  if(!op||ids.has(r.operation)||!dsKeys(r,['source','operation','enabled','behavior','dataset','keyField','scenario','latencyMs','errorStatus','rules'])||typeof r.enabled!=='boolean'||!['fixture','list','upsert','delete'].includes(r.behavior)||!dsSlug(r.dataset)||!dsKey(r.keyField)||!['populated','empty','error','slow'].includes(r.scenario)||!Number.isInteger(r.latencyMs)||r.latencyMs<0||r.latencyMs>5000||!Number.isInteger(r.errorStatus)||r.errorStatus<400||r.errorStatus>599||!Array.isArray(r.rules)||r.rules.length>80)return false;
  const keys=new Set();for(const rule of r.rules){if(!dsKeys(rule,['side','path','provider','argument'])||!['input','output'].includes(rule.side)||!dsText(rule.path,200)||!Object.hasOwn(TD_PROVIDERS,rule.provider)||!dsText(rule.argument,1000)||keys.has(rule.side+rule.path))return false;keys.add(rule.side+rule.path);}
  ids.add(r.operation);
 }
 return true;
}
function tdRecipe(source,op){const saved=tdSettings().recipes.find(r=>r.operation===op.id);return saved||{source:source.id,operation:op.id,enabled:false,behavior:'fixture',dataset:op.output.mode==='entity'?design().semantic.entities.find(e=>e.id===op.output.entity).slug:op.slug,keyField:'id',scenario:'populated',latencyMs:0,errorStatus:503,rules:[]};}
function tdNormalizeSchema(s){
 if(!s||s.declared===false||s.missingEntity)throw Error('Declare the input and output shapes first. Use “No payload” for an intentionally empty input.');
 const v=designCopy(s);delete v.declared;
 if(v.type==='object'){v.properties=Object.fromEntries(Object.entries(v.properties||{}).map(([k,p])=>[k,tdNormalizeSchema(p)]));v.required=v.required||[];}
 if(v.type==='array')v.items=tdNormalizeSchema(v.items);return v;
}
function tdEntity(e,m){
 const fields=erFields(e,m),properties={id:{type:'string',format:'uuid'},type:{type:'string',const:e.slug}};
 for(const p of fields){
  const type=({text:'string',number:'number',checkbox:'boolean',date:'string',datetime:'string',tags:'array',list:'array'})[p.type];
  const s={type};if(type==='array')s.items={type:'string'};if(p.type==='date')s.format='date';if(p.type==='datetime')s.format='date-time';
  if(p.type==='list'&&!p.relationship)s.items={type:['string','number']};
  if(Object.hasOwn(p,'defaultValue'))s.default=designCopy(p.defaultValue);properties[p.key]=s;
 }
 return {id:e.id,slug:e.slug,folder:e.folder,schema:{type:'object',properties,required:['id','type',...fields.filter(p=>p.required).map(p=>p.key)],additionalProperties:false},relationships:m.relationships.filter(r=>r.source===e.id).map(r=>({key:r.key,target:r.target,many:erMany(r.targetCard)}))};
}
function tdManifest(d=design()){
 const settings=tdSettings(d),sources=d.dataSources||emptyDataSources();
 if(!tdValidSettings(settings,sources))throw Error('Test recipes are malformed or reference a missing source operation.');
 const entities=(d.semantic?.entities||[]).map(e=>tdEntity(e,d.semantic));
 const shape=s=>s.mode==='none'?{none:true}:s.mode==='entity'?{entity:s.entity,many:s.many,schema:s.many?{type:'array',items:designCopy(entities.find(e=>e.id===s.entity)?.schema)}:designCopy(entities.find(e=>e.id===s.entity)?.schema)}:{schema:tdNormalizeSchema(dsResolveShape(s,d))};
 const operations=settings.recipes.filter(r=>r.enabled).map(r=>{
  const source=sources.sources.find(s=>s.id===r.source),op=source.operations.find(o=>o.id===r.operation);
  if(source.status==='deprecated')throw Error('Disable test recipes for deprecated source '+source.name+'.');
  return {id:op.id,source:source.slug,slug:op.slug,kind:source.kind,direction:op.direction,method:op.method,resource:op.resource|| (source.kind==='api'?'/':''),input:shape(op.input),output:shape(op.output),behavior:r.behavior,dataset:r.dataset,keyField:r.keyField,scenario:r.scenario,latencyMs:r.latencyMs,errorStatus:r.errorStatus,rules:designCopy(r.rules)};
 });
 return {schema:1,engine:'shell-fixtures/1',target:'.test-vault',seed:settings.seed,count:settings.count,locale:settings.locale,referenceDate:settings.referenceDate,entities,operations};
}
function tdFingerprint(){return JSON.stringify({owner:designOwner(),settings:tdSettings(),semantic:semanticGeneration(design()),sources:dsGeneration(design())});}
function tdRows(shape,side){
 if(shape.mode==='none'||shape.mode==='unspecified')return [];
 const s=tdNormalizeSchema(dsResolveShape(shape)),rows=[];
 const visit=(schema,path)=>{if(schema.type==='object'){for(const [k,v] of Object.entries(schema.properties))visit(v,path+'/'+k);}else if(schema.type==='array')visit(schema.items,path+'/*');else rows.push({side,path,type:dsTypeScript(schema),entity:shape.mode==='entity'});};visit(s,'');return rows;
}
