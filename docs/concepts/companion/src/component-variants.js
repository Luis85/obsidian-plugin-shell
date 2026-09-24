// Named, data-only variants belong to one definition, not independent component copies.
const variantUi={preview:'default',form:null,error:''};
function componentVariants(c){
 if(!c)return [];if(c.variantSpecs)return c.variantSpecs;
 const ids=[...new Set(['default',...String(c.variants||'').split(',').map(s=>semanticName(s.trim())).filter(s=>s!=='entity')])];
 return ids.slice(0,12).map(id=>({id,name:id[0].toUpperCase()+id.slice(1),description:'',props:{},contentOverrides:{}}));
}
function validVariantSpecs(c){
 if(c.variantSpecs===undefined)return true;
 const list=c.variantSpecs;if(!Array.isArray(list)||!list.length||list.length>12||new Set(list.map(v=>v?.id)).size!==list.length||!list.some(v=>v.id==='default'))return false;
 let props;try{props=parseMembers(c.props,'props');}catch{return false;}
 return list.every(v=>erKeys(v,['id','name','description','props','contentOverrides'])&&erText(v.id,40)&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v.id)&&erText(v.name,80)&&v.name.trim()&&erText(v.description,800)&&erPlain(v.props)&&Object.entries(v.props).every(([k,value])=>!['__proto__','constructor','prototype'].includes(k)&&props.some(p=>p.name===k&&p.type===typeof value)&&(typeof value!=='string'||value.length<=500)&&(typeof value!=='number'||Number.isFinite(value)))&&erKeys(v.contentOverrides,['title','purpose','content'])&&Object.entries(v.contentOverrides).every(([k,value])=>typeof value==='string'&&value.length<=({title:100,purpose:800,content:4000}[k]))&&(!Object.keys(v.contentOverrides).length||isBrickComponent(c)&&validContentSpec({...c.contentSpec,...v.contentOverrides})));
}
function validVariantProps(props){return erPlain(props)&&Object.keys(props).length<=16&&Object.entries(props).every(([k,v])=>/^[a-z][a-zA-Z0-9]*$/.test(k)&&!['constructor','prototype'].includes(k)&&(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=500));}
function variantFor(c,id='default'){return componentVariants(c).find(v=>v.id===id)||null;}
function variantComponent(c,id='default'){const v=variantFor(c,id);return {...c,...(c.contentSpec?{contentSpec:{...c.contentSpec,...(v?.contentOverrides||{})}}:{})};}
function variantSelect(c,id,key='variant-preview'){return `<label class="variant-select">Variant<select data-field="${key}" aria-label="Component variant">${componentVariants(c).map(v=>`<option value="${esc(v.id)}" ${v.id===id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>`;}
function variantPanel(c){return `<section class="variant-panel"><div class="section-head"><div><h3>Named variants</h3><p>One definition and contract. Variants carry typed prop defaults and optional content overrides.</p></div>${button('Add variant','variant-new',c.id,'primary small','plus',componentVariants(c).length>=12?'disabled':'')}</div>${componentVariants(c).map(v=>`<article class="variant-item"><div><strong>${esc(v.name)}</strong><code>${esc(v.id)}</code><p>${esc(v.description||'Uses the shared component contract.')}</p><small>${Object.keys(v.props).length} prop overrides · ${Object.keys(v.contentOverrides).length} content overrides · ${libraryBrickRefs(design(),c.id).filter(({brick})=>(brick.variant||'default')===v.id).length} placements</small></div><div class="row wrap">${button('Preview','variant-preview',c.id+':'+v.id,'small')}${button('Edit','variant-edit',c.id+':'+v.id,'small')}${v.id!=='default'?button('Remove','variant-remove',c.id+':'+v.id,'danger small'):badge('Fallback')}</div></article>`).join('')}<p class="small muted">Saving a variant requires a new component version. Existing instances keep their version and local overrides until a reviewed upgrade. In-use variants cannot be removed.</p></section>`;}
function variantOpen(component,id=null,remove=false){
 const c=design().library.find(c=>c.id===component);if(!c||state.activeRun)return;
 const v=id?variantFor(c,id):{id:'compact',name:'Compact',description:'',props:{},contentOverrides:{}};if(!v)return;
 const numbers=c.version.split('.').map(Number);numbers[2]++;
 variantUi.form={component,id:v.id,name:v.name,description:v.description,propsText:JSON.stringify(v.props,null,2),title:v.contentOverrides.title||'',purpose:v.contentOverrides.purpose||'',content:v.contentOverrides.content||'',titleOverride:Object.hasOwn(v.contentOverrides,'title'),purposeOverride:Object.hasOwn(v.contentOverrides,'purpose'),contentOverride:Object.hasOwn(v.contentOverrides,'content'),editing:!!id,remove,version:numbers.join('.'),owner:designOwner(),revision:design().revision,snapshot:JSON.stringify(c)};variantUi.error='';showModal('component-variant');
}
function variantDialog(){
 const f=variantUi.form,c=design().library.find(c=>c.id===f?.component);if(!c)return dialogBody('Component unavailable','Reopen the library.');
 const input=(label,key,value,multi=false)=>`<label class="field" for="v-${key}">${label}${multi?`<textarea id="v-${key}" data-field="variant-${key}" rows="3" maxlength="4000">${esc(value)}</textarea>`:`<input id="v-${key}" data-field="variant-${key}" value="${esc(value)}" maxlength="120" ${key==='id'&&f.editing?'readonly':''}>`}</label>`;
 const body=f.remove?`<p>Remove ${esc(f.name)} from ${esc(c.name)}? In-use variants are protected; change those instances first. The shared definition and other variants remain.</p>`:`<div class="grid2">${input('Variant name','name',f.name)}${input('Stable variant ID','id',f.id)}</div>${input('Purpose / when to use','description',f.description,true)}${input('Typed prop defaults (JSON object)','propsText',f.propsText,true)}<p class="small muted">Only declared props and their string, number or boolean types are accepted. No code, functions, styles or templates.</p>${isBrickComponent(c)?['title','purpose','content'].map(k=>`<div class="variant-override"><label class="check-label"><input type="checkbox" data-field="variant-${k}Override" ${f[k+'Override']?'checked':''}> Override ${k}</label>${f[k+'Override']?input('Variant '+k,k,f[k],k!=='title'):''}</div>`).join(''):''}`;
 return dialogBody(f.remove?'Remove variant':f.editing?'Edit variant':'Add variant',body+input('New component version','version',f.version)+`<p class="small muted">Current v${esc(c.version)}. Existing placements will need a reviewed upgrade; no silent propagation.</p><p class="error" id="variant-error" role="alert" tabindex="-1">${esc(variantUi.error)}</p>`,button('Cancel','close','','ghost')+button(f.remove?'Remove variant':'Save variant','variant-save','',f.remove?'danger':'primary','check'));
}
function variantSave(){
 const f=variantUi.form,d=design(),c=d.library.find(c=>c.id===f?.component);const fail=m=>{variantUi.error=m;redrawModal();document.getElementById('variant-error')?.focus();};
 if(!c||state.activeRun||f.owner!==designOwner()||f.revision!==d.revision||f.snapshot!==JSON.stringify(c))return fail('This component changed. Copy your edits and reopen the variant.');
 try{
  const list=designCopy(componentVariants(c)),v={id:f.id.trim(),name:f.name.trim(),description:f.description.trim(),props:JSON.parse(f.propsText),contentOverrides:{}};
  for(const k of ['title','purpose','content'])if(f[k+'Override'])v.contentOverrides[k]=f[k];
  const index=list.findIndex(v=>v.id===f.id);
  if(f.remove){if(f.id==='default')throw Error('The default variant is required.');if(componentUses(c.id).some(({brick,binding})=>(brick?.variant||binding.variant||'default')===f.id))throw Error('This variant is in use. Reassign its placements before removal.');list.splice(index,1);}
  else if(f.editing)list[index]=v;else{if(list.some(x=>x.id===v.id))throw Error('Use a unique variant ID.');list.push(v);}
  if(JSON.stringify(list)===JSON.stringify(componentVariants(c))){modalOriginal=null;closeModal();return;}
  const old=c.version.split('.').map(Number),version=f.version.split('.').map(Number);if(!/^\d+\.\d+\.\d+$/.test(f.version)||!version.every(Number.isSafeInteger)||version.findIndex((n,i)=>n!==old[i])<0||version[version.findIndex((n,i)=>n!==old[i])]<old[version.findIndex((n,i)=>n!==old[i])])throw Error('Choose a version greater than the current component version.');
  const candidate={...c,variantSpecs:list,variants:list.map(v=>v.id).join(', '),version:f.version,revision:c.revision+1,origin:'project'};if(!validVariantSpecs(candidate))throw Error('Check variant IDs, nonempty names, limits, content and declared prop names/types.');
  recordDesign();d.library[d.library.indexOf(c)]=candidate;designChanged();modalOriginal=null;closeModal();workflowUi.componentTab='variants';variantUi.preview=f.remove?'default':v.id;render();notify('Variant saved. Existing placements retain their version until reviewed.');
 }catch(error){fail(error.message);}
}
function handleVariantAction(action,value){
 if(!action.startsWith('variant-'))return false;
 if(action==='variant-save'){variantSave();return true;}
 const [component,id]=value.split(':');
 if(action==='variant-preview'){productUi.component=component;variantUi.preview=id;workflowUi.componentTab='preview';render();return true;}
 variantOpen(component,id,action==='variant-remove');return true;
}
function editVariantField(el){
 const key=el.dataset.field;if(key==='variant-preview'){variantUi.preview=el.value;render();return true;}
 if(key==='library-place-variant'){libraryUi.form.variant=el.value;redrawModal();return true;}
 if(key==='brick-variant'){
  const f=brickUi.form,c=design().library.find(c=>c.id===f?.definition);if(!c||!variantFor(c,el.value))return true;
  const next=variantComponent(c,el.value).contentSpec;
  for(const k of ['kind','title','purpose','content','region'])if(f[k]===f.defaults?.[k])f[k]=next[k];
  f.variant=el.value;f.variantProps=designCopy(variantFor(c,el.value).props);f.defaults=designCopy(next);f.version=c.version;redrawModal();return true;
 }
 if(!key?.startsWith('variant-')||!variantUi.form)return false;
 const field=key.slice(8);if(['id','name','description','propsText','title','purpose','content','version','titleOverride','purposeOverride','contentOverride'].includes(field))variantUi.form[field]=el.type==='checkbox'?el.checked:el.value;
 if(field.endsWith('Override'))redrawModal();return true;
}
