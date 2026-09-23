// Canvas-first shell, restrained overview cards and synchronized full-page editing.
function referenceSelectionToolbar(n){
 return `<div class="ref-selection-name">${esc(n.label)}</div><div class="ref-selection-actions" role="toolbar" aria-label="Actions for ${esc(n.label)}">
 ${canHaveBricks(n)?referenceTool('Edit page content','ref-content',n.id,'content'):''}
 ${referenceTool('Surface properties','design-edit',n.id,'properties')}
 ${referenceTool('Add component or screen','library-card-add',n.id,'plus')}
 ${n.kind!=='group'?referenceTool('Add connected card','connection-card-add',n.id,'link'):''}
 ${referenceTool('Open inspector','ref-inspect',n.id,'layers')}
 <span class="ref-tool-separator"></span>${referenceTool('More actions','canvas-card-menu',n.id,'more')}</div>`;
}
function referenceSitemapView(){
 const d=design(),n=selectedNode(),errors=designIssues(d).filter(x=>x.level==='error');
 return `<section class="sitemap-studio ref-studio" data-panel="${referenceUi.panel}">
 <header class="ref-page-header"><div><h1>Sitemap & views</h1><p>${esc(project()?.name||'Plugin outline')} <span>·</span> ${d.nodes.length} surfaces <span>·</span> ${d.links.length} interactions <span>·</span> ${errors.length?errors.length+' checks need attention':'Structure consistent'}</p></div>
 <div class="row">${designUi.mode!=='map'?button('Back to map','ref-mode','map','small','arrow'):''}${button('Import / export','design-transfer','','ghost small','code')}${button('Review boilerplate','design-plan','','primary small','wand')}${referenceTool(canvasUi.expanded?'Leave focus mode':'Focus mode','canvas-expand','','focus')}</div></header>
 <div class="map-workspace ref-workspace"><section class="map-main" aria-label="Sitemap editor">${designUi.mode==='map'?referenceMap(d):designUi.mode==='preview'?designLivePreview(d,n):designCheckView(designIssues(d))}</section>
 <aside class="outline-tree ref-panel" aria-label="Structure panel">${referenceStructure(d)}</aside>
 <aside class="node-inspector polish-inspector ref-panel" aria-label="Selected surface">
 <div class="ref-panel-heading"><strong>Inspector</strong>${referenceTool('Close inspector','ref-panel-close','','close')}</div>
 <div class="inspector-tabs" role="group" aria-label="Inspector section">${[['details','Surface'],['bricks','Components'],['intent','Intent'],['links','Links'],['checks','Checks']].map(([id,title])=>`<button data-action="canvas-inspector" data-value="${id}" class="${canvasUi.inspector===id?'active':''}" aria-pressed="${canvasUi.inspector===id}">${title}</button>`).join('')}</div><div class="inspector-body">${flowInspector(d,n)}</div></aside>
 </div><footer class="ref-map-footer"><span id="map-status-message" role="status">Drag cards to arrange · Click a block to write · Use handles to connect</span><div>${button('Change blueprint','nav','blueprints','ghost small')}${referenceTool('Map help','canvas-help','','help')}</div></footer><span id="canvas-live" class="sr-only" aria-live="polite"></span></section>`;
}
function referenceMap(d){
 const c=canvasState(),nodes=visibleMapNodes();
 return `<div id="map-viewport" class="map-viewport ref-canvas" tabindex="0" role="region" aria-label="Interactive sitemap canvas" aria-describedby="map-instructions">
 <div id="ref-section-layer" role="group" aria-label="Visual sections"></div><div id="vf-root" aria-label="Vue Flow sitemap"></div>
 <div class="ref-canvas-top nodrag nopan"><div class="ref-display-control" role="group" aria-label="Card content display">${[['structure','Structure'],['labels','Content'],['wireframes','Wireframes']].map(([id,label])=>`<button data-action="brick-display" data-value="${id}" aria-pressed="${brickDisplay()===id}" class="${brickDisplay()===id?'active':''}">${label}</button>`).join('')}</div>
 <details class="ref-arrange-popover"><summary>${referenceIcon('grid')} Arrange ${referenceIcon('chevron')}</summary><div class="ref-popover">
 <label for="map-layout">Map layout<select id="map-layout" data-field="canvas-layout">${Object.entries(MAP_LAYOUTS).map(([id,label])=>`<option value="${id}" ${c.layout===id?'selected':''}>${label}</option>`).join('')}</select></label>${button('Arrange cards','canvas-arrange','','small','grid',c.layout==='free'?'disabled':'')}
 <label><input data-field="canvas-snap" type="checkbox" ${c.snap?'checked':''}> Snap to grid</label><label for="map-edges">Show interactions<select id="map-edges" data-field="canvas-edges">${[['selected','Selected surface'],['all','All connections'],['none','Hide connections']].map(([id,label])=>`<option value="${id}" ${c.edges===id?'selected':''}>${label}</option>`).join('')}</select></label>
 ${button('Add section','ref-section','','ghost small','plus')}${button('Canvas settings','flow-settings','','ghost small','settings')}</div></details>
 <button class="ref-panel-toggle" data-action="canvas-outline" aria-pressed="${referenceUi.panel==='structure'}">${referenceIcon('layers')} Outline</button></div>
 <div id="ref-node-toolbar" class="ref-node-toolbar nodrag nopan" hidden></div>
 ${!nodes.length?`<div class="map-empty"><h2>One view is a good beginning.</h2><p>Add its content. Then connect the next step.</p>${button('Add a view','design-add','view','primary','plus')}</div>`:''}
 <div id="map-mode-message" class="map-mode-message" ${canvasUi.connecting?'':'hidden'}><span>Choose a destination card.</span>${button('Cancel','canvas-cancel-mode','','small')}</div>
 <div class="ref-main-dock nodrag nopan" role="toolbar" aria-label="Canvas tools">
 ${referenceTool('Select cards','ref-select-mode','','pointer',`aria-pressed="${!c.interaction.panOnDrag}"`)}
 ${referenceTool('Hand tool: drag blank canvas','ref-pan-mode','','hand',`aria-pressed="${c.interaction.panOnDrag}"`)}
 <span class="ref-tool-separator"></span>${referenceTool('Add a native view','design-add','view','plus')}${referenceTool('Add a screen or dialog','design-add','page','content')}${referenceTool('Connect surfaces','design-connect','','link')}
 ${referenceTool('Add section','ref-section','','section')}<span class="ref-tool-separator"></span>
 ${referenceTool('Undo','design-undo','','undo',!d.history.length?'disabled':'')}${referenceTool('Redo','design-redo','','redo',!d.future.length?'disabled':'')}
 <span class="ref-tool-separator"></span>${referenceTool('Layout preview','ref-mode','preview','eye')}${referenceTool('Structure checks','ref-mode','issues','check')}${referenceTool('Canvas settings','flow-settings','','settings')}
 </div>
 <div class="map-controls ref-zoom-dock nodrag nopan" role="group" aria-label="Canvas navigation">${button('−','canvas-zoom-out','','small','','aria-label="Zoom out"')}<button id="map-zoom-label" class="btn small" data-action="canvas-reset-zoom" aria-label="Reset zoom to 100%">100%</button>${button('+','canvas-zoom-in','','small','','aria-label="Zoom in"')}${button('Fit','canvas-fit','','small')}${referenceTool('Focus selected card','canvas-focus','','focus',!selectedNode()?'disabled':'')}
 <details class="map-pan-controls"><summary title="Pan without dragging">Pan</summary><div class="map-pan-menu">${button('←','canvas-pan','96,0','small','','aria-label="Pan left"')}${button('↑','canvas-pan','0,96','small','','aria-label="Pan up"')}${button('↓','canvas-pan','0,-96','small','','aria-label="Pan down"')}${button('→','canvas-pan','-96,0','small','','aria-label="Pan right"')}</div></details></div>
 <div id="map-instructions" class="sr-only">Click cards to select; drag their headers to move. Click blocks to write. Click or drag handles to connect. Empty canvas clears selection.</div><span id="map-count" class="sr-only">${nodes.length}/${d.nodes.length} visible</span><div id="map-search-feedback" class="sr-only" hidden></div></div>`;
}
function referenceStructure(d){
 const q=canvasUi.search.trim(),ordered=designNodesInOrder(d);
 const visible=new Set(visibleMapNodes(d).map(n=>n.id));const shown=q?ordered.filter(({n})=>mapMatch(n)):ordered.filter(({n})=>visible.has(n.id));
 return `<div class="ref-panel-heading"><strong>Structure</strong>${referenceTool('Close structure','ref-panel-close','','close')}</div>
 <label class="ref-structure-search" for="map-search">${icon('search')}<input id="map-search" type="search" data-field="ref-search" value="${esc(canvasUi.search)}" placeholder="Find a screen…" autocomplete="off"></label>
 <div class="ref-structure-list" aria-label="Surface outline">${shown.length?shown.map(({n,depth})=>`<div class="ref-tree-row" style="--depth:${Math.min(depth,6)}">${d.nodes.some(x=>x.parent===n.id)?`<button class="ref-tree-fold" aria-expanded="${!canvasState().collapsed.includes(n.id)}" data-action="canvas-collapse" data-value="${n.id}" aria-label="${canvasState().collapsed.includes(n.id)?'Expand':'Collapse'} ${esc(n.label)}">${referenceIcon('chevron')}</button>`:'<span class="ref-tree-dot"></span>'}<button data-action="ref-reveal" data-value="${n.id}" class="outline-node ${designUi.selected===n.id?'selected':''}" aria-pressed="${designUi.selected===n.id}"><span>${esc(n.label)}<small>${NODE_KINDS[n.kind]}</small></span>${bricksOf(n).length?`<i>${bricksOf(n).length}</i>`:''}</button></div>`).join(''):'<p class="ref-no-results">No matching screens. Clear the search to see the outline.</p>'}</div>
 <div class="ref-structure-sections"><div class="ref-panel-heading"><strong>Sections</strong>${referenceTool('Add section','ref-section','','plus')}</div><p>Visual groups, not plugin hierarchy.</p>${referenceSections(d).map(s=>`<button data-action="${s.id==='main'?'ref-section-layout':'ref-section'}" data-value="${s.id==='main'?'':s.id}">${referenceIcon('section')}<span>${esc(s.name)}</span><small>${s.roots.length}</small></button>`).join('')}</div>`;
}
function referenceSectionDialog(){
 const f=referenceUi.sectionForm;
 return dialogBody(f.id?'Edit visual section':'New visual section',`<p>Group cards visually. Drag a card into a section or select cards here. Sections grow around their content; containment and connections are unchanged.</p>
 <label class="field">Section name<input data-field="ref-section-name" value="${esc(f.name)}" maxlength="80"></label>
 <fieldset class="ref-section-roots"><legend>Include cards</legend>${design().nodes.map(n=>`<label><input type="checkbox" data-field="ref-section-root" data-id="${n.id}" ${f.roots.includes(n.id)?'checked':''}>${esc(n.label)} <small>${NODE_KINDS[n.kind]}</small></label>`).join('')}</fieldset>
 <p class="small muted">Each card belongs to one visual section. Deleting a section returns its cards to Main workspace without deleting them.</p><p role="alert" class="error">${esc(referenceUi.sectionError)}</p>`,
 (f.id?button('Remove section','ref-section-remove','','danger'):'')+button('Cancel','close','','ghost')+button('Save section','ref-section-save','','primary'));
}
function referenceCardContents(n,lib,children,collapsed){
 const mode=brickDisplay(),items=bricksOf(n);
 return `<header class="brick-card-header ref-card-header">
 <button class="ref-card-more nodrag nopan" data-action="canvas-card-menu" data-value="${n.id}" aria-label="More actions for ${esc(n.label)}">${referenceIcon('more')}</button>
 <span class="ref-card-kind">${esc(NODE_KINDS[n.kind])}${n.entry?' · Entry':''}</span>
 <strong class="map-card-title" title="${esc(n.label)}">${esc(n.label)}</strong>
 <button class="ref-card-open nodrag nopan" data-action="ref-content" data-value="${n.id}" aria-label="Edit content of ${esc(n.label)}" title="Edit content">${referenceIcon('content')}</button>
 ${children?`<button class="flow-collapse ref-collapse nodrag nopan" data-action="canvas-collapse" data-value="${n.id}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(n.label)} branch">${collapsed?'+':'−'}<span>${children}</span></button>`:''}</header>
 <div class="brick-stack ${mode}" data-brick-stack="${n.id}">${items.map((b,i)=>brickTile(n,b,i,mode)).join('')}</div>
 <button class="brick-add nodrag nopan" data-action="brick-add" data-value="${n.id}">${icon('plus')} ${items.length?'Add component':'Plan this screen'}</button>
 <div class="ref-card-footer"><button class="flow-card-intent nodrag nopan" data-action="flow-intent" data-value="${n.id}" title="${esc(n.intent||'Describe user intent and goals')}">${referenceIcon('eye')} ${n.goals?.length||0} goals</button><button class="nodrag nopan" data-action="ref-inspect" data-value="${n.id}" title="Inspect implementation bindings">${bricksOf(n).length} components</button></div>`;
}
function referenceSketch(kind){const extended=componentWireframe(kind);if(extended)return extended;
 const line=(x,y,w)=>`<path d="M${x} ${y}h${w}"/>`;
 const box=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
 const row=(y,flip=false)=>box(flip?140:10,y,60,25)+[0,7,14].map((v,i)=>line(flip?10:84,y+4+v,[113,94,69][i])).join('');
 const shapes={
 list:row(6)+row(39,true)+row(72),text:[6,16,26,42,52,62].map((y,i)=>line(10,y,i%3===2?136:190)).join(''),
 navigation:box(9,6,27,16)+line(92,12,20)+line(126,12,20)+line(160,12,20),
 toolbar:box(9,5,125,21)+line(148,10,48)+line(148,20,34),
 heading:line(10,7,114)+line(10,21,190)+line(10,29,140),
 table:box(9,4,194,77)+[18,34,50,66].map(y=>line(9,y,194)).join('')+'<path d="M63 4v77M146 4v77"/>',
 board:[9,77,145].map((x,i)=>line(x,5,50)+box(x,15,57,24)+box(x,46,57,i===1?16:25)).join(''),
 detail:box(10,5,66,58)+[8,21,34,47,62].map((y,i)=>line(91,y,i%2?86:108)).join(''),
 form:[7,37].map(y=>line(10,y,38)+box(10,y+7,191,18)).join(''),
 chart:'<path d="M10 4v65h190"/>'+[25,70,115,160].map((x,i)=>box(x,[37,17,28,7][i],24,[30,50,39,60][i])).join(''),
 media:box(9,4,194,71)+'<path d="m27 64 44-35 36 29 37-43 42 49"/><circle cx="165" cy="24" r="7"/>',
 actions:line(10,6,95)+line(10,15,76)+box(140,5,60,35)+box(10,27,49,13),
 empty:box(10,6,31,32)+line(58,12,142)+line(58,24,109)+line(58,36,69),
 notice:'<circle cx="22" cy="18" r="10"/>'+line(44,12,156)+line(44,25,112)
 };
 const height={navigation:28,toolbar:34,heading:38,list:104,table:88,board:78,detail:72,form:72,chart:76,media:84,actions:46,empty:44,notice:36,text:72}[kind]||44;
 return `<svg class="brick-wireframe ref-wireframe" viewBox="0 0 212 ${height}" aria-hidden="true" focusable="false">${shapes[kind]||shapes.text}</svg>`;
}
