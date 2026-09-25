// Shared form and focus safeguards. No production persistence or runtime adapters.
let modalOriginal=null;
const TRACKED_FORMS=new Set(['storymap-form','project-import','project-folders','style-guide-form','test-data-form','data-source-form','semantic-form','component-variant','vault-identity','design-transfer','edge-detach','ref-content','ref-section','library-place','library-upgrade','brick-edit','brick-transfer','connection-create','connection-structure','flow-intent','flow-binding','design-node','design-connect','design-goal','product-prd','product-requirement','product-component','product-bind']);
function formCheckpoint(){
 if(modalType==='storymap-form')return JSON.stringify(smUi.form?.record||null);
 if(modalType==='project-import')return JSON.stringify(projectTransferUi.text);
 if(modalType==='style-guide-form')return JSON.stringify(sgUi.form?.record||null);
 if(modalType==='test-data-form')return JSON.stringify(tdUi.form?.record||null);
 if(modalType==='ref-content')return JSON.stringify(referenceUi.content?.bricks||[]);
 if(modalType==='semantic-form'||modalType==='data-source-form')return editorDraftCheckpoint(inlineRemovalForm());
 return JSON.stringify([...document.querySelectorAll('#modal input,#modal textarea,#modal select')].map((e,i)=>[e.dataset.field||e.id||String(i),e.type==='checkbox'?e.checked:e.value]));
}
function rememberModalForm(){modalOriginal=TRACKED_FORMS.has(modalType)?formCheckpoint():null;}
function askDiscardForm(){
 if(modalType==='storymap-form'&&smUi.form?.removal){smUi.form.removal=false;redrawModal();return true;}
 if(restoreInlineRemoval())return true;
 if(!modalOriginal||!TRACKED_FORMS.has(modalType)||formCheckpoint()===modalOriginal)return false;
 let dialog=document.getElementById('discard-dialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='discard-dialog';dialog.setAttribute('aria-labelledby','discard-title');document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});}
 dialog.innerHTML='<h2 id="discard-title">Keep your edits?</h2><p>You have unsaved changes in this form. Keep editing, or discard only these changes. Saved project data remains untouched.</p><div class="row"><button class="btn" id="discard-confirm">Discard changes</button><button class="btn primary" id="discard-keep">Keep editing</button></div>';
 const prior=document.activeElement;
 dialog.querySelector('#discard-keep').onclick=()=>{dialog.close();if(prior?.isConnected)prior.focus();};
 dialog.querySelector('#discard-confirm').onclick=()=>{dialog.close();modalOriginal=null;closeModal();};
 dialog.showModal();dialog.querySelector('#discard-keep').focus();return true;
}
// Stable identities survive a render; row/side attributes disambiguate repeated fields.
function uiFocusRecord(element, root = document) {
  if (!element || element === document.body) return null;
  const keys = ['action', 'value', 'field', 'node', 'edge', 'index', 'side', 'row', 'key'];
  const data = Object.fromEntries(keys.filter(key => element.dataset[key] !== undefined)
    .map(key => [key, element.dataset[key]]));
  const token = {
    id: element.id, ...data, data, tag: element.tagName,
    label: element.getAttribute('aria-label'), ordinal: 0,
    selectionStart: typeof element.selectionStart === 'number' ? element.selectionStart : null,
    selectionEnd: typeof element.selectionEnd === 'number' ? element.selectionEnd : null,
  };
  token.ordinal = uiFocusCandidates(token, root).indexOf(element);
  return token;
}

function uiFocusCandidates(token, root = document) {
  if (!token) return [];
  if (token.id) {
    const byId = root.querySelector('#' + CSS.escape(token.id));
    if (byId) return [byId];
  }
  const data = token.data || Object.fromEntries(['action', 'value', 'field', 'node', 'edge']
    .filter(key => token[key] !== undefined).map(key => [key, token[key]]));
  if (!Object.keys(data).length && !token.label) return [];
  return [...root.querySelectorAll('button,input,select,textarea,a,[tabindex]')].filter(element =>
    (!token.tag || element.tagName === token.tag) &&
    (!token.label || element.getAttribute('aria-label') === token.label) &&
    Object.entries(data).every(([key, value]) => element.dataset[key] === value));
}

function focusUiControl(token, root = document) {
  const candidates = uiFocusCandidates(token, root);
  const element = candidates[Math.max(0, token?.ordinal || 0)];
  if (!element?.isConnected || element.disabled || !element.getClientRects().length ||
      getComputedStyle(element).visibility === 'hidden') return false;
  element.focus({ preventScroll: true });
  if (typeof token.selectionStart === 'number' && typeof element.setSelectionRange === 'function') {
    // Browsers reject selection ranges on date, color and number inputs.
    try { element.setSelectionRange(token.selectionStart, token.selectionEnd); } catch { /* Not a text control. */ }
  }
  return document.activeElement === element;
}

function captureUiFocus() {
  const element = document.activeElement;
  return element?.closest('dialog') ? null : uiFocusRecord(element);
}

function restoreUiFocus(token) {
  if (token && !document.getElementById('modal').open && sitemapFocusStillCurrent(token)) {
    focusUiControl(token);
  }
}

function redrawWorkbenchModal() {
  const modal = document.getElementById('modal');
  if (!modal.open) return;
  const token = uiFocusRecord(document.activeElement, modal);
  const regions = ['.dialog-body', '.wizard-body', '.ref-editor-main', '.ref-editor-library'];
  const offsets = regions.map(selector => {
    const node = modal.querySelector(selector);
    return { selector, top: node?.scrollTop || 0, left: node?.scrollLeft || 0 };
  });
  const top = modal.scrollTop;
  drawModal();
  workflowModalPolish();
  focusUiControl(token, modal);
  modal.scrollTop = top;
  for (const offset of offsets) {
    const node = modal.querySelector(offset.selector);
    if (node) { node.scrollTop = offset.top; node.scrollLeft = offset.left; }
  }
}

function toggleWorkbenchNavigation(open) {
  const sidebar = document.getElementById('sidebar');
  const trigger = document.querySelector('[data-action="menu"]');
  const expanded = open ?? !sidebar.classList.contains('show');
  sidebar.classList.toggle('show', expanded);
  trigger?.setAttribute('aria-expanded', String(expanded));
  if (expanded) sidebar.querySelector('.nav-item.active, .nav-item')?.focus();
  else if (trigger?.getClientRects().length) trigger.focus();
}

function workbenchControlMetadata() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const shortcut = document.querySelector('.header-actions kbd');
  if (shortcut) shortcut.textContent = /Mac|iPhone|iPad/.test(platform) ? '⌘ K' : 'Ctrl K';
  document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded',
    String(document.getElementById('sidebar').classList.contains('show')));
  document.querySelector('[data-action="theme"]')?.setAttribute('aria-label',
    state.settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

// Dismiss only the nearest transient surface; do not consume editor Escape gestures.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  const details = event.target.closest('details[open]');
  if (details) {
    event.preventDefault(); event.stopImmediatePropagation();
    details.open = false; details.querySelector('summary')?.focus();
  } else if (document.getElementById('sidebar').classList.contains('show')) {
    event.preventDefault(); event.stopImmediatePropagation(); toggleWorkbenchNavigation(false);
  }
}, true);
document.addEventListener('pointerdown', event => {
  for (const details of document.querySelectorAll('.ref-arrange-popover[open]')) {
    if (!details.contains(event.target)) details.open = false;
  }
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('show') && !sidebar.contains(event.target) &&
      !event.target.closest('[data-action="menu"]') && !document.querySelector('dialog[open]')) {
    // Outside clicks keep focus on their own target rather than stealing it for the menu.
    sidebar.classList.remove('show');
    document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
  }
}, true);
function prdRequirements(p){
 const query=productUi.requirementSearch||'';
 return `<div class="requirement-search"><label for="requirement-search">Find a requirement</label><input id="requirement-search" type="search" data-field="polish-requirement-search" value="${esc(query)}" placeholder="Title, ID, priority or state…"><span id="requirement-count" class="tiny muted">${filteredRequirements(p).length} / ${p.requirements.length}</span></div><div id="requirement-results">${requirementsResults(p)}</div>`;
}
function filteredRequirements(p){const q=(productUi.requirementSearch||'').trim().toLowerCase();return p.requirements.filter(r=>(r.id+' '+r.title+' '+r.priority+' '+r.status+' '+r.acceptance).toLowerCase().includes(q));}
function requirementsResults(p){const list=filteredRequirements(p);if(!list.length&&p.requirements.length)return '<div class="card"><h3>No matching requirements</h3><p>Clear the search or try a requirement ID. Your requirements have not been removed.</p></div>';return prdRequirementsBody({...p,requirements:list});}
function editPolishField(el){if(el.dataset.field!=='polish-requirement-search')return false;productUi.requirementSearch=el.value;document.getElementById('requirement-results').innerHTML=requirementsResults(selectedPrd());document.getElementById('requirement-count').textContent=filteredRequirements(selectedPrd()).length+' / '+selectedPrd().requirements.length;return true;}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="close"]')&&askDiscardForm()){event.preventDefault();event.stopImmediatePropagation();}},true);
document.getElementById('modal').addEventListener('cancel',event=>{if(askDiscardForm()){event.preventDefault();event.stopImmediatePropagation();}},true);

// A browser refresh must not silently discard a still-open editing draft.
window.addEventListener('beforeunload',event=>{
 if(document.getElementById('modal').open&&modalOriginal&&TRACKED_FORMS.has(modalType)&&formCheckpoint()!==modalOriginal){
  event.preventDefault();event.returnValue='';
 }
});

// A native modal makes background notices inert; feedback belongs in its active layer.
function workbenchNotify(text){
 clearTimeout(toastTimer);
 const host=document.getElementById('toasts');host.replaceChildren();
 document.querySelectorAll('.dialog-feedback').forEach(el=>el.remove());
 const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
 if(dialog){
  const feedback=document.createElement('p');feedback.className='dialog-feedback';
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');
  const body=dialog.querySelector('.dialog-body,.wizard-body')||dialog;
  body.prepend(feedback);
  // Mount the live region before populating it; never move the user's focus.
  requestAnimationFrame(()=>{if(feedback.isConnected)feedback.textContent=text;});
 }else host.innerHTML=`<div class="toast">${esc(text)}</div>`;
 toastTimer=setTimeout(()=>{host.replaceChildren();document.querySelectorAll('.dialog-feedback').forEach(el=>el.remove());},6000);
}
