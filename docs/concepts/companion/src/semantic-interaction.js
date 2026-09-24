// Local interaction state, accessible alternatives and lifecycle-owned diagram feedback.
function erAnnounce(text){const el=document.getElementById('er-status');if(el)el.textContent=text;}
function erCurrentPositions(){const m=semanticModel(),out=Object.fromEntries(m.entities.map(e=>[e.id,erPosition(m,e)]));for(const n of erUi.api?.getNodes.value||[])if(n.type==='erEntity')out[n.id]={...n.position};return out;}
function erRefreshGeometry(){
 const api=erUi.api;if(!api)return;const m=semanticModel(),positions=erCurrentPositions();
 for(const frame of erSectionNodes(m,positions))api.updateNode(frame.id,{position:frame.position,style:frame.style,data:frame.data});
 api.setEdges(erEdgeProjection(positions));
}
function erPaintGuides(guides=[]){
 erUi.guides=guides;const root=document.getElementById('er-guides');if(!root)return;
 const v=erUi.api?.viewport.value||semanticModel().canvas.viewport;
 root.innerHTML=guides.map(g=>{const p=n=>n*v.zoom;return g.axis==='x'?`<line x1="${p(g.value)+v.x}" x2="${p(g.value)+v.x}" y1="${p(g.from)+v.y}" y2="${p(g.to)+v.y}"/>`:`<line x1="${p(g.from)+v.x}" x2="${p(g.to)+v.x}" y1="${p(g.value)+v.y}" y2="${p(g.value)+v.y}"/>`;}).join('');
}
function erHighlightRelationship(id=erUi.edge){
 const m=semanticModel(),r=m.relationships.find(e=>e.id===id);
 document.querySelectorAll('#er-flow .vue-flow__edge').forEach(el=>el.classList.toggle('er-edge-hover',el.dataset.id===id));
 document.querySelectorAll('#er-flow .er-card').forEach(el=>el.classList.toggle('er-related',!!r&&(el.dataset.entity===r.source||el.dataset.entity===r.target)));
 document.querySelectorAll('#er-flow [data-relationship]').forEach(el=>el.classList.toggle('er-owned-field',el.dataset.relationship===id));
}
function erSelectionFeedback(){
 document.querySelectorAll('.er-catalog-item').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.value===erUi.selected)));
 document.querySelectorAll('.er-relationship-item').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.value===erUi.edge)));
 erHighlightRelationship();
 for(const [action,disabled] of [['er-undo',!design().history.length],['er-redo',!design().future.length]])document.querySelectorAll(`[data-action="${action}"]`).forEach(el=>el.disabled=disabled||!!state.activeRun);
}
function erReveal(id){
 const m=semanticModel(),e=m.entities.find(e=>e.id===id),api=erUi.api;if(!e||!api)return;
 const r=erRect(m,e),zoom=Math.max(.5,Math.min(1,api.viewport.value.zoom));api.setCenter(r.x+r.width/2,r.y+r.height/2,{zoom,duration:0});
}
function erFit(){if(!erUi.api)return;erUi.fitRequested=true;erFitReady();}
function erFitReady(){
 const api=erUi.api;if(!api||!erUi.fitRequested)return;
 if(api.getNodes.value.some(n=>n.type==='erEntity'&&(!n.dimensions.width||!n.dimensions.height)))return;
 erUi.fitRequested=false;api.fitView({padding:.18,duration:0});
}
function erFocusCard(id){const el=document.querySelector(`#er-flow .vue-flow__node[data-id="${CSS.escape(id||'')}"]`);el?.focus({preventScroll:true});}
function erCancelGesture(){
 if(erUi.drag){erUi.cancelled=true;erUi.drag=null;erPaintGuides();erUi.api?.setNodes(erProjection());erUi.api?.setEdges(erEdgeProjection());erAnnounce('Move cancelled. The saved arrangement was kept.');return true;}
 if(erUi.connecting){erUi.cancelled=true;erUi.connecting=false;erUi.api?.endConnection();document.getElementById('er-flow')?.classList.remove('er-connecting');erAnnounce('Connection cancelled.');return true;}
 return false;
}
function erMove(id,dx,dy){
 const e=semanticModel().entities.find(e=>e.id===id);if(!e||state.activeRun)return;
 const p=erPosition(semanticModel(),e),limit=n=>Math.max(-100000,Math.min(100000,n));
 if(erCommit(m=>{m.canvas.positions[id]={x:limit(p.x+dx),y:limit(p.y+dy)};},true)){
  erUi.api?.setNodes(erProjection());erRefreshGeometry();erSelectionFeedback();erAnnounce(e.name+' moved. Undo is available.');
 }
}
function erPositionDialog(){
 const f=erUi.form,m=semanticModel();return erInput('Horizontal position','x',String(f.x),'Canvas coordinates, not file or schema data.')+erInput('Vertical position','y',String(f.y))+
 erSelect('Align with entity','reference',[['','Choose an entity'],...m.entities.filter(e=>e.id!==f.id).map(e=>[e.id,e.name])],f.reference||'')+
 `<div class="row wrap er-align-controls">${[['left','Left edges'],['centerX','Horizontal centers'],['top','Top edges'],['centerY','Vertical centers']].map(([k,v])=>button(v,'er-align',k,'small','',''+(f.reference?'':'disabled'))).join('')}</div><p class="small muted">Alignment changes this draft only. Save position commits one undoable move; Cancel keeps the original arrangement.</p>`;
}
function erBeginPosition(id=erUi.selected){const m=semanticModel(),e=m.entities.find(e=>e.id===id);if(e)erOpen('position',{id:e.id,name:e.name,...erPosition(m,e),reference:''});}
function erAlignDraft(axis){const f=erUi.form,m=semanticModel(),e=m.entities.find(e=>e.id===f?.id),target=m.entities.find(e=>e.id===f?.reference);if(!e||!target)return;const r=erRect(m,target);
 if(axis==='left'||axis==='centerX')f.x=r.x;
 if(axis==='top')f.y=r.y;if(axis==='centerY')f.y=r.y+(r.height-erCardHeight(e,m))/2;
 redrawModal();
}
function erExtraAction(action,value){
 switch(action){
  case 'er-position':erBeginPosition(value||erUi.selected);break;
  case 'er-align':erAlignDraft(value);break;
  case 'er-focus':erReveal(value||erUi.selected);erFocusCard(value||erUi.selected);break;
  case 'er-clear-search':erUi.query='';render();document.getElementById('er-query')?.focus();break;
  case 'er-save-next':if(erSave()){erBeginEntity();document.getElementById('er-name')?.select();}break;
  case 'er-quick-property':{
   const presets={title:['text',true],status:['text',false],due:['date',false],completed:['checkbox',false],tags:['tags',false]},f=erUi.form,entry=presets[value];
   if(entry&&f?.formKind==='entity'&&!f.properties.some(p=>p.key===value)&&f.properties.length<ER_LIMITS.properties){f.properties.push({id:null,key:value,type:entry[0],required:entry[1],hasDefault:false,defaultText:''});redrawModal();document.querySelector('#er-property-rows .er-property-row:last-child input')?.focus();}break;
  }
  case 'er-help':showModal('copy',{title:'Entity editor guide',text:'1. Add the things your plugin manages, such as Task or Person.\n2. Define flat Obsidian properties. Required is an application rule.\n3. Connect entities, then review the owning property and counts.\n4. Group visually in sections. Folders remain separate.\n5. Review generator to inspect declared types and Markdown examples.\n\nDiagram controls\nDrag cards: align edges and centers with Guidelines; Grid snap uses 20-unit spacing. Hold Alt for a free move.\nSelect a card: arrow keys move 1 unit; Shift+arrow moves 20. Position / align provides a non-drag alternative.\nF: fit the whole diagram. Enter: edit the focused entity or relationship.\nEscape: cancel a move/connection, otherwise clear selection.\nDelete: review deletion; linked entities are protected.\nCtrl/Cmd+Z: undo; Shift+Ctrl/Cmd+Z: redo.\nShortcuts do not run in text inputs.\n\nConnector ends\nCircle = optional; bar = one; fork = many. Hover or select a line to highlight both entities and its owning property. Counts and plain-language sentences are available in Relationships and the inspector.\n\nThe diagram is not a database. Inverse queries, reference resolution, required values and cardinality enforcement belong in generated application services; no existing notes are migrated here.',filename:'entity-editor-guide.txt'});break;
  default:return false;
 }return true;
}
function erKeyDown(event){
 if(state.view!=='entities')return;
 if(document.getElementById('modal').open){if(modalType==='semantic-form'&&erUi.form?.formKind==='entity'&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();dispatch('er-property-add');}return;}
 if(!event.target.closest('.er-workspace,.er-toolbar')||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!erCancelGesture())erPick(null);return;}
 if(state.activeRun)return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopImmediatePropagation();const selected=erUi.selected;designHistory(event.shiftKey?'redo':'undo');Vue.nextTick(()=>erFocusCard(selected));return;}
 const node=event.target.closest('.vue-flow__node-erEntity'),edge=event.target.closest('.vue-flow__edge');
 if(event.target.closest('button,.vue-flow__handle'))return;
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},id=node?.dataset.id;
 if(id&&directions[event.key]){event.preventDefault();event.stopImmediatePropagation();const [x,y]=directions[event.key],step=event.shiftKey?20:1;erPick(id);erMove(id,x*step,y*step);return;}
 if((node||edge)&&['Enter',' ','Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(node)erPick(id);else erPick(edge.dataset.id,true);
  if(event.key===' ')return;
  dispatch(event.key==='Enter'?(node?'er-edit':'er-edit-edge'):(node?'er-delete':'er-delete-edge'),id||edge.dataset.id);return;
 }
 if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();erFit();}
}
document.addEventListener('keydown',erKeyDown,true);
