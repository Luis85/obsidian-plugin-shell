// Pure diagram geometry. Layout never changes the declared entity contracts.
const ER_WIDTH=290,ER_GRID=20,ER_GUIDE_PX=6;
function erPosition(m,e,i=m.entities.indexOf(e)){return m.canvas.positions[e.id]||{x:60+(i%3)*390,y:60+Math.floor(i/3)*450};}
function erRect(m,e,positions=m.canvas.positions){const p=positions[e.id]||erPosition(m,e);return {id:e.id,x:p.x,y:p.y,width:ER_WIDTH,height:erCardHeight(e,m)};}
function erPortPair(a,b,self=false){
 if(self)return ['out','in-top'];
 const dx=b.x+b.width/2-a.x-a.width/2,dy=b.y+b.height/2-a.y-a.height/2;
 if(Math.abs(dx)<(a.width+b.width)/2+45&&Math.abs(dy)>(a.height+b.height)/2+30)return dy>=0?['out-bottom','in-top']:['out-top','in-bottom'];
 return dx>=0?['out','in']:['out-left','in-right'];
}
function erSectionNodes(m,positions=m.canvas.positions){
 return m.sections.map(s=>{const members=m.entities.filter(e=>e.section===s.id).map(e=>erRect(m,e,positions));if(!members.length)return null;
  const x=Math.min(...members.map(r=>r.x))-24,y=Math.min(...members.map(r=>r.y))-48;
  const right=Math.max(...members.map(r=>r.x+r.width))+24,bottom=Math.max(...members.map(r=>r.y+r.height))+24;
  return {id:'frame-'+s.id,type:'erSection',position:{x,y},data:{name:s.name,id:s.id,count:members.length},style:{width:(right-x)+'px',height:(bottom-y)+'px'},draggable:false,connectable:false,selectable:false,focusable:false,zIndex:-1};
 }).filter(Boolean);
}
function erSnapPosition(m,id,raw,zoom=1,bypass=false){
 const entity=m.entities.find(e=>e.id===id),height=erCardHeight(entity,m),position={x:raw.x,y:raw.y},guides=[];
 const limit=v=>Math.max(-100000,Math.min(100000,v));
 if(!bypass){
  const enabled=m.canvas.guides!==false,threshold=ER_GUIDE_PX/Math.max(.15,zoom);
  for(const axis of ['x','y']){
   const size=axis==='x'?ER_WIDTH:height,offsets=[0,size/2,size],matches=[];
   if(enabled)for(const other of m.entities){if(other.id===id)continue;const r=erRect(m,other),otherSize=axis==='x'?r.width:r.height;
    for(const own of offsets)for(const target of [0,otherSize/2,otherSize]){
     const value=r[axis]+target,delta=value-(raw[axis]+own);
     if(Math.abs(delta)<=threshold)matches.push({delta,value,own,other:r,priority:other.section===entity.section?0:1});
    }
   }
   matches.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.priority-b.priority||a.other.id.localeCompare(b.other.id)||a.own-b.own);
   const match=matches[0];
   if(match&&Math.abs(raw[axis]+match.delta)<=100000){position[axis]+=match.delta;guides.push({axis,value:match.value,other:match.other});}
   else if(m.canvas.snap)position[axis]=Math.round(position[axis]/ER_GRID)*ER_GRID;
  }
 }
 position.x=limit(position.x);position.y=limit(position.y);
 return {position,guides:guides.map(g=>{const other=g.other;return g.axis==='x'?{axis:'x',value:g.value,from:Math.min(position.y,other.y)-20,to:Math.max(position.y+height,other.y+other.height)+20}:{axis:'y',value:g.value,from:Math.min(position.x,other.x)-20,to:Math.max(position.x+ER_WIDTH,other.x+other.width)+20};})};
}
function erCompactPoints(points){return points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y).filter((p,i,a)=>!i||i===a.length-1||!((a[i-1].x===p.x&&p.x===a[i+1].x)||(a[i-1].y===p.y&&p.y===a[i+1].y)));}
function erSegmentHits(a,b,r){
 const inset=2,x=r.x+inset,y=r.y+inset,right=r.x+r.width-inset,bottom=r.y+r.height-inset;
 return a.x===b.x?(a.x>x&&a.x<right&&Math.max(a.y,b.y)>y&&Math.min(a.y,b.y)<bottom):(a.y>y&&a.y<bottom&&Math.max(a.x,b.x)>x&&Math.min(a.x,b.x)<right);
}
function erRoute(source,target,sourceSide,targetSide,rects,lane=0){
 const vectors={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]},offset=30+lane*16;
 const [sx,sy]=vectors[sourceSide],[tx,ty]=vectors[targetSide];
 const a={x:source.x+sx*offset,y:source.y+sy*offset},b={x:target.x+tx*offset,y:target.y+ty*offset};
 const candidates=[[a,{x:b.x,y:a.y},b],[a,{x:a.x,y:b.y},b]];
 const near=rects.filter(r=>r.x+r.width>=Math.min(a.x,b.x)-80&&r.x<=Math.max(a.x,b.x)+80&&r.y+r.height>=Math.min(a.y,b.y)-80&&r.y<=Math.max(a.y,b.y)+80);
 const xs=[(a.x+b.x)/2,Math.min(a.x,b.x,...near.map(r=>r.x))-40-offset,Math.max(a.x,b.x,...near.map(r=>r.x+r.width))+40+offset];
 const ys=[(a.y+b.y)/2,Math.min(a.y,b.y,...near.map(r=>r.y))-40-offset,Math.max(a.y,b.y,...near.map(r=>r.y+r.height))+40+offset];
 for(const x of xs)candidates.push([a,{x,y:a.y},{x,y:b.y},b]);
 for(const y of ys)candidates.push([a,{x:a.x,y},{x:b.x,y},b]);
 for(const x of xs)for(const y of ys)candidates.push([a,{x,y:a.y},{x,y},{x:b.x,y},b]);
 const score=points=>{let distance=0,hits=0;for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];distance+=Math.abs(q.x-p.x)+Math.abs(q.y-p.y);hits+=rects.filter(r=>erSegmentHits(p,q,r)).length;}return hits*1e7+distance+points.length*12;};
 const options=candidates.map(p=>erCompactPoints([source,...p,target])).map(points=>({points,score:score(points)})).sort((a,b)=>a.score-b.score);
 const points=options[0].points;let longest=-1,label={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i],length=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);if(length>longest){longest=length;label={x:(p.x+q.x)/2,y:(p.y+q.y)/2};}}
 return {points,path:erRoundedPath(points),label,obstructed:options[0].score>=1e7};
}
function erRoundedPath(points){
 let path='M '+points[0].x+' '+points[0].y;
 for(let i=1;i<points.length-1;i++){const p=points[i-1],q=points[i],r=points[i+1];const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),radius=Math.min(8,distance(p,q)/2,distance(q,r)/2);
  const before={x:q.x+Math.sign(p.x-q.x)*radius,y:q.y+Math.sign(p.y-q.y)*radius},after={x:q.x+Math.sign(r.x-q.x)*radius,y:q.y+Math.sign(r.y-q.y)*radius};
  path+=' L '+before.x+' '+before.y+' Q '+q.x+' '+q.y+' '+after.x+' '+after.y;
 }return path+' L '+points.at(-1).x+' '+points.at(-1).y;
}
function erCardWords(card){return {'0..1':'zero or one','1':'exactly one','0..*':'zero or more','1..*':'one or more'}[card]||card;}
function erRelationshipWords(r,m=semanticModel()){
 const a=m.entities.find(e=>e.id===r.source),b=m.entities.find(e=>e.id===r.target);if(!a||!b)return '';
 return 'Each '+a.name+' can reference '+erCardWords(r.targetCard)+' '+b.name+' record'+(erMany(r.targetCard)?'s':'')+'. Each '+b.name+' can be referenced by '+erCardWords(r.sourceCard)+' '+a.name+' record'+(erMany(r.sourceCard)?'s':'')+'.';
}
