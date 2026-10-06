// Structured bindings use the existing guarded Save / Undo / Redo transaction.
function sgFrontendView(s){
 const output=compileDesignSystem(s,project().id),m=output.manifest;
 return `<div class="row between wrap"><h2>Nuxt UI styling</h2>${button('Edit style bindings','sg-edit','frontend','primary small','settings')}</div><p>Export a stylesheet now, or export the full project JSON and let the shell generator include it in the plugin build.</p><div class="sg-hint"><strong>${m.colorPolicy==='host'?'Respect host colors':'Use declared light / dark colors'}</strong><p>${m.colorPolicy==='host'?'A color’s host variable wins when available; its declared palette is the fallback.':'Saved hex values define the palette. Obsidian still determines whether the owned root is light or dark.'}</p><code>${esc(m.scope)}</code><p>Only matching plugin roots are styled. Views, modals and owned portals must carry both ownership markers. This workbench and sibling plugins are unchanged.</p></div>${['colors','fonts','typography','spacing','sizes','radii'].map(group=>`<details class="sg-style-bindings" ${group==='colors'?'open':''}><summary>${SG_GROUPS[group]} bindings</summary><dl>${Object.entries(m.bindings).filter(([,v])=>v.group===group).map(([role,v])=>`<div><dt>${esc(DESIGN_SYSTEM_ROLES[role].label)}</dt><dd><code>${esc(v.token??'Framework default')}</code> <small>${esc(v.origin)}</small></dd></div>`).join('')}</dl></details>`).join('')}<details><summary>Generated stylesheet · ${output.css.length.toLocaleString()} characters</summary><pre class="sg-css-preview"><code>${esc(output.css)}</code></pre></details><p class="small muted">Unbound tokens still generate scoped variables and helper classes. Usage guidelines are documentation, not executable styling. Local font availability and actual contrast require runtime review.</p>`;
}
function sgFrontendForm(){
 const f=sgUi.form,s=styleGuide();
 const groups=['colors','fonts','typography','spacing','sizes','radii'];
 const body=`<p>Choose existing tokens for Nuxt UI and shell roles. Automatic uses the documented conventional IDs; Keep framework default explicitly leaves a role unbound.</p>${sgSelect('Color policy','colorPolicy',f.record.colorPolicy,[['host','Respect host variables, with declared fallbacks'],['declared','Use my declared light / dark palette']])}${groups.map(group=>`<details class="sg-style-bindings" ${group==='colors'?'open':''}><summary>${SG_GROUPS[group]}</summary><div class="sg-binding-grid">${Object.entries(DESIGN_SYSTEM_ROLES).filter(([,d])=>d.group===group).map(([role,d])=>sgSelect(d.label,'binding-'+role,Object.hasOwn(f.record.bindings,role)?f.record.bindings[role]??'@inherit':'@auto',[['@auto','Automatic: '+d.defaults.join(' / ')],['@inherit','Keep framework default'],...s[group].map(t=>[t.id,t.name+' · '+t.id])])).join('')}</div></details>`).join('')}<p class="small muted">Control radius is exact for controls; Nuxt UI’s other radii retain their relative scale. Sizes are responsive preferences. Remote CSS, selectors and fonts cannot be entered here.</p><p id="sg-error" class="error" role="alert" tabindex="-1">${esc(sgUi.error)}</p>`;
 return dialogBody('Nuxt UI style bindings',body,button('Cancel','close','','ghost')+button('Save style bindings','sg-save','','primary'));
}
function sgEditFrontendField(el){
 const f=sgUi.form,key=el.dataset.field;
 if(f?.group!=='frontend'||!key?.startsWith('sg-'))return false;
 if(key==='sg-colorPolicy')f.record.colorPolicy=el.value;
 else if(key.startsWith('sg-binding-')){
  const role=key.slice('sg-binding-'.length);if(!Object.hasOwn(DESIGN_SYSTEM_ROLES,role))return true;
  if(el.value==='@auto')delete f.record.bindings[role];else f.record.bindings[role]=el.value==='@inherit'?null:el.value;
 }
 return true;
}
