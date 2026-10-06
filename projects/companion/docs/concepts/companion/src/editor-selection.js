// One canvas selection, with a separate catalog cursor. These are view-local,
// non-persistent projections; selecting a source never selects a surface too.
function sitemapSelection(d=design()){
 const flow=d.dataSources?.flows.find(f=>f.id===canvasUi.edge);
 if(flow)return {kind:'data-flow',id:flow.id,record:flow};
 const source=d.dataSources?.sources.find(s=>s.id===dsUi.selected);
 if(source&&dsUi.show&&Object.hasOwn(d.dataSources.positions,source.id))return {kind:'source',id:source.id,record:source};
 const surface=d.nodes.find(n=>n.id===designUi.selected);
 return surface?{kind:'surface',id:surface.id,record:surface}:{kind:'empty',id:null,record:null};
}
function selectSitemapItem(kind,id=null){
 const d=design();
 if(kind==='source'&&!d.dataSources?.sources.some(s=>s.id===id))return false;
 if(kind==='surface'&&!d.nodes.some(n=>n.id===id))return false;
 if(kind==='data-flow'&&!d.dataSources?.flows.some(f=>f.id===id))return false;
 const changed=designUi.selected!==id||kind!=='surface';
 designUi.selected=kind==='surface'?id:null;
 dsUi.selected=kind==='source'?id:null;
 canvasUi.edge=kind==='data-flow'?id:null;
 if(changed){brickUi.selected=null;brickUi.node=null;}
 normalizeSitemapSelection(d);return true;
}
function normalizeSitemapSelection(d=design()){
 if(!d.nodes.some(n=>n.id===designUi.selected))designUi.selected=null;
 if(!dsUi.show||!d.dataSources?.sources.some(s=>s.id===dsUi.selected&&Object.hasOwn(d.dataSources.positions,s.id)))dsUi.selected=null;
 if(canvasUi.edge&&!d.links.some(e=>e.id===canvasUi.edge)&&!d.nodes.some(n=>n.parent&&'contains-'+n.id===canvasUi.edge)&&!d.dataSources?.flows.some(f=>f.id===canvasUi.edge))canvasUi.edge=null;
 if(!dsUi.show&&d.dataSources?.flows.some(f=>f.id===canvasUi.edge))canvasUi.edge=null;
 if(dsUi.selected||d.dataSources?.flows.some(f=>f.id===canvasUi.edge))designUi.selected=null;
 if(!d.dataSources?.sources.some(s=>s.id===dsUi.catalogSelected))dsUi.catalogSelected=null;
 if(d.semantic){if(!d.semantic.entities.some(e=>e.id===erUi.selected))erUi.selected=null;if(!d.semantic.relationships.some(r=>r.id===erUi.edge))erUi.edge=null;}
 const tabs=sitemapInspectorSections(d);
 if(tabs.length&&!tabs.some(([id])=>id===canvasUi.inspector))canvasUi.inspector=tabs[0][0];
}
function sitemapInspectorSections(d=design()){
 const kind=sitemapSelection(d).kind;
 if(kind==='source')return [['source-details','Source'],['source-operations','Operations'],['source-flows','Data flows']];
 if(kind==='data-flow')return [['data','Data flow']];
 if(kind==='empty')return [];
 return [['details','Surface'],['bricks','Components'],['intent','Intent'],['links','Links'],['data','Data'],['checks','Checks']];
}
function sitemapInspectorTabs(d=design()){
 return sitemapInspectorSections(d).map(([id,label])=>`<button data-action="canvas-inspector" data-value="${id}" class="${canvasUi.inspector===id?'active':''}" aria-pressed="${canvasUi.inspector===id}">${label}</button>`).join('');
}
function paintSitemapInspector(){
 const d=design();normalizeSitemapSelection(d);
 const root=document.querySelector('.node-inspector');if(!root)return;
 const tabs=root.querySelector('.inspector-tabs'),body=root.querySelector('.inspector-body');
 if(tabs){tabs.innerHTML=sitemapInspectorTabs(d);tabs.hidden=!sitemapInspectorSections(d).length;}
 if(body)body.innerHTML=flowInspector(d,selectedNode());
 root.dataset.selectionKind=sitemapSelection(d).kind;
}
function dsFlowInspector(f,d=design()){
 const source=d.dataSources.sources.find(s=>s.id===f.source),op=source.operations.find(o=>o.id===f.operation),card=d.nodes.find(n=>n.id===f.card);
 return `<h2>${esc(f.label)}</h2><p class="ds-direction-summary">${esc(dsFlowSentence(f,d))}</p><dl class="ds-facts"><dt>Operation</dt><dd>${esc(op.name)}</dd><dt>Direction</dt><dd>${esc(DS_DIRECTIONS[f.direction])}</dd><dt>Trigger</dt><dd>${esc(f.trigger)}</dd></dl><div class="ds-shape-pair"><div><span>Input · into source</span><strong>${esc(dsShapeLabel(op.input,d))}</strong></div><div><span>Output · from source</span><strong>${esc(dsShapeLabel(op.output,d))}</strong></div></div><p>${esc(f.notes||'No mapping or behavior notes declared.')}</p><div class="row wrap">${button('Edit data flow','ds-flow',f.id,'primary small')}${button('Locate '+card.label,'ds-flow-reveal',f.id,'small')}${button('Manage '+source.name,'ds-catalog',source.id,'small')}${button('Remove data flow','ds-remove-flow',f.id,'danger small')}</div><p class="small muted">This is a design contract. No data transfer, authentication or synchronization is executed.</p>`;
}
// Canvas hit-testing and keyboard focus must not resurrect the previous card.
function sitemapFocusStillCurrent(token){
 const id=token?.node||(token?.action==='canvas-select'?token.value:null);
 if(!id||!project()||state.view!=='sitemap')return true;
 const current=sitemapSelection();return current.id===id;
}
