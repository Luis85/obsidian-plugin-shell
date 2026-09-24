// In-modal removal is a second review of the original identity, not an implicit
// save of edited fields. Keep editing/Escape restores the exact pending draft.
function inlineRemovalForm(){
 return modalType==='semantic-form'?erUi.form:modalType==='data-source-form'?dsUi.form:null;
}
function requestInlineRemoval(kind,id){
 const f=inlineRemovalForm();
 if(!document.getElementById('modal').open||!f||f.id!==id||!id)return false;
 const allowed=modalType==='semantic-form'?{relationship:'remove-relationship'}:{flow:'remove-flow',operation:'remove-operation',source:'remove-source'};
 if(allowed[f.formKind]!==kind)return false;
 f.removeRequested=kind;redrawModal();
 document.querySelector('#modal [data-action="editor-keep-editing"]')?.focus();return true;
}
function restoreInlineRemoval(){
 const f=inlineRemovalForm();if(!f?.removeRequested)return false;
 delete f.removeRequested;redrawModal();return true;
}
function inlineRemovalDialog(f){
 const entity=modalType==='semantic-form';
 const name=entity?semanticModel().relationships.find(r=>r.id===f.id)?.name:f.formKind==='flow'?dataSources().flows.find(x=>x.id===f.id)?.label:f.name;
 const detail=entity?'The relationship and its generated field declaration are removed from the design. Both entities, existing notes and previously generated files are kept.':'Only this declaration is removed. Existing notes, remote data and previously generated files are kept. Used sources and operations remain protected.';
 const error=entity?erUi.error:dsUi.error;
 return dialogBody('Remove '+(name||'declaration')+'?',`<p>${esc(detail)}</p><p>Unsaved field edits are not applied by deletion. Keep editing returns to the exact draft. Undo restores the saved declaration.</p><div class="error" role="alert" id="${entity?'er-form-error':'ds-error'}" tabindex="-1">${esc(error)}</div>`,button('Keep editing','editor-keep-editing','','ghost')+button('Remove declaration',entity?'er-save':'ds-save','','danger','trash'));
}

// Ignore untouched mode caches, but retain edited fields in hidden shape modes.
// A mode round-trip alone is not an edit; cached user input still needs protection.
function editorDraftCheckpoint(form){
 if(!form)return 'null';
 const value=Object.fromEntries(Object.entries(form).filter(([key])=>!['snapshot','owner','revision','token','removeRequested','shapeBaselines','shapeDrafts'].includes(key)));
 const hidden={};
 for(const side of ['input','output'])for(const [mode,shape] of Object.entries(form.shapeDrafts?.[side]||{})){
  if(mode!==form[side]?.mode&&JSON.stringify(shape)!==JSON.stringify(form.shapeBaselines?.[side]?.[mode]))hidden[side+':'+mode]=shape;
 }
 if(Object.keys(hidden).length)value.hiddenShapeEdits=hidden;
 return JSON.stringify(value);
}
