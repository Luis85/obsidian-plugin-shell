function libraryComponents(){
 const q=productUi.filter.trim().toLowerCase();
 const result=design().library.filter(c=>(libraryUi.includeDeprecated||c.status!=='deprecated')&&componentSearchText(c).includes(q)&&unifiedUi.tags.every(t=>(c.tags||[]).includes(t)));
 const key=c=>(c.contentSpec?.title||c.name).toLowerCase();
 return result.sort((a,b)=>unifiedUi.sort==='tag'?String(a.tags?.[0]||'~').localeCompare(String(b.tags?.[0]||'~'))||key(a).localeCompare(key(b)):unifiedUi.sort==='category'?a.category.localeCompare(b.category)||key(a).localeCompare(key(b)):unifiedUi.sort==='usage'?componentUses(b.id).length-componentUses(a.id).length||key(a).localeCompare(key(b)):unifiedUi.sort==='recent'?b.revision-a.revision||key(a).localeCompare(key(b)):key(a).localeCompare(key(b)));
}

function libraryFilters(){
 const tags=[...new Set(design().library.flatMap(c=>c.tags||[]))].sort();
 return `<div class="library-filterbar unified-filterbar"><div class="component-tags" aria-label="Filter by tags">${['website','application','navigation','dashboard','form'].filter(t=>tags.includes(t)).map(t=>`<button data-action="unified-tag" data-value="${t}" aria-pressed="${unifiedUi.tags.includes(t)}">${t}</button>`).join('')}${unifiedUi.tags.filter(t=>!['website','application','navigation','dashboard','form'].includes(t)).map(t=>`<button data-action="unified-tag" data-value="${esc(t)}" aria-pressed="true">${esc(t)} ×</button>`).join('')}</div><label class="unified-tag-select">Tag<select aria-label="Add tag filter" data-field="unified-tag-select"><option value="">Choose tag…</option>${tags.filter(t=>!unifiedUi.tags.includes(t)).map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><label class="unified-sort">Sort<select data-field="unified-sort" aria-label="Sort components">${[['name','Name A–Z'],['category','Category'],['tag','Tag A–Z'],['usage','Most used'],['recent','Revision (newest)']].map(([v,l])=>`<option value="${v}" ${unifiedUi.sort===v?'selected':''}>${l}</option>`).join('')}</select></label><span class="small muted" role="status">${libraryComponents().length} / ${design().library.length}</span>${button('Clear filters','unified-clear','','ghost small')}<button class="btn ghost small" data-action="library-deprecated" aria-pressed="${libraryUi.includeDeprecated}">${libraryUi.includeDeprecated?'Hide':'Show'} deprecated</button>${libraryUi.returnNode?button('Back to screen','library-return','','ghost small','arrow'):''}</div>`;
}

function brickDefinitionPreview(c){
 const s=c.contentSpec;return `<div class="library-brick-preview" data-group="${BRICK_KINDS[s.kind].group}"><div class="library-preview-context"><span>${icon('layers')} Content component</span><span>v${esc(c.version)}</span></div><div class="library-preview-block"><strong>${esc(s.title)}</strong>${brickSketch(s.kind)}<small>${esc(BRICK_KINDS[s.kind].label)} · ${esc(s.region)}</small></div><p>${esc(s.purpose||c.description)}</p></div>`;
}
function libraryDefaultsEditor(c){
 if(!isBrickComponent(c))return '';
 const s=c.contentSpec;
 const input=(label,key,value,multi=false)=>`<label class="field" for="library-spec-${key}">${label}${multi?`<textarea id="library-spec-${key}" data-field="library-spec-${key}" rows="3" maxlength="${key==='content'?4000:800}">${esc(value)}</textarea>`:`<input id="library-spec-${key}" data-field="library-spec-${key}" value="${esc(value)}" maxlength="${key==='region'?40:100}">`}</label>`;
 return `<section class="library-defaults-editor"><h3>Content defaults</h3><p>These defaults are offered to new screen instances. Existing instances keep their version until reviewed.</p><div class="grid2"><label class="field" for="library-spec-kind">Wireframe shape<select id="library-spec-kind" data-field="library-spec-kind">${Object.entries(BRICK_KINDS).map(([id,spec])=>`<option value="${id}" ${s.kind===id?'selected':''}>${esc(spec.label)}</option>`).join('')}</select></label>${input('Default layout region','region',s.region)}</div>${input('Default block name','title',s.title)}${input('Default user purpose','purpose',s.purpose,true)}${input('Default content / behavior notes','content',s.content,true)}<p class="small muted">The wireframe describes the design, not compiled Vue behavior. Local screen content is preserved on upgrades.</p></section>`;
}
function libraryPlacementDialog(){
 const f=libraryUi.form,c=design().library.find(c=>c.id===f?.component);
 if(!c)return dialogBody('Component unavailable','Reopen the library.');
 return dialogBody('Place '+c.name,`<p>Create a versioned content instance. This does not copy the shared definition.</p><label class="field" for="library-place-node">Screen<select id="library-place-node" data-field="library-place-node">${design().nodes.filter(canHaveBricks).map(n=>`<option value="${n.id}" ${n.id===f.node?'selected':''}>${esc(n.label)}</option>`).join('')}</select></label>${variantSelect(c,f.variant||'default','library-place-variant')}${brickDefinitionPreview(variantComponent(c,f.variant||'default'))}`,button('Cancel','close','','ghost')+button('Configure instance','library-place-confirm','','primary','arrow'));
}
function libraryUpgradeDialog(){
 const f=libraryUi.form,{n,b}=findBrick((f?.node||'')+':'+(f?.id||'')),c=design().library.find(c=>c.id===b?.definition);
 if(!b||!c)return dialogBody('Instance unavailable','Return to the screen.');
 const {changes}=upgradedBrick(b,c);
 return dialogBody('Review content component upgrade',`<p><strong>${esc(c.name)}</strong> in ${esc(n.label)}: v${esc(b.version)} → v${esc(c.version)}</p><div class="library-upgrade-fields">${changes.map(x=>`<section><strong>${esc(x.field)}</strong>${badge(x.local?'Keep local override':x.before===x.after?'Unchanged':'Use new default',x.local?'purple':'')}<p>${esc(x.after||'Empty')}</p></section>`).join('')}</div><p>Only this instance is upgraded. Its ID, order, requirement links and implementation binding are preserved.</p><p class="error" role="alert">${esc(libraryUi.error)}</p>`,button('Cancel','close','','ghost')+button('Accept reviewed upgrade','library-upgrade-save','','primary'));
}
function libraryCardToolbar(n){return "";}
function libraryCardAddDialog(){
 const id=modalData||libraryUi.returnNode,n=design().nodes.find(n=>n.id===id);
 if(!n)return dialogBody('Select a card','Select a surface first.');
 return dialogBody('Add to '+n.label,`<div class="card-add-choices">${canHaveBricks(n)?`<button data-action="brick-add" data-value="${n.id}">${icon('box')}<span><strong>Component</strong><small>Choose any component from your library.</small></span>${icon('arrow')}</button>`:''}${n.kind!=='group'?`<button data-action="connection-card-add" data-value="${n.id}">${icon('link')}<span><strong>Connected card</strong><small>Create the next screen and describe the interaction.</small></span>${icon('arrow')}</button>`:''}${['view','page','group'].includes(n.kind)?`<button data-action="canvas-child" data-value="${n.id}">${icon('layers')}<span><strong>Screen inside</strong><small>Add a child to this container, not a navigation link.</small></span>${icon('arrow')}</button>`:''}</div>`,button('Close','close','','ghost'));
}
