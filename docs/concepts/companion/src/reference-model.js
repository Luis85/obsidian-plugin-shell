// Reference-led canvas presentation; canonical plugin architecture stays unchanged.
const referenceUi={panel:window.innerWidth<950?'none':'structure',sectionForm:null,sectionError:'',content:null,contentError:'',libraryQuery:'',editorTab:'content',drag:null};
function referenceIcon(name){
 const shapes={
  content:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  properties:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  branch:'<path d="M6 4v12c0 2 2 3 4 3h6M6 8h10"/><circle cx="6" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="19" r="2"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pointer:'<path d="m5 3 14 10-7 1-3 7z"/>', hand:'<path d="M8 12V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-4-2-6-5l-3-4a2 2 0 0 1 3-2l1 1"/>',
  section:'<path d="M3 5h18M3 19h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',undo:'<path d="m9 4-6 5 6 5M3 9h10c8 0 8 11 0 11"/>',
  redo:'<path d="m15 4 6 5-6 5M21 9H11c-8 0-8 11 0 11"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',up:'<path d="m6 14 6-6 6 6"/>',down:'<path d="m6 10 6 6 6-6"/>'
 };
 return shapes[name]?`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]}</svg>`:icon(name);
}
function referenceTool(label,action,value,ic,extra=''){
 return `<button class="ref-tool" type="button" data-action="${action}" data-value="${esc(value||'')}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${referenceIcon(ic)}<span class="ref-tooltip">${esc(label)}</span></button>`;
}
function referenceBrickHeight(kind,mode='wireframes'){
 if(mode!=='wireframes')return 40;if(COMPONENT_HEIGHTS[kind])return COMPONENT_HEIGHTS[kind];
 return {navigation:44,toolbar:50,heading:62,text:80,list:114,table:108,board:90,detail:100,form:94,chart:96,media:102,actions:68,empty:68,notice:58}[kind]||76;
}
function validReferenceSections(sections){
 if(sections===undefined)return true;if(!Array.isArray(sections)||sections.length>12)return false;
 const ids=new Set(),assigned=new Set(),coord=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=50000&&Math.abs(p.y)<=50000;
 return sections.every(s=>s&&typeof s.id==='string'&&/^section-[1-9][0-9]*$/.test(s.id)&&!ids.has(s.id)&&ids.add(s.id)&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=80&&Array.isArray(s.roots)&&s.roots.length<=60&&(s.members===undefined||Array.isArray(s.members)&&s.members.length<=60)&&(s.members||s.roots).every(id=>typeof id==='string'&&id.length<=120&&!assigned.has(id)&&assigned.add(id))&&(s.anchor===undefined||coord(s.anchor))&&Object.keys(s).every(k=>['id','name','roots','members','anchor'].includes(k)));
}

function referenceSections(d){
 const known=new Set(d.nodes.map(n=>n.id)),stored=(d.canvas?.sections||[]).map(s=>({...s,members:sectionMembers(d,s).filter(id=>known.has(id))}));
 const claimed=new Set(stored.flatMap(s=>s.members));
 return [{id:'main',name:'Main workspace',roots:[],members:d.nodes.filter(n=>!claimed.has(n.id)).map(n=>n.id)},...stored].map(s=>({...s,roots:s.members}));
}

function sectionLayouts(d){
 const out=Object.create(null),bands=[];let y=72;
 for(const s of referenceSections(d)){
  const nodes=d.nodes.filter(n=>s.members.includes(n.id)),sub={...d,nodes:nodes.map(n=>({...n,parent:nodes.some(x=>x.id===n.parent)?n.parent:null}))};
  const positions=layoutSectionNodes(sub,'vertical');
  const height=nodes.length?Math.max(...nodes.map(n=>positions[n.id].y+brickSurfaceSize(n,d).height))+104:300;
  for(const n of nodes)out[n.id]={x:positions[n.id].x+48,y:positions[n.id].y+y};
  bands.push({...s,y,height,width:Math.max(420,...nodes.map(n=>positions[n.id].x+MAP_SIZE.w+96))});y+=height+96;
 }
 return {positions:out,bands};
}

function openSectionEditor(id=null){
 const s=(canvasState().sections||[]).find(s=>s.id===id);
 referenceUi.sectionForm={id:s?.id||null,name:s?.name||'New section',roots:[...(s?sectionMembers(design(),s):[])],owner:designOwner(),fingerprint:JSON.stringify(canvasState().sections||[]),revision:design().revision};
 referenceUi.sectionError='';showModal('ref-section');
}
function saveSectionEditor(remove=false){
 const f=referenceUi.sectionForm,d=design(),c=canvasState();
 const fail=m=>{referenceUi.sectionError=m;redrawModal();};
 if(!f||f.owner!==designOwner()||f.revision!==d.revision||f.fingerprint!==JSON.stringify(c.sections||[]))return fail('The outline or sections changed. Reopen this review.');
 if(state.activeRun)return fail('Finish the active operation before changing sections.');
 if(!remove&&(!f.name.trim()||f.name.length>80))return fail('Use a section name of 1–80 characters.');
 const sections=designCopy(c.sections||[]);
 if(!f.id&&sections.length>=12)return fail('This concept supports up to 12 sections.');
 let id=f.id;if(!id){let i=1;while(sections.some(s=>s.id==='section-'+i))i++;id='section-'+i;}
 const next=sections.filter(s=>s.id!==id).map(s=>({...s,roots:[],members:remove?sectionMembers(d,s):sectionMembers(d,s).filter(r=>!f.roots.includes(r))}));
 if(!remove)next.splice(f.id?Math.max(0,sections.findIndex(s=>s.id===f.id)):next.length,0,{id,name:f.name.trim(),roots:[],members:f.roots,anchor:sections.find(s=>s.id===id)?.anchor||{x:Math.max(48,...sectionZones(d).map(z=>z.x+z.width+80)),y:72}});
 if(!validReferenceSections(next))return fail('Section assignments are not valid.');
 modalOriginal=null;closeModal();
 canvasCommit(c=>{c.sections=next;c.fitted=false;},remove?'Section removed. All views and content were retained.':'Section saved. Plugin structure and source approval are unchanged.');
}
function referencePaneMode(panel){referenceUi.panel=referenceUi.panel===panel?'none':panel;canvasUi.outline=referenceUi.panel==='structure';render();}
function paintReferenceChrome(){
 const vp=document.getElementById('map-viewport'),toolbar=document.getElementById('ref-node-toolbar');
 if(!vp)return;
 document.querySelector('.sitemap-studio')?.setAttribute('data-panel',referenceUi.panel);
 if(toolbar){
  const n=selectedNode(),c=canvasState();
  const projection=flowUi.api?.getNodes.value.find(x=>x.id===n?.id);
  const p=projection?.position||c.positions[n?.id],size=n&&brickSurfaceSize(n);
  const visible=n&&p&&visibleMapNodes().some(x=>x.id===n.id);
  toolbar.hidden=!visible||flowUi.dragging||flowUi.connecting||!!canvasUi.edge;
  if(visible){
   if(toolbar.dataset.node!==n.id){toolbar.dataset.node=n.id;toolbar.innerHTML=referenceSelectionToolbar(n);}
   const right=referenceUi.panel==='none'?vp.clientWidth-12:vp.clientWidth-294;
   const cardX=p.x*c.zoom+c.pan.x,cardY=p.y*c.zoom+c.pan.y;
   toolbar.hidden=toolbar.hidden||cardX+MAP_SIZE.w*c.zoom<0||cardX>right||cardY+size.height*c.zoom<0||cardY>vp.clientHeight;
   toolbar.style.left=Math.max(12,Math.min(right-toolbar.offsetWidth,cardX+MAP_SIZE.w*c.zoom/2-toolbar.offsetWidth/2))+'px';
   const width=toolbar.offsetWidth,height=toolbar.offsetHeight,vr=vp.getBoundingClientRect();
   const card={x:cardX,y:cardY,w:MAP_SIZE.w*c.zoom,h:size.height*c.zoom};
   const obstacles=[card,...[...document.querySelectorAll('.ref-canvas-top,.ref-main-dock,.ref-zoom-dock,.ref-panel,.flow-edge-label,.vue-flow__edgeupdater,.map-node')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const r=e.getBoundingClientRect();return {x:r.x-vr.x,y:r.y-vr.y,w:r.width,h:r.height};})];
   const overlap=(x,y,r)=>x<r.x+r.w+5&&x+width>r.x-5&&y<r.y+r.h+5&&y+height>r.y-5;
   const center=cardX+card.w/2-width/2;
   const candidates=[[center,cardY-height-12],[center,cardY+card.h+12],[cardX+card.w+16,cardY],[cardX-width-16,cardY],[vp.clientWidth-width-14,12],[14,65]];
   const place=candidates.map(([x,y])=>({x:Math.max(12,Math.min(vp.clientWidth-width-12,x)),y})).find(({x,y})=>y>=10&&y+height<=vp.clientHeight-12&&obstacles.every(r=>!overlap(x,y,r)));
   if(place){toolbar.style.left=place.x+'px';toolbar.style.top=place.y+'px';}else toolbar.hidden=true;
  }
 }
 paintSpatialLayers();
}
