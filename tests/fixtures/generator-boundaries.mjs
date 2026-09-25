// Synthetic qualification design. Never substituted for the actual companion export.
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { noteWireSchemas } from '../../scripts/companion/compiler/note-contracts.ts';
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
  const store=design.detailDesigns; store.schema=2; store.nextId=1000;
  const owner=design.nodes.find(n=>n.kind==='page'&&!store.documents.some(d=>d.kind==='page'&&d.ownerId===n.id));
  const doc={id:'detail-document-100',kind:'page',ownerId:owner.id,ownerLabel:owner.label,notes:'Boundary verification only',nodes:[],edges:[]};
  const node=(id,kind,label,parentId='detail-node-101')=>({id:'detail-node-'+id,kind,label,text:'',parentId,layout:'stack',position:{x:0,y:0},size:{width:240,height:120},component:null,props:{},binding:null,a11y:'Enter '+label,visibleIn:['default','loading','empty','error','disabled'],sourceBrickId:null});
  doc.nodes.push(node(101,'region','Form',null));
  for(const [id,kind,label] of [[102,'number','Amount'],[103,'checkbox','Enabled'],[104,'select','Category'],[105,'date','Due'],[106,'json-editor','Configuration'],[107,'markdown-editor','Body'],[108,'json-file','Import JSON'],[115,'datetime-local','Appointment'],[116,'textarea','Description']]) {
    const field=node(id,'input',label); field.control={kind,...(kind==='select'?{options:[{value:'first',label:'First'},{value:'second',label:'Second'}]}:{} )}; doc.nodes.push(field);
  }
  doc.nodes.push(node(109,'button','Save'),node(110,'text','Saved records'));
  const instance=node(111,'component','Review'); const definition=design.library.find(c=>c.id==='project-json-review');
  instance.component={id:definition.id,label:definition.name,version:definition.version,variantId:'default'}; instance.slots={content:['detail-node-112']};
  const region=node(112,'region','Assigned slot',null), text=node(113,'text','Slot content',region.id); text.text='This content must render once in the reusable slot.';
  doc.nodes.push(instance,region,text);
  const draft=nodeId=>({kind:'draft',nodeId:'detail-node-'+nodeId});
  const input = {kind:'object',fields:{
    requestId:{kind:'value',value:'boundary-request-1'},
    values:{kind:'object',fields:{title:{kind:'value',value:'Boundary note'},amount:draft(102),enabled:draft(103),category:draft(104),due:draft(105),body:draft(107)}}
  }};
  doc.edges.push({id:'detail-edge-114',source:'detail-node-109',target:'detail-node-110',event:'click',label:'Save mapped record',
    notes:'Explicit mapping; no prose inference',acceptance:'The native adapter persists the entered values',targetSurfaceId:null,
    action:{kind:'source',sourceId:source.id,operationId:source.operations[1].id,input}});
  store.documents.push(doc);
  store.documents[0].edges[0].action={kind:'emit',event:'select',payload:{kind:'value',value:'reviewed-project'}};
  return project;
}
