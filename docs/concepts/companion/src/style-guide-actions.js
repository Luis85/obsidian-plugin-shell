const sgUi={section:'overview',form:null,error:''};
function sgIdentity(){return JSON.stringify({owner:designOwner(),system:styleGuide()||null});}
function sgFail(message){sgUi.error=message;if(document.getElementById('modal').open&&modalType==='style-guide-form'){redrawModal();sgPaintDraft();document.getElementById('sg-error')?.focus();}else{render();document.getElementById('sg-page-error')?.focus();}return false;}
function sgCommit(candidate){
 if(state.activeRun)return sgFail('Finish the active project simulation before changing design declarations.');
 const errors=sgIssues(candidate);if(errors.length)return sgFail(errors[0]);
 if(JSON.stringify(styleGuide())===JSON.stringify(candidate))return true;
 recordDesign();design().designSystem=designCopy(candidate);designChanged();return true;
}
function sgOpen(group,id=null){
 const s=styleGuide();if(!s||group!=='overview'&&!Object.hasOwn(SG_GROUPS,group))return sgFail('Create a design system first.');
 if(state.activeRun)return sgFail('Finish the active project simulation first.');
 if(group==='typography'&&!s.fonts.length)return sgFail('Declare a font before a typography style.');
 const saved=id?s[group].find(r=>r.id===id):null;if(id&&!saved)return sgFail('That declaration no longer exists. Reopen its current version.');
 sgUi.form={group,id,record:designCopy(group==='overview'?{name:s.name,description:s.description,principles:s.principles}:saved||sgNew(group,s)),snapshot:sgIdentity(),owner:designOwner(),removal:false};sgUi.error='';showModal('style-guide-form');sgPaintDraft();
}
function sgCurrent(){return sgUi.form&&sgUi.form.snapshot===sgIdentity()&&sgUi.form.owner===designOwner();}
function sgSave(){
 const f=sgUi.form;if(!sgCurrent())return sgFail('The saved design system changed while this draft was open. Your draft is retained; reopen a current declaration before applying.');
 const s=designCopy(styleGuide());if(f.group==='overview')Object.assign(s,f.record);else{const i=s[f.group].findIndex(r=>r.id===f.id);if(i<0)s[f.group].push(designCopy(f.record));else s[f.group][i]=designCopy(f.record);}
 if(!sgCommit(s))return false;modalOriginal=null;closeModal();sgUi.error='';render();notify('Design declaration saved. The host theme is unchanged.');return true;
}
function sgRemove(){
 const f=sgUi.form;if(!f?.id||!sgCurrent())return sgFail('This removal review is stale. Saved declarations were not changed.');
 const s=designCopy(styleGuide());if(f.group==='fonts'&&s.typography.some(t=>t.font===f.id))return sgFail('This font is used by typography styles. Change those styles before removing the font.');
 s[f.group]=s[f.group].filter(r=>r.id!==f.id);if(!sgCommit(s))return false;modalOriginal=null;closeModal();sgUi.error='';render();notify('Design declaration removed. Undo restores the saved version; exports were not deleted.');return true;
}
function handleStyleGuideAction(action,value=''){
 if(!action.startsWith('sg-'))return false;
 if(!project()){openVaultIdentity('designsystem');return true;}
 switch(action){
  case 'sg-section':if(value==='overview'||Object.hasOwn(SG_GROUPS,value)){sgUi.section=value;sgUi.error='';render();}break;
  case 'sg-starter':case 'sg-empty':if(styleGuide()){sgFail('A design system already exists. Edit its declarations instead of replacing it.');break;}if(sgCommit(action==='sg-starter'?sgStarter():sgBlank())){sgUi.error='';sgUi.section='overview';render();}break;
  case 'sg-add':sgOpen(value);break;
  case 'sg-edit':{const [group,id]=value.split(':');sgOpen(group,id||null);break;}
  case 'sg-save':sgSave();break;
  case 'sg-remove':if(sgUi.form?.id){sgUi.form.removal=true;redrawModal();document.querySelector('[data-action="sg-keep"]')?.focus();}break;
  case 'sg-keep':if(sgUi.form){sgUi.form.removal=false;redrawModal();sgPaintDraft();}break;
  case 'sg-confirm-remove':sgRemove();break;
  case 'sg-export':if(['md','html'].includes(value))sgDownload(value);break;
 }
 return true;
}
function editStyleGuideField(el){
 const key=el.dataset.field;if(!key?.startsWith('sg-'))return false;const f=sgUi.form,name=key.slice(3);if(!f||!Object.hasOwn(f.record,name)||name==='id'&&f.id)return true;
 f.record[name]=['size','weight','lineHeight','letterSpacing','value'].includes(name)?(el.value===''?null:Number(el.value)):el.value;sgPaintDraft();return true;
}
