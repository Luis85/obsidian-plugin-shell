// A page content draft commits as one reviewed, undoable edit; no source writes.
function openReferenceContent(value){
 const [id,brickId]=value.split(':'),d=design(),n=d.nodes.find(n=>n.id===id);
 if(!canHaveBricks(n)||state.activeRun){notify('Choose a visual surface after the active operation finishes.');return;}
 const bricks=designCopy(bricksOf(n));
 referenceUi.content={owner:designOwner(),revision:d.revision,node:id,label:n.label,bricks,original:JSON.stringify(bricks),selected:brickId||bricks[0]?.id||null,next:1,removed:null};
 referenceUi.contentError='';referenceUi.editorTab='content';referenceUi.libraryQuery='';showModal('ref-content');
}
function referenceContentDirty(){const f=referenceUi.content;return !!f&&f.original!==JSON.stringify(f.bricks);}
function referenceDraftBlock(id){return referenceUi.content?.bricks.find(b=>b.id===id);}
function referenceFocusBlock(id){
 const f=referenceUi.content;if(!referenceDraftBlock(id))return;
 f.selected=id;
 document.querySelectorAll('.ref-write-block').forEach(e=>e.classList.toggle('active',e.dataset.block===id));
 document.querySelectorAll('.ref-mini-block').forEach(e=>e.classList.toggle('active',e.dataset.block===id));
 const block=document.querySelector('.ref-write-block[data-block="'+CSS.escape(id)+'"]');
 block?.scrollIntoView({block:'nearest',behavior:'instant'});
 block?.querySelector('textarea')?.focus({preventScroll:true});
}
function referenceContentMini(){
 const f=referenceUi.content;if(!f)return '';
 return `<div class="ref-mini-page"><div class="ref-mini-title"><span>•••</span><strong>${esc(f.label)}</strong></div>${f.bricks.map(b=>`<button class="ref-mini-block ${f.selected===b.id?'active':''}" data-group="${BRICK_KINDS[b.kind].group}" data-action="ref-block-focus" data-value="${b.id}" data-block="${b.id}" title="Focus ${esc(b.title)}" aria-label="Focus ${esc(b.title)}"><strong>${esc(b.title)}</strong>${referenceSketch(b.kind)}</button>`).join('')||'<p class="ref-mini-empty">Your content outline will appear here.</p>'}</div><p class="ref-preview-note">Outline preview · not a live Vue screen</p>`;
}
function referenceWriteBlock(b,index){
 const spec=BRICK_KINDS[b.kind],n=design().nodes.find(n=>n.id===referenceUi.content.node);
 return `<section class="ref-write-block ${referenceUi.content.selected===b.id?'active':''}" data-block="${b.id}" data-group="${spec.group}">
 <div class="ref-block-heading"><button class="ref-write-grip" draggable="true" data-ref-drag="${b.id}" title="Drag to reorder this draft" aria-label="Reorder ${esc(b.title)}">${icon('menu')}</button>
 <label class="sr-only" for="ref-title-${b.id}">Block name</label><input id="ref-title-${b.id}" data-field="ref-block-title" data-block="${b.id}" value="${esc(b.title)}" maxlength="${BRICK_LIMITS.title}">
 <span class="ref-block-counter">${index+1}</span>${referenceTool('Move earlier','ref-block-up',b.id,'up',index===0?'disabled':'')}${referenceTool('Move later','ref-block-down',b.id,'down',index===referenceUi.content.bricks.length-1?'disabled':'')}${referenceTool('Remove from draft','ref-block-remove',b.id,'trash')}</div>
 <div class="ref-format-toolbar" role="toolbar" aria-label="Markdown formatting for ${esc(b.title)}">${[['heading','Heading'],['bold','Bold'],['italic','Italic'],['list','Bulleted list'],['check','Checklist'],['code','Code'],['link','Link']].map(([key,label])=>`<button type="button" data-action="ref-format" data-value="${b.id}:${key}" title="${label}" aria-label="${label}">${{heading:'H2',bold:'B',italic:'I',list:'• List',check:'☐',code:'&lt;/&gt;',link:'Link'}[key]}</button>`).join('')}<span id="ref-count-${b.id}" class="ref-character-count">${b.content.length.toLocaleString()} / ${BRICK_LIMITS.content.toLocaleString()}</span></div>
 <label class="sr-only" for="ref-body-${b.id}">Content for ${esc(b.title)}</label><textarea id="ref-body-${b.id}" data-field="ref-block-content" data-block="${b.id}" maxlength="${BRICK_LIMITS.content}" ${referenceUi.content.selected===b.id?'autofocus':''} rows="4" placeholder="Describe the content, behavior and states…">${esc(b.content)}</textarea>
 <details class="ref-block-details"><summary>${esc(spec.label)} <span>· ${esc(b.region)} · Purpose & region</span></summary>
 <label>What does this component help the user do?<textarea data-field="ref-block-purpose" data-block="${b.id}" rows="2" maxlength="${BRICK_LIMITS.purpose}">${esc(b.purpose)}</textarea></label>
 <label>Layout region<select data-field="ref-block-region" data-block="${b.id}">${componentSlots(n).map(slot=>`<option ${b.region===slot?'selected':''}>${esc(slot)}</option>`).join('')}</select></label>
 <p>Screen-specific content. The shared library definition and implementation binding are unchanged.</p></details></section>`;
}
function referenceEditorLibrary(){
 const q=referenceUi.libraryQuery.toLowerCase();
 return `<div class="ref-editor-library"><div class="ref-panel-heading"><strong>Add a component</strong>${referenceTool('Back to preview','ref-editor-preview','','close')}</div><label class="field">Find in library<input id="ref-library-search" type="search" data-field="ref-library-search" value="${esc(referenceUi.libraryQuery)}" placeholder="Search components…"></label>
 <div id="ref-library-list">${referenceLibraryItems(q)}</div></div>`;
}
function referenceLibraryItems(q=''){
 return design().library.filter(c=>isBrickComponent(c)&&c.status!=='deprecated'&&componentSearchText(c).includes(q)).map(c=>`<button class="ref-library-item" data-action="ref-block-add" data-value="${c.id}" data-group="${BRICK_KINDS[c.contentSpec.kind].group}"><span>${referenceSketch(c.contentSpec.kind)}</span><strong>${esc(c.contentSpec.title)}<small>${esc(c.name)} · v${esc(c.version)}</small></strong>${icon('plus')}</button>`).join('')||'<p>No matching components.</p>';
}
function referenceContentDialog(){
 const f=referenceUi.content,n=design().nodes.find(n=>n.id===f?.node);
 if(!f||!n)return dialogBody('Surface unavailable','Close and reopen a surface.');
 return `<div class="ref-editor"><header class="ref-editor-heading"><div>${referenceIcon('content')}<div><h2 id="modal-title">${esc(n.label)}</h2><p>Content outline · ${esc(NODE_KINDS[n.kind])} · ${esc(n.slug)}</p></div></div>${referenceTool('Close content editor','close','','close')}</header>
 <div class="ref-editor-layout"><div class="ref-write-column"><div class="ref-editor-intro"><p>${esc(n.intent||'Describe what belongs on this screen, then refine each component.')}</p><span>Changes stay in this draft until you save.</span></div>
 <div id="ref-draft-recovery" class="ref-draft-recovery" ${f.removed?'':'hidden'}>${f.removed?`<span>${esc(f.removed.block.title)} removed from this draft.</span>${button('Undo remove','ref-block-restore','','small')}`:''}</div>
 <div id="ref-write-blocks">${referenceBlockList()}</div>
 <button class="ref-add-block" data-action="ref-editor-library">${icon('plus')} Add component</button>
 <p id="ref-content-error" role="alert" tabindex="-1" class="error">${esc(referenceUi.contentError)}</p></div>
 <aside class="ref-editor-preview">${referenceUi.editorTab==='library'?referenceEditorLibrary():`<div class="ref-panel-heading"><strong>Page preview</strong><span id="ref-draft-count">${f.bricks.length} components</span></div><div id="ref-content-mini">${referenceContentMini()}</div>`}</aside></div>
 <footer class="ref-editor-footer"><span id="ref-content-state" role="status">${referenceContentDirty()?'Unsaved changes':'No changes yet'}</span><div>${button('Export draft','ref-draft-export','','ghost')}${button('Cancel','close','','ghost')}${button('Save content','ref-content-save','','primary','',''+(!referenceContentDirty()?'disabled':''))}</div></footer></div>`;
}
function refreshReferenceContent(){
 const mini=document.getElementById('ref-content-mini');if(mini)mini.innerHTML=referenceContentMini();
 const state=document.getElementById('ref-content-state');if(state)state.textContent=referenceContentDirty()?'Unsaved changes':'No changes yet';
 const save=document.querySelector('[data-action="ref-content-save"]');if(save)save.disabled=!referenceContentDirty();
 const count=document.getElementById('ref-draft-count');if(count)count.textContent=referenceUi.content.bricks.length+' components';
 const err=document.getElementById('ref-content-error');if(err)err.textContent=referenceUi.contentError;
 for(const b of referenceUi.content.bricks){const count=document.getElementById('ref-count-'+b.id);if(count)count.textContent=b.content.length.toLocaleString()+' / '+BRICK_LIMITS.content.toLocaleString();const input=document.getElementById('ref-title-'+b.id);if(input&&b.title.trim()){input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}}
 const recovery=document.getElementById('ref-draft-recovery'),removed=referenceUi.content.removed;
 if(recovery){recovery.hidden=!removed;recovery.innerHTML=removed?`<span>${esc(removed.block.title)} removed from this draft.</span>${button('Undo remove','ref-block-restore','','small')}`:'';}
}
function refreshReferenceBlocks(){
 const blocks=document.getElementById('ref-write-blocks');if(blocks)blocks.innerHTML=referenceBlockList();
 refreshReferenceContent();
}
function moveReferenceBlock(id,delta,targetId=null,after=false){
 const f=referenceUi.content,from=f?.bricks.findIndex(b=>b.id===id);
 if(from===undefined||from<0)return;
 let to=targetId?f.bricks.findIndex(b=>b.id===targetId):from+delta;
 if(targetId){if(to<0||targetId===id)return;to+=after?1:0;if(from<to)to--;}
 if(to<0||to>=f.bricks.length||from===to)return;
 f.bricks.splice(to,0,f.bricks.splice(from,1)[0]);f.selected=id;refreshReferenceBlocks();
 document.querySelector('[data-ref-drag="'+CSS.escape(id)+'"]')?.focus();
}
function addReferenceBlock(definition){
 const f=referenceUi.content,d=design(),c=d.library.find(c=>c.id===definition),n=d.nodes.find(n=>n.id===f?.node);
 if(!f||!n||!isBrickComponent(c)||c.status==='deprecated')return;
 if(f.bricks.length>=BRICK_LIMITS.perSurface){referenceUi.contentError='This screen supports up to 24 content components.';refreshReferenceContent();return;}
 const b=attachBrickDefinition({schema:1,id:'draft-'+f.next++,kind:c.contentSpec.kind,title:c.contentSpec.title,purpose:c.contentSpec.purpose,content:c.contentSpec.content,region:componentSlots(n).includes(c.contentSpec.region)?c.contentSpec.region:componentSlots(n)[0],component:null},c);
 f.bricks.push(b);f.selected=b.id;refreshReferenceBlocks();referenceFocusBlock(b.id);
}
function formatReferenceText(value){
 const [id,format]=value.split(':'),el=document.getElementById('ref-body-'+id),b=referenceDraftBlock(id);
 if(!el||!b)return;
 const begin=el.selectionStart,end=el.selectionEnd,selected=el.value.slice(begin,end)||'text';
 const replacement={heading:'## '+selected,bold:'**'+selected+'**',italic:'_'+selected+'_',list:selected.split('\n').map(s=>'- '+s).join('\n'),check:selected.split('\n').map(s=>'- [ ] '+s).join('\n'),code:'`'+selected+'`',link:'['+selected+'](https://example.com)'}[format];
 if(!replacement)return;
 if(el.value.length-(end-begin)+replacement.length>BRICK_LIMITS.content){referenceUi.contentError='Formatting would exceed the content limit. Shorten the text first; nothing was changed.';refreshReferenceContent();el.focus();return;}
 el.setRangeText(replacement,begin,end,'select');b.content=el.value;el.focus();refreshReferenceContent();
}
function saveReferenceContent(){
 const f=referenceUi.content,d=design(),n=d.nodes.find(n=>n.id===f?.node);
 const fail=(m,field=null)=>{referenceUi.contentError=m;refreshReferenceContent();const target=field||document.getElementById('ref-content-error');if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','ref-content-error');}target?.focus();target?.scrollIntoView({block:'nearest'});};
 if(!n||f.owner!==designOwner()||f.revision!==d.revision)return fail('This screen changed outside your draft. Copy your text, cancel, and reopen before saving.');
 if(state.activeRun)return fail('Finish the active operation before saving.');
 if(!referenceContentDirty()){modalOriginal=null;closeModal();return;}
 const invalid=f.bricks.find(b=>!b.title.trim());
 if(invalid)return fail('Give each component a name before saving. Your draft is retained.',document.getElementById('ref-title-'+invalid.id));
 let next=d.nextId;
 const used=new Set(d.nodes.flatMap(n=>bricksOf(n).map(b=>b.id)));
 const bricks=designCopy(f.bricks).map(b=>{
  if(b.id.startsWith('draft-')){while(used.has('brick-'+next))next++;b.id='brick-'+next++;used.add(b.id);}
  b.title=b.title.trim();return b;
 });
 const updated={...n,bricks};
 if(!validBricks(updated))return fail('Every component needs a name. Check the field length limits before saving.');
 const candidate={...d,nodes:d.nodes.map(v=>v.id===n.id?updated:v)};
 const oldIssues=new Set(brickIssues(d).map(i=>i.code+':'+i.message));
 const introduced=brickIssues(candidate).find(i=>!oldIssues.has(i.code+':'+i.message));
 if(introduced)return fail(introduced.message);
 recordDesign();n.bricks=bricks;d.nextId=next;designChanged();selectSitemapItem('surface',n.id);
 modalOriginal=null;closeModal();render();canvasAnnounce('Page content saved. One undo restores the previous outline.');
}

function referenceBlockList(){
 const items=referenceUi.content?.bricks||[];
 return items.map(referenceWriteBlock).join('')||'<div class="ref-empty-content"><h3>Start with the content.</h3><p>Choose a reusable component. Describe its purpose and what the user will see.</p></div>';
}
function removeReferenceBlock(id){
 const f=referenceUi.content,index=f?.bricks.findIndex(b=>b.id===id);
 if(index===undefined||index<0)return;
 f.removed={block:designCopy(f.bricks[index]),index};f.bricks.splice(index,1);
 f.selected=f.bricks[Math.min(index,f.bricks.length-1)]?.id||null;
 refreshReferenceBlocks();document.querySelector('[data-action="ref-block-restore"]')?.focus();
}
function restoreReferenceBlock(){
 const f=referenceUi.content,removed=f?.removed;if(!removed)return;
 if(f.bricks.length>=BRICK_LIMITS.perSurface){referenceUi.contentError='Remove another draft component before restoring this one. The removed content is still retained.';refreshReferenceContent();return;}
 if(!f.bricks.some(b=>b.id===removed.block.id))f.bricks.splice(Math.min(removed.index,f.bricks.length),0,removed.block);
 f.selected=removed.block.id;f.removed=null;refreshReferenceBlocks();referenceFocusBlock(f.selected);
}
function exportReferenceDraft(){
 const f=referenceUi.content;if(!f)return;
 const data={schema:1,kind:'screen-content-draft',surface:f.node,label:f.label,sourceRevision:f.revision,blocks:f.bricks};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='screen-content-draft.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Draft copy exported. No source files or saved content were changed.');
}
