function erOpen(kind,record={}){
 if(state.activeRun)return notify('Finish or cancel the simulation before editing the semantic layer.');
 const m=semanticModel();erUi.error='';erUi.form={...designCopy(record),formKind:kind,owner:designOwner(),revision:design().revision,snapshot:JSON.stringify(m)};showModal('semantic-form');
}
function erBeginEntity(id=null){
 const m=semanticModel(),e=m.entities.find(e=>e.id===id);if(id&&!e)return erFail('This entity no longer exists. Select a current entity.');let name='New entity',n=2;while(m.entities.some(e=>e.slug===semanticName(name)))name='New entity '+n++;
 erOpen('entity',e?{...e,editing:true,properties:e.properties.map(p=>({...p,hasDefault:Object.hasOwn(p,'defaultValue'),defaultText:Object.hasOwn(p,'defaultValue')?(typeof p.defaultValue==='string'?p.defaultValue:JSON.stringify(p.defaultValue)):''}))}:{id:null,name,slug:semanticName(name),folder:'Records/'+semanticPascal(semanticName(name)),description:'',section:null,properties:[],editing:false});
}
function erFail(message){erUi.error=message;if(modalType==='semantic-form'){redrawModal();document.getElementById('er-form-error')?.focus();}else{erAnnounce(message);notify(message);}return false;}
function erCommit(change,visual=false){
 if(state.activeRun)return erFail('Finish the active simulation first.');
 const d=design(),m=semanticModel(d),candidate=designCopy(d);
 try{
  change(candidate.semantic);const errors=semanticIssues(candidate).filter(i=>i.level==='error');if(errors.length)throw Error(errors[0].message);
  if(JSON.stringify(candidate.semantic)===JSON.stringify(m))return true;
  const changed=JSON.stringify(semanticGeneration(d))!==JSON.stringify(semanticGeneration(candidate));recordDesign();d.semantic=candidate.semantic;if(changed)designChanged();else save();return true;
 }catch(error){return erFail(error.message);}
}
function erSave(){
 const draft=erUi.form,f=draft?.removeRequested?{...draft,formKind:draft.removeRequested}:draft,m=semanticModel();if(!f||f.owner!==designOwner()||f.revision!==design().revision||f.snapshot!==JSON.stringify(m))return erFail('This review is stale. Copy your edits and reopen it; nothing has been overwritten.');
 const visual=['section','remove-section','position'].includes(f.formKind);let selected=erUi.selected,edge=erUi.edge;
 const ok=erCommit(next=>{
  if(f.formKind==='entity'){
   const e={id:f.id||semanticId(next,'entity'),name:f.name.trim(),slug:f.slug.trim(),folder:f.folder.trim(),description:f.description.trim(),section:f.section||null,properties:f.properties.map(p=>{
    const field={id:p.id||semanticId(next,'property'),key:p.key.trim(),type:p.type,required:p.required};
    if(p.hasDefault){let v=p.defaultText;if(['number','checkbox','list','tags'].includes(p.type)){try{v=JSON.parse(v);}catch{throw Error('Default for '+field.key+' must be valid '+p.type+' data. Lists use a JSON array.');}}if(!erDefaultValid(p.type,v))throw Error('Invalid '+p.type+' default for '+field.key+'.');field.defaultValue=v;}return field;
   })};
   if(f.editing){const index=next.entities.findIndex(e=>e.id===f.id);if(index<0)throw Error('The entity was removed.');if(next.entities[index].slug!==e.slug)throw Error('An entity code name is stable. Migration is a separate workflow.');next.entities[index]=e;}else next.entities.push(e);
   if(!next.canvas.positions[e.id]){const count=next.entities.length-1;next.canvas.positions[e.id]={x:60+(count%3)*350,y:60+Math.floor(count/3)*450};}selected=e.id;edge=null;
  }else if(f.formKind==='relationship'){
   const r=Object.fromEntries(['id','name','source','target','key','sourceCard','targetCard','onDelete'].map(k=>[k,k==='id'?(f.id||semanticId(next,'relationship')):f[k]]));
   r.name=r.name.trim();r.key=r.key.trim();const index=next.relationships.findIndex(r=>r.id===f.id);if(f.id&&index<0)throw Error('The relationship was removed.');if(index<0)next.relationships.push(r);else next.relationships[index]=r;edge=r.id;selected=null;
  }else if(f.formKind==='position'){
   if(!next.entities.some(e=>e.id===f.id))throw Error('This entity no longer exists.');
   const x=Number(f.x),y=Number(f.y);if(String(f.x).trim()===''||String(f.y).trim()===''||![x,y].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))throw Error('Enter both coordinates between -100000 and 100000.');
   next.canvas.positions[f.id]={x,y};
  }else if(f.formKind==='section'){
   const item={id:f.id||semanticId(next,'section'),name:f.name.trim()};const index=next.sections.findIndex(s=>s.id===f.id);if(index<0)next.sections.push(item);else next.sections[index]=item;
  }else if(f.formKind==='remove-section'){next.sections=next.sections.filter(s=>s.id!==f.id);next.entities.forEach(e=>{if(e.section===f.id)e.section=null;});
  }else if(f.formKind==='remove-entity'){
   if(dsReferences(design()).some(r=>r.entity===f.id))throw Error('Update the data-source input/output shapes that reference this entity first.');
   if(next.relationships.some(r=>r.source===f.id||r.target===f.id))throw Error('Remove this entity’s relationships explicitly before deleting the entity.');
   const e=next.entities.find(e=>e.id===f.id);if(design().nodes.some(n=>n.entity===f.id||n.entity===e?.slug))throw Error('Unbind this entity from its sitemap surfaces first.');
   next.entities=next.entities.filter(e=>e.id!==f.id);delete next.canvas.positions[f.id];selected=null;
  }else if(f.formKind==='remove-relationship'){next.relationships=next.relationships.filter(r=>r.id!==f.id);edge=null;}
 });
 if(ok){erUi.selected=selected;erUi.edge=edge;modalOriginal=null;closeModal();render();notify(visual?'Arrangement saved. Entity contracts are unchanged.':'Semantic design saved. Review generation before applying any schema.');}return ok;
}
function erBeginRelationship(source=null,target=null,id=null){
 const m=semanticModel(),existing=m.relationships.find(r=>r.id===id);if(id&&!existing)return erFail('This relationship no longer exists. Select a current connection.');if(m.entities.length<1)return notify('Add an entity before defining a relationship.');
 erOpen('relationship',existing||{id:null,name:'References',source:source||m.entities[0].id,target:target||m.entities.at(-1).id,key:'related',sourceCard:'0..*',targetCard:'0..1',onDelete:'restrict'});
}
function erPick(id,edge=false){erUi.selected=edge?null:id;erUi.edge=edge?id:null;const inspector=document.getElementById('er-inspector');if(inspector)inspector.innerHTML=erInspector();if(erUi.api){erUi.api.applyNodeChanges(erUi.api.getNodes.value.map(n=>({id:n.id,type:'select',selected:n.id===erUi.selected})));erUi.api.applyEdgeChanges(erUi.api.getEdges.value.map(e=>({id:e.id,type:'select',selected:e.id===erUi.edge})));}erSelectionFeedback();}
function handleSemanticAction(action,value){
 if(!action.startsWith('er-'))return false;if(!project())return true;
 const m=semanticModel();if(erExtraAction(action,value))return true;
 switch(action){
  case 'er-add':erBeginEntity();break;
  case 'er-example':if(!m.entities.length&&erCommit(seedSemanticExample)){render();erFit();}break;
  case 'er-edit':erBeginEntity(value||erUi.selected);break;
  case 'er-select':erPick(value);erReveal(value);break;
  case 'er-edge':erPick(value,true);break;
  case 'er-connect':erBeginRelationship(erUi.selected);break;
  case 'er-edit-edge':erBeginRelationship(null,null,value||erUi.edge);break;
  case 'er-section':{const section=m.sections.find(s=>s.id===value);if(value&&!section)erFail('This section no longer exists.');else erOpen('section',section||{id:null,name:'New section'});break;}
  case 'er-delete-section':{const section=m.sections.find(s=>s.id===value);if(section)erOpen('remove-section',section);else erFail('This section no longer exists.');break;}
  case 'er-delete':{const entity=m.entities.find(e=>e.id===(value||erUi.selected));if(entity)erOpen('remove-entity',entity);else erFail('This entity no longer exists.');break;}
  case 'er-delete-edge':{const id=value||erUi.edge;if(requestInlineRemoval('remove-relationship',id))break;const r=m.relationships.find(r=>r.id===id);if(r)erOpen('remove-relationship',r);else erFail('This relationship no longer exists.');break;}
  case 'er-save':erSave();break;
  case 'er-property-add':if(erUi.form.properties.length<40){erUi.form.properties.push({id:null,key:'',type:'text',required:false,hasDefault:false,defaultText:''});redrawModal();document.querySelector('#er-property-rows .er-property-row:last-child input')?.focus();}else erFail('Use at most 40 properties per entity.');break;
  case 'er-property-remove':if(Number.isInteger(Number(value))) {erUi.form.properties.splice(Number(value),1);redrawModal();}break;
  case 'er-mode':erUi.mode=['list','relationships'].includes(value)?value:'map';render();break;
  case 'er-arrange':if(erCommit(semanticArrange,true)){render();erFit();}break;
  case 'er-fit':erFit();break;
  case 'er-zoom-in':erUi.api?.zoomIn();break;
  case 'er-zoom-out':erUi.api?.zoomOut();break;
  case 'er-undo':designHistory('undo');break;
  case 'er-redo':designHistory('redo');break;
  case 'er-preview':showModal('copy',{title:'Declared semantic layer — data-only generator input',text:JSON.stringify(semanticGeneration(design()),null,2),filename:'semantic-layer.json'});break;
  case 'er-note':{const e=m.entities.find(e=>e.id===(value||erUi.selected));if(e)showModal('copy',{title:'Frontmatter example · illustrative values, no vault write',text:semanticNote(e,m),filename:e.slug+'-example.md'});break;}
  default:return false;
 }return true;
}
function editSemanticField(el){
 const key=el.dataset.field;if(!key?.startsWith('er-'))return false;
 if(key==='er-query'){erUi.query=el.value;const root=document.getElementById('er-catalog');if(root)root.innerHTML=erCatalog();return true;}
 if(key==='er-snap'||key==='er-guidelines'){semanticModel().canvas[key==='er-snap'?'snap':'guides']=el.checked;save();return true;}
 const f=erUi.form;if(!f)return true;const previousName=f.name,previousSlug=f.slug;
 erUi.error='';const error=document.getElementById('er-form-error');if(error)error.textContent='';
 if(key.startsWith('er-prop-')){const p=f.properties[Number(el.dataset.index)];if(p){const field=key.slice(8);p[field]=el.type==='checkbox'?el.checked:el.value;if(field==='type'||field==='hasDefault')redrawModal();}return true;}
 const name=key.slice(3);if(['name','slug','folder','description','section','source','target','key','sourceCard','targetCard','x','y','reference'].includes(name))f[name]=el.value;
 if(name==='name'&&f.formKind==='entity'&&!f.editing){if(f.slug===semanticName(previousName))f.slug=semanticName(f.name);if(f.folder==='Records/'+semanticPascal(previousSlug))f.folder='Records/'+semanticPascal(f.slug);for(const k of ['slug','folder']){const control=document.getElementById('er-'+k);if(control)control.value=f[k];}}
 if(name==='sourceCard'||name==='targetCard'||name==='source'||name==='target'||name==='reference')redrawModal();return true;
}

function seedSemanticExample(m){
 if(m.entities.length)throw Error('Example data is only available in an empty semantic model.');
 const work={id:semanticId(m,'section'),name:'Delivery'},people={id:semanticId(m,'section'),name:'People'};m.sections.push(work,people);
 const make=(name,section,fields)=>{const e={id:semanticId(m,'entity'),name,slug:semanticName(name),folder:'Records/'+name,description:'Example '+name.toLowerCase()+' record.',section,properties:fields.map(([key,type,required,defaultValue])=>({id:semanticId(m,'property'),key,type,required,...(defaultValue!==undefined?{defaultValue}:{})}))};m.entities.push(e);return e;};
 const project=make('Project',work.id,[['title','text',true],['budget','number',false,0]]),task=make('Task',work.id,[['title','text',true],['completed','checkbox',true,false],['due','date',false],['tags','tags',false,[]]]),person=make('Person',people.id,[['name','text',true],['email','text',false]]);
 for(const [target,key,name] of [[project,'project','Belongs to'],[person,'assignee','Assigned to']])m.relationships.push({id:semanticId(m,'relationship'),name,source:task.id,target:target.id,key,sourceCard:'0..*',targetCard:'0..1',onDelete:'restrict'});
 semanticArrange(m);
}
