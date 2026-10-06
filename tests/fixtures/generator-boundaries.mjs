// Synthetic qualification design over the current (project v6) self-project starter. Never substituted for the actual companion export.
import { readFileSync } from 'node:fs';
import { projectModel } from '../../src/cli/compiler/emitters/model.ts';
import { noteWireSchemas } from '../../src/cli/compiler/emitters/note-contracts.ts';
// Reviewed visual page (IDs vp-5993, vn-5994..vn-6008, vi-6009) with typed controls, a mapped save and a slotted component.
const boundaryPage = JSON.parse(readFileSync(new URL('./companion/boundary-page.json', import.meta.url), 'utf8'));
export function boundaryProject(original) {
  const project = structuredClone(original), design = project.design;
  const entity = structuredClone(design.semantic.entities[0]);
  entity.id = 'er-entity-900'; entity.slug = 'boundary-record'; entity.name = 'Boundary record'; entity.folder = 'Boundary/Records';
  entity.properties = [['title','text'],['amount','number'],['enabled','checkbox'],['category','text'],['due','date'],['body','text']].map(([key,type],i)=>({id:'er-property-'+(910+i),key,type,required:true}));
  design.semantic.entities.push(entity); design.semantic.nextId = Math.max(design.semantic.nextId || 1, 920);
  design.semantic.relationships.push({id:'er-relationship-940',name:'Optional parent',source:entity.id,target:entity.id,key:'parent_ref',sourceCard:'0..*',targetCard:'0..1',onDelete:'restrict'});
  const resolved = projectModel(project).entities.find(e=>e.id===entity.id);
  const source = {id:'ds-source-900',slug:'boundary-records',name:'Boundary records',kind:'vault',status:'active',description:'Explicit native CRUD qualification',locator:'vault://active',auth:'none',credentialRef:'',operations:[]};
  const shape = schema => ({mode:schema ? 'schema' : 'none',entity:null,many:false,fields:[],schema});
  for (const [index,kind] of ['list','create','update','delete'].entries()) {
    const wire=noteWireSchemas(resolved,kind);
    source.operations.push({id:'ds-operation-'+(901+index),slug:kind,name:kind,direction:kind==='list'?'read':'write',method:'adapter',resource:entity.folder,description:'Explicit note '+kind,input:shape(wire.input),output:shape(wire.output),implementation:{kind:'note',entity:entity.id,operation:kind}});
  }
  const api={id:'ds-source-950',slug:'boundary-api',name:'Boundary API',kind:'api',status:'active',description:'Approved-origin JSON HTTP fixture',locator:'https://example.invalid/v1',auth:'runtime',credentialRef:'boundary-token',operations:[{id:'ds-operation-951',slug:'status',name:'Status',direction:'read',method:'GET',resource:'/status',description:'Read-only status',input:shape(null),output:shape({type:'object',properties:{status:{type:'string'}},required:['status'],additionalProperties:false})}]};
  design.dataSources.sources.push(api);
  design.dataSources.testing.recipes.push({source:api.id,operation:api.operations[0].id,enabled:true,behavior:'fixture',dataset:'api-status',keyField:'id',scenario:'populated',latencyMs:0,errorStatus:503,rules:[{side:'output',path:'/status',provider:'literal',argument:'\"ready\"'}]});
  design.dataSources.sources.push(source); design.dataSources.nextId=1000;
  const owner={...structuredClone(design.nodes.find(n=>n.kind==='page')),id:'node-900',slug:'boundary-validation',label:'Boundary validation',components:[],nav:false,command:false,ribbon:false};
  design.nodes.push(owner);design.nextId=Math.max(design.nextId,1000);
  const visual=design.visualDesigns; visual.pages.push(structuredClone(boundaryPage)); visual.nextId=Math.max(visual.nextId,6010);
  // The reusable review component's confirmation emits an explicit, mapped selection to its owning page.
  const review=visual.components.find(c=>c.libraryId==='project-json-review'), confirm=review?.template[0]?.children?.[2]?.events?.[0];
  if(!confirm||confirm.id!=='vi-114')throw new Error('BOUNDARY_FIXTURE: the self-project review confirmation moved.');
  confirm.actions=[{kind:'emit',event:'select',payload:{kind:'value',value:'reviewed-project'}}];
  return project;
}
