// Bounded deterministic layouts for at most 60 concept surfaces. No external engine.
function layoutPositions(d,mode){
 if(mode==="sections")return sectionLayouts(d).positions;
 const out=Object.create(null),{w,gapX,gapY}=MAP_SIZE,h=Math.max(MAP_SIZE.h,...d.nodes.map(n=>brickSurfaceSize(n,d).height)),dx=w+gapX,dy=h+gapY;
 const ordered=designNodesInOrder(d),roots=d.nodes.filter(n=>!n.parent||!d.nodes.some(x=>x.id===n.parent));
 if(mode==='grid'||mode==='free'){
  const columns=Math.max(2,Math.min(5,Math.ceil(Math.sqrt(d.nodes.length))));
  ordered.forEach(({n},i)=>out[n.id]={x:48+(i%columns)*dx,y:56+Math.floor(i/columns)*dy});return out;
 }
 if(mode==='lanes'){
  const kinds=['view','page','modal','settings','action','group'].filter(kind=>d.nodes.some(n=>n.kind===kind));
  kinds.forEach((kind,col)=>ordered.filter(({n})=>n.kind===kind).forEach(({n},row)=>out[n.id]={x:48+col*dx,y:76+row*dy}));return out;
 }
 const children=id=>d.nodes.filter(n=>n.parent===id),size=new Map(),visiting=new Set();
 function span(n){if(visiting.has(n.id))return 1;if(size.has(n.id))return size.get(n.id);visiting.add(n.id);const v=Math.max(1,children(n.id).reduce((sum,child)=>sum+span(child),0));size.set(n.id,v);visiting.delete(n.id);return v;}
 const placed=new Set();
 function walk(n,start,depth){if(placed.has(n.id))return;placed.add(n.id);const s=span(n),across=start+(s-1)/2;
  out[n.id]=mode==='horizontal'?{x:48+depth*dx,y:56+across*dy}:{x:48+across*dx,y:56+depth*dy};
  let at=start;for(const child of children(n.id)){walk(child,at,depth+1);at+=span(child);}}
 let at=0;for(const root of roots){walk(root,at,0);at+=span(root)+.35;}
 for(const {n} of ordered)if(!placed.has(n.id)){out[n.id]={x:48+at*dx,y:56};at++;}
 return out;
}
function mapWire(a,b,action=false,index=0){
 const {w,h}=MAP_SIZE;if(!a||!b)return null;
 if(a===b||a.x===b.x&&a.y===b.y){const x=a.x+w,y=a.y+h/2;return {d:`M ${x} ${y-24} C ${x+84} ${y-74}, ${x+84} ${y+74}, ${x} ${y+24}`,x:x+56,y:y};}
 const ax=a.x+w/2,ay=a.y+h/2,bx=b.x+w/2,by=b.y+h/2;
 if(Math.abs(bx-ax)>Math.abs(by-ay)*1.15){
  const direction=bx>ax?1:-1,sx=ax+direction*w/2,ex=bx-direction*w/2,bend=Math.max(36,Math.abs(ex-sx)*.5),offset=action?16+(index%4)*6:0;
  return {d:`M${sx},${ay+offset} C${sx+direction*bend},${ay+offset} ${ex-direction*bend},${by+offset} ${ex},${by+offset}`,x:(sx+ex)/2,y:(ay+by)/2+offset};
 }
 const direction=by>ay?1:-1,sy=ay+direction*h/2,ey=by-direction*h/2,bend=Math.max(36,Math.abs(ey-sy)*.5),offset=action?26+(index%4)*8:0;
 return {d:`M${ax+offset},${sy} C${ax+offset},${sy+direction*bend} ${bx+offset},${ey-direction*bend} ${bx+offset},${ey}`,x:(ax+bx)/2+offset,y:(sy+ey)/2};
}
function canvasWires(d,nodes){
 const c=canvasState(d),visible=new Set(nodes.map(n=>n.id)),selected=selectedNode()?.id;
 const tree=nodes.filter(n=>n.parent&&visible.has(n.parent)).map(n=>{const wire=mapWire(c.positions[n.parent],c.positions[n.id]);return `<path class="tree-wire" d="${wire.d}"/>`;}).join('');
 const links=c.edges==='none'?[]:d.links.filter(e=>visible.has(e.from)&&visible.has(e.to)&&(c.edges==='all'||e.from===selected||e.to===selected||e.id===canvasUi.edge));
 const nav=links.map((e,i)=>{const wire=mapWire(c.positions[e.from],c.positions[e.to],true,i),label=e.label.length>28?e.label.slice(0,27)+'…':e.label,lw=Math.min(198,24+label.length*6.2);return `<g class="map-edge ${e.id===canvasUi.edge?'selected':''}" data-action="canvas-edge" data-value="${esc(e.id)}"><title>${esc(e.label)}</title><path class="edge-hit" d="${wire.d}"/><path class="nav-wire" marker-end="url(#map-arrow)" d="${wire.d}"/><g class="edge-label" transform="translate(${wire.x},${wire.y})"><rect x="${-lw/2}" y="-12" width="${lw}" height="24" rx="5"/><text text-anchor="middle" dominant-baseline="central">${esc(label)}</text></g></g>`;}).join('');
 return `<defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>${tree}${nav}`;
}
