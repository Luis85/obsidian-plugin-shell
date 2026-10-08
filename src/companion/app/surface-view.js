// Presentation contracts: ownership containers are distinct from content-bearing screens.
function allocateSurfaceCode(d,label,excludeId=null){
 const base=String(label).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54)||'screen';
 const safe=/^[a-z]/.test(base)?base:'screen-'+base.slice(0,47);
 const used=new Set(d.nodes.filter(n=>n.id!==excludeId).map(n=>n.slug.toLowerCase()));
 let code=safe,index=2;while(used.has(code))code=safe+'-'+index++;
 return code;
}
function surfaceLayoutName(n){return LAYOUTS.find(l=>l.id===n.layout)?.name||'Single pane';}
function surfaceLayoutDiagram(layout){
 const rect=(x,y,w,h,cls='outlet')=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;
 let shapes='';
 if(['sidebar-left','list-detail','sidebar-right','inspector'].includes(layout)){
  const right=['sidebar-right','inspector'].includes(layout);shapes=rect(right?178:8,8,54,84,'rail')+rect(right?8:70,8,162,84);
 }else if(layout==='three-pane'||layout==='canvas')shapes=rect(8,8,40,84,'rail')+rect(56,8,128,84)+rect(192,8,40,84,'rail');
 else if(layout==='split')shapes=rect(8,8,108,84)+rect(124,8,108,84);
 else if(layout==='board')shapes=[8,85,162].map(x=>rect(x,8,70,84)).join('');
 else if(layout==='dashboard')shapes=[8,85,162].map(x=>rect(x,8,70,24,'rail')).join('')+rect(8,40,224,52);
 else if(layout==='tabs'||layout==='wizard')shapes=[8,66,124].map(x=>rect(x,8,50,15,'rail')).join('')+rect(8,31,224,61);
 else if(layout==='table')shapes=rect(8,8,224,18,'rail')+[34,54,74].map(y=>rect(8,y,224,12)).join('');
 else if(layout==='form')shapes=rect(8,8,130,12,'rail')+[30,52].map(y=>rect(8,y,224,14)).join('')+rect(168,75,64,17,'rail');
 else shapes=rect(8,8,140,13,'rail')+rect(8,29,224,63);
 return `<svg class="surface-layout-svg" viewBox="0 0 240 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${shapes}</svg>`;
}
function containerCardContents(n,count,collapsed){
 const group=n.kind==='group',d=design(),children=d.nodes.filter(x=>x.parent===n.id);
 const list=children.slice(0,3).map(c=>`<button class="container-child nodrag nopan" data-action="design-select" data-value="${esc(c.id)}">${icon(c.kind==='group'?'layers':'file')}<span>${esc(c.label)}</span>${icon('arrow')}</button>`).join('');
 const legacy=bricksOf(n).length;
 return `<header class="container-heading"><span>${icon(group?'layers':'box')}${group?'Navigation group':'View container'}</span><button class="nodrag nopan ref-card-more" data-action="canvas-card-menu" data-value="${n.id}" aria-label="More actions for ${esc(n.label)}">${referenceIcon('more')}</button></header>
 <strong class="map-card-title" title="${esc(n.label)}">${esc(n.label)}</strong><div class="container-identity"><code>${esc(n.slug)}</code>${n.entry?'<span class="container-entry">Plugin entry</span>':''}</div>
 ${group?`<div class="navigation-group-body">${list||'<span>No screens grouped yet</span>'}</div><div class="container-caption">Organizes navigation · no screen content</div>`:
 `<div class="container-layout"><div class="container-layout-label"><span>${esc(surfaceLayoutName(n))}</span><small>Host layout</small></div>${surfaceLayoutDiagram(n.layout)}</div><div class="container-outlet"><span>${icon('layers')} ${count} ${count===1?'child surface':'child surfaces'}</span><span>${esc(PLACEMENTS[n.placement])}</span></div><p class="container-caption">Screens inherit this view’s placement.</p>`}
 <footer class="container-footer"><button class="nodrag nopan" data-action="canvas-child" data-value="${n.id}">${icon('plus')} Add screen</button>${count?`<button class="nodrag nopan flow-collapse" data-action="canvas-collapse" data-value="${n.id}" title="${collapsed?'Expand':'Collapse'} branch">${collapsed?'Expand':'Collapse'} ${count}</button>`:''}${legacy?`<button class="nodrag nopan retained-view-content" data-action="ref-content" data-value="${n.id}" title="Earlier view content is preserved; no automatic migration">${legacy} retained components</button>`:''}</footer>`;
}
function placeEmptySections(d){
 // Empty sections need their own slot as well; never occupy a populated section's bounds.
 let bottom=Math.max(72,...d.nodes.map(n=>(d.canvas.positions[n.id]?.y||0)+brickSurfaceSize(n,d).height))+112;
 for(const s of d.canvas.sections||[]){if(sectionMembers(d,s).some(id=>d.nodes.some(n=>n.id===id)))continue;s.anchor={x:48,y:bottom};bottom+=360;}
}
