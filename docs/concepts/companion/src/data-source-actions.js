// Reviewed catalog transactions share the outline's persistence, Undo and generator review.
const dsUi={selected:null,catalogSelected:null,connection:null,hover:null,query:'',kind:'all',show:true,form:null,error:'',drag:null};
function dsFail(message){dsUi.error=message;if(modalType==='data-source-form'){redrawModal();document.getElementById('ds-error')?.focus();}else notify(message);return false;}
function dsToken(){return JSON.stringify(dsGeneration(design()));}
function dsOpen(kind,record={}){
 if(state.activeRun){notify('Finish or cancel the active simulation before changing data sources.');return false;}
 dsUi.form={...designCopy(record),formKind:kind,owner:designOwner(),revision:design().revision,snapshot:dsToken()};if(kind==='operation')dsUi.form.shapeBaselines=Object.fromEntries(['input','output'].map(side=>[side,{[record[side].mode]:designCopy(record[side])}]));dsUi.error='';showModal('data-source-form');return true;
}
function dsCommit(change){
 if(state.activeRun)return dsFail('Finish the active simulation first.');
 const d=design(),m=dataSources(d),candidate=designCopy(d);
 try{
  change(candidate.dataSources,candidate);
  const errors=dataSourceIssues(candidate,false).filter(i=>i.level==='error');if(errors.length)throw Error(errors[0].message);
  if(JSON.stringify(candidate.dataSources)===JSON.stringify(m))return true;
  const changed=JSON.stringify(dsGeneration(d))!==JSON.stringify(dsGeneration(candidate));recordDesign();d.dataSources=candidate.dataSources;
  if(changed)designChanged();else save();return true;
 }catch(error){return dsFail(error.message);}
}
function dsFreshSource(kind='api'){
 const names={api:'External API',vault:'Active Obsidian vault',database:'Database'},base=semanticName(names[kind]);let slug=base,n=2;
 while(dataSources().sources.some(s=>s.slug===slug))slug=base+'-'+n++;
 return {id:null,name:n===2?names[kind]:names[kind]+' '+(n-1),slug,kind,status:'draft',description:'',locator:kind==='vault'?'vault://active':'',auth:'none',credentialRef:'',operations:[]};
}
function dsEditSource(id){const source=dataSources().sources.find(s=>s.id===id);if(id&&!source)return dsFail('This source no longer exists. Select a current source.');dsOpen('source',source||dsFreshSource());}
function dsEditOperation(value){
 const [sourceId,id]=value.split(':'),source=dataSources().sources.find(s=>s.id===sourceId);if(!source)return notify('Select an existing data source first.');
 if(id&&!source.operations.some(o=>o.id===id))return dsFail('This operation no longer exists. Select a current operation.');
 const op=source.operations.find(o=>o.id===id)||{id:null,name:'Read records',slug:'read-records',direction:'read',method:source.kind==='api'?'GET':'adapter',resource:'',description:'',input:dsNewShape('none'),output:dsNewShape()};
 dsOpen('operation',{...op,sourceId,inputSchemaText:op.input.schema?JSON.stringify(op.input.schema,null,2):'{\n  "type": "object",\n  "properties": {}\n}',outputSchemaText:op.output.schema?JSON.stringify(op.output.schema,null,2):'{\n  "type": "object",\n  "properties": {}\n}'});
}
function dsEditFlow(id=null,sourceId=null,cardId=null,direction=null){
 const m=dataSources(),old=m.flows.find(f=>f.id===id);
 if(id&&!old)return dsFail('This data flow no longer exists. Select a current connection.');
 if(old)return dsOpen('flow',old);
 const sources=m.sources.filter(s=>s.status!=='deprecated'&&s.operations.some(o=>!direction||o.direction===direction||o.direction==='both')),cards=design().nodes.filter(n=>n.kind!=='group');
 const source=sourceId?m.sources.find(s=>s.id===sourceId):sources[0];
 if(!source)return dsFail('Add a data source with an operation before connecting data.');
 if(source.status==='deprecated')return dsFail('This source is deprecated. Choose an active or draft source.');
 if(!source.operations.length)return dsFail('Add an operation to '+source.name+' first. No other source was substituted.');
 const card=cardId?cards.find(n=>n.id===cardId):cards.find(n=>n.id===selectedNode()?.id)||cards[0];
 if(!card)return dsFail('Choose an existing view or screen, not a navigation group.');
 const op=source.operations.find(o=>!direction||o.direction===direction||o.direction==='both');
 if(!op)return dsFail('Add a '+direction+' operation to '+source.name+' first.');
 return dsOpen('flow',{id:null,source:source.id,operation:op.id,card:card.id,direction:direction||op.direction,label:op.name,trigger:'manual',notes:''});
}
function dsPosition(id,m=dataSources(),d=design()){
 if(!m.positions[id]){
  const c=canvasState(d),boxes=d.nodes.map(n=>({x:c.positions[n.id].x+brickSurfaceSize(n,d).width,y:c.positions[n.id].y}));
  m.positions[id]={x:Math.min(48000,Math.max(120,...boxes.map(b=>b.x))+220),y:Math.min(48000,80+Object.keys(m.positions).length*280)};
 }
 return m.positions[id];
}
function dsSave(){
 const draft=dsUi.form,f=draft?.removeRequested?{...draft,formKind:draft.removeRequested}:draft;if(!f||f.owner!==designOwner()||f.revision!==design().revision||f.snapshot!==dsToken())return dsFail('This review is stale. Copy your edits and reopen it; nothing was overwritten.');
 let selected=dsUi.catalogSelected,savedFlow=null;
 const ok=dsCommit((m,d)=>{
  if(f.formKind==='source'){
   const old=m.sources.find(s=>s.id===f.id);if(f.id&&!old)throw Error('The source no longer exists.');
   if(old&&old.slug!==f.slug.trim())throw Error('Source code names are stable.');
   if(old?.operations.length&&old.kind!==f.kind)throw Error('Keep the source kind while it has operations.');
   const s={id:f.id||dsNext(m,'source'),slug:f.slug.trim(),name:f.name.trim(),kind:f.kind,status:f.status,description:f.description.trim(),locator:f.kind==='vault'?'vault://active':f.locator.trim(),auth:f.kind==='vault'?'none':f.auth,credentialRef:f.kind==='vault'||f.auth==='none'?'':f.credentialRef.trim(),operations:old?.operations||[]};
   if(!dsLocatorValid(s))throw Error(s.kind==='api'?'Use an HTTPS base URL without credentials, query parameters or fragments.':'Use a logical connection name, not a connection string or password.');
   if(!dsSlug(s.slug)||!s.name)throw Error('Enter a name and a portable, unique code name.');
   if(m.sources.some(x=>x.id!==s.id&&x.slug===s.slug))throw Error('That source code name already exists.');
   if(old)m.sources[m.sources.indexOf(old)]=s;else m.sources.push(s);selected=s.id;
  }else if(f.formKind==='operation'){
   const source=m.sources.find(s=>s.id===f.sourceId);if(!source)throw Error('The source no longer exists.');
   const old=source.operations.find(o=>o.id===f.id);if(f.id&&!old)throw Error('The operation no longer exists.');
   if(old&&old.slug!==f.slug.trim())throw Error('Operation code names are stable.');
   const shape=side=>{const s=designCopy(f[side]);if(s.mode==='schema'){try{s.schema=JSON.parse(f[side+'SchemaText']);}catch{throw Error(side+': enter valid JSON Schema, not a sample payload.');}}if(!dsShapeValid(s))throw Error(side+': check field names, duplicates and the supported schema subset. Remote references and executable expressions are not supported.');return s;};
   const o={id:f.id||dsNext(m,'operation'),slug:f.slug.trim(),name:f.name.trim(),direction:f.direction,method:source.kind==='api'?f.method:'adapter',resource:f.resource.trim(),description:f.description.trim(),input:shape('input'),output:shape('output')};
   if(!dsResourceValid(source,o.resource))throw Error('Use a safe resource path or table name. No credentials, query string, protected folder or parent traversal.');
   if(source.operations.some(x=>x.id!==o.id&&x.slug===o.slug))throw Error('That operation code name already exists on this source.');
   if(m.flows.some(x=>x.operation===o.id&&o.direction!=='both'&&x.direction!==o.direction))throw Error('Existing flows need this operation’s current direction. Update or remove those flows first.');
   if(old)source.operations[source.operations.indexOf(old)]=o;else source.operations.push(o);selected=source.id;
  }else if(f.formKind==='flow'){
   const source=m.sources.find(s=>s.id===f.source),old=m.flows.find(x=>x.id===f.id);
   if(!source||f.id&&!old)throw Error('Source or connection no longer exists.');
   if(source.status==='deprecated'&&(!old||old.source!==source.id||old.operation!==f.operation||old.card!==f.card))throw Error('Deprecated sources cannot acquire new usages.');
   const flow={id:f.id||dsNext(m,'flow'),source:f.source,operation:f.operation,card:f.card,direction:f.direction,label:f.label.trim(),trigger:f.trigger,notes:f.notes.trim()};
   if(m.flows.some(x=>x.id!==flow.id&&x.source===flow.source&&x.operation===flow.operation&&x.card===flow.card&&x.direction===flow.direction))throw Error('That source operation is already connected in this direction. Edit the existing flow.');
   dsPosition(source.id,m,d);if(old)m.flows[m.flows.indexOf(old)]=flow;else m.flows.push(flow);selected=source.id;savedFlow=flow.id;
  }else if(f.formKind==='remove-source'){
   if(m.flows.some(x=>x.source===f.id))throw Error('Remove this source’s data flows explicitly first. The source and all usages were preserved.');
   m.sources=m.sources.filter(s=>s.id!==f.id);if(m.testing)m.testing.recipes=m.testing.recipes.filter(r=>r.source!==f.id);delete m.positions[f.id];selected=null;
  }else if(f.formKind==='remove-operation'){
   if(m.flows.some(x=>x.operation===f.id))throw Error('Remove or reassign the flows using this operation first.');
   const s=m.sources.find(s=>s.id===f.sourceId);if(s)s.operations=s.operations.filter(o=>o.id!==f.id);if(m.testing)m.testing.recipes=m.testing.recipes.filter(r=>r.operation!==f.id);
  }else if(f.formKind==='remove-flow')m.flows=m.flows.filter(x=>x.id!==f.id);
  else if(f.formKind==='position'){
   const x=Number(f.x),y=Number(f.y);if(!String(f.x).trim()||!String(f.y).trim()||![x,y].every(n=>Number.isFinite(n)&&Math.abs(n)<=50000))throw Error('Enter coordinates between −50,000 and 50,000.');
   if(!m.sources.some(s=>s.id===f.id))throw Error('The source was removed.');m.positions[f.id]={x,y};
  }
 });
 if(ok){dsUi.catalogSelected=selected;modalOriginal=null;closeModal();if(savedFlow&&state.view==='sitemap')dsRevealFlow(savedFlow);else render();notify(f.formKind==='position'?'Source positioned. Generator contracts unchanged.':'Data-source design saved. No external service, database or vault was accessed.');}return ok;
}
function handleDataSourceAction(action,value=''){
 // Source nodes are a separate projection, never native view/containment nodes.
 if(action==='canvas-edge'&&dataSources().flows.some(f=>f.id===value)){selectSitemapItem('data-flow',value);referenceUi.panel='inspector';paintMapSelection();dsEditFlow(value);return true;}
 if(action==='canvas-select'&&dsIsNode(value)){if(!flowUi.dragging&&!flowUi.suppressClick)dsPick(value);return true;}
 if(action==='canvas-select')dsUi.selected=null;
 if(!action.startsWith('ds-'))return false;
 switch(action){
  case 'ds-example':if(dsCommit(seedDataSourceExample)){dsUi.catalogSelected=dataSources().sources[0]?.id;render();}break;
  case 'ds-add':dsOpen('source',dsFreshSource(Object.hasOwn(DS_KINDS,value)?value:'api'));break;
  case 'ds-edit':dsEditSource(value||dsUi.catalogSelected);break;
  case 'ds-select':if(dataSources().sources.some(s=>s.id===value)){dsUi.catalogSelected=value;render();}break;
  case 'ds-save':dsSave();break;
  case 'ds-operation':dsEditOperation(value);break;
  case 'ds-connect':dsEditFlow(null,value||(state.view==='sources'?dsUi.catalogSelected:dsUi.selected));break;
  case 'ds-card-connect':dsEditFlow(null,null,value);break;
  case 'ds-flow':if(state.view==='sitemap'){selectSitemapItem('data-flow',value);paintMapSelection();}dsEditFlow(value);break;
  case 'ds-flow-reveal':if(!document.getElementById('modal').open||!askDiscardForm()){closeModal();dsRevealFlow(value);}break;
  case 'ds-remove-source':{if(requestInlineRemoval('remove-source',value))break;const s=dataSources().sources.find(s=>s.id===value);if(s)dsOpen('remove-source',s);break;}
  case 'ds-remove-operation':{const [sourceId,id]=value.split(':');if(requestInlineRemoval('remove-operation',id))break;const op=dataSources().sources.find(s=>s.id===sourceId)?.operations.find(o=>o.id===id);if(op)dsOpen('remove-operation',{id,sourceId});else dsFail('This operation no longer exists.');break;}
  case 'ds-remove-flow':if(!requestInlineRemoval('remove-flow',value)){const f=dataSources().flows.find(f=>f.id===value);if(f)dsOpen('remove-flow',f);else dsFail('This data flow no longer exists.');}break;
  case 'ds-place':if(dsIsNode(value)&&dsCommit((m,d)=>dsPosition(value,m,d))){dsUi.show=true;selectSitemapItem('source',value);referenceUi.panel='inspector';designUi.mode='map';setView('sitemap');Vue.nextTick(()=>fitMap(true));}break;
  case 'ds-position':{const p=dataSources().positions[value];if(p)dsOpen('position',{id:value,x:String(p.x),y:String(p.y)});break;}
  case 'ds-unplace':if(dataSources().flows.some(f=>f.source===value)){notify('This card has data flows. Remove them first, or hide the data layer without removing the card.');break;}if(dsCommit(m=>delete m.positions[value]))render();break;
  case 'ds-layer':dsUi.show=!dsUi.show;render();break;
  case 'ds-catalog':dsUi.catalogSelected=value||dsUi.catalogSelected;setView('sources');break;
  case 'ds-validate':showModal('copy',{title:'Local declaration validation · not a connection test',text:JSON.stringify(dataSourceIssues(design()),null,2),filename:'data-source-checks.json'});break;
  case 'ds-preview':showModal('copy',{title:'Data-source contract · preview only',text:JSON.stringify(dsGeneration(design()),null,2),filename:'data-sources.json'});break;
  case 'ds-field-add':{const f=dsUi.form,s=f?.[value];if(s?.mode==='fields'&&s.fields.length<40){let n=s.fields.length+1;while(s.fields.some(p=>p.name==='field'+n))n++;s.fields.push({name:'field'+n,type:'string',required:false});redrawModal();document.getElementById('ds-'+value+'-name-'+(s.fields.length-1))?.focus();}break;}
  case 'ds-field-remove':{const [side,index]=value.split(':');dsUi.form?.[side]?.fields.splice(Number(index),1);redrawModal();break;}
  default:return false;
 }return true;
}
function editDataSourceField(el){
 const key=el.dataset.field;if(!key?.startsWith('ds-'))return false;
 if(key==='ds-query'||key==='ds-filter'){dsUi[key==='ds-query'?'query':'kind']=el.value;const results=document.getElementById('ds-results');if(results)results.innerHTML=dsCatalogItems();const context=document.getElementById('ds-filter-context');if(context)context.innerHTML=dsFilterContext();return true;}
 const f=dsUi.form;if(!f)return true;dsUi.error='';const error=document.getElementById('ds-error');if(error)error.textContent='';
 if(key.startsWith('ds-shape-')){
  const [side,name]=key.slice(9).split('-'),s=f[side];if(!s)return true;
  if(name==='mode'){if(!f.shapeDrafts)f.shapeDrafts={input:{},output:{}};f.shapeDrafts[side][s.mode]=designCopy(s);f[side]=designCopy(f.shapeDrafts[side][el.value]||dsNewShape(el.value));if(el.value==='entity'&&!f[side].entity)f[side].entity=design().semantic?.entities[0]?.id||null;if(!f.shapeBaselines[side][el.value])f.shapeBaselines[side][el.value]=designCopy(f[side]);redrawModal();}
  else if(name==='entity')s.entity=el.value;
  else if(name==='many')s.many=el.checked;
  else if(name==='schemaText')f[side+'SchemaText']=el.value;
  else if(name==='name'||name==='type'||name==='required'){const field=s.fields[Number(el.dataset.index)];if(field)field[name]=name==='required'?el.checked:el.value;}
  return true;
 }
 const name=key.slice(3),previous=f.name,oldOperation=dataSources().sources.find(s=>s.id===f.source)?.operations.find(o=>o.id===f.operation),autoLabel=!f.label||f.label===oldOperation?.name;if(['name','slug','kind','status','description','locator','auth','credentialRef','direction','method','resource','source','operation','card','label','trigger','notes','x','y'].includes(name))f[name]=el.value;
 if(name==='name'&&!f.id&&f.slug===semanticName(previous)){f.slug=semanticName(f.name);const control=document.getElementById('ds-slug');if(control)control.value=f.slug;}
 if(name==='kind'){f.locator=f.kind==='vault'?'vault://active':'';f.auth='none';f.credentialRef='';redrawModal();}
 if(name==='source'){const o=dataSources().sources.find(s=>s.id===f.source)?.operations[0];f.operation=o?.id||'';f.direction=o?.direction||'read';if(autoLabel)f.label=o?.name||'';redrawModal();}
 if(name==='operation'){const source=dataSources().sources.find(s=>s.id===f.source),o=source?.operations.find(o=>o.id===f.operation);if(o){if(autoLabel)f.label=o.name;f.direction=o.direction==='both'?f.direction:o.direction;}redrawModal();}
 if(name==='card')redrawModal();
 if(name==='method'&&['GET','HEAD'].includes(f.method))f.direction='read';
 if(['direction','method','auth'].includes(name))redrawModal();return true;
}

function seedDataSourceExample(m,d){
 if(m.sources.length)throw Error('Example sources are available only in an empty catalog.');
 const shape=(many=false)=>({...dsNewShape('fields'),many,fields:[{name:'title',type:'string',required:true},{name:'completed',type:'boolean',required:true}]});
 const make=(kind,name,slug,locator,ops)=>{const source={id:dsNext(m,'source'),kind,name,slug,locator,status:'draft',description:'Illustrative source. No connection or record exists in this concept.',auth:'none',credentialRef:'',operations:ops.map(o=>({id:dsNext(m,'operation'),description:'Example contract, not a live integration.',...o}))};m.sources.push(source);return source;};
 const api=make('api','Tasks API','tasks-api','https://api.example.test',[
  {slug:'fetch-tasks',name:'Fetch tasks',direction:'read',method:'GET',resource:'/tasks',input:dsNewShape('none'),output:shape(true)},
  {slug:'push-task',name:'Push task',direction:'write',method:'POST',resource:'/tasks',input:shape(),output:dsNewShape('none')}]);
 const vault=make('vault','Active Obsidian vault','active-vault','vault://active',[{slug:'task-notes',name:'Read / save task notes',direction:'both',method:'adapter',resource:'Records/Task',input:shape(),output:shape()}]);
 const db=make('database','Reporting database','reporting-database','reportingDatabase',[{slug:'read-summary',name:'Read summary',direction:'read',method:'adapter',resource:'task_summary',input:dsNewShape('none'),output:shape(true)}]);
 const cards=d.nodes.filter(n=>n.kind!=='group');if(!cards.length)return;
 for(const [source,op,card] of [[api,api.operations[0],cards[0]],[api,api.operations[1],cards[1]||cards[0]],[vault,vault.operations[0],cards[1]||cards[0]],[db,db.operations[0],cards[2]||cards[0]]]){
  dsPosition(source.id,m,d);m.flows.push({id:dsNext(m,'flow'),source:source.id,operation:op.id,card:card.id,direction:op.direction,label:op.name,trigger:'manual',notes:'Example only. Implement explicit mapping, failure states and user consent.'});
 }
}
