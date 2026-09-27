import { computed, markRaw, nextTick, onMounted, onBeforeUnmount, ref, watch, type Component } from 'vue';
import type { EditorStore } from './use-editor.ts';
import type { FlowNode } from '../contracts.ts';

export function useGraph(s:EditorStore, nodeComponent:Component) {
  const id='journey-canvas',api=window.VueFlowCore.useVueFlow(id), nodeTypes={surface:markRaw(nodeComponent)};
  const zoom=ref(1), dragBefore=ref<string|null>(null);
  const nodes=computed(()=>{
    const rows=new Map<number,number>(),byId=new Map(s.projection.nodes.map(n=>[n.id,n]));
    return s.projection.nodes.map(node=>{
      let depth=0,parent=node.parent;while(parent){depth++;parent=byId.get(parent)?.parent??null;}
      const index=rows.get(depth)??0;rows.set(depth,index+1);
      return {id:node.id,type:'surface',selected:node.id===s.selectedId,
        position:node.position??{x:(index%4)*256+depth*30,y:depth*180+Math.floor(index/4)*156},data:node};
    });
  });
  const edges=computed(()=>s.projection.edges.map(e=>({id:e.id,source:e.source,target:e.target,type:'smoothstep',label:e.label,
    selectable:false,style:{stroke:e.kind==='journey'?'var(--jm-accent)':'var(--jm-line)',strokeWidth:e.kind==='journey'?2:1.2},
    markerEnd:e.kind==='hierarchy'?undefined:'arrowclosed'})));
  const fit=()=>api.fitView({padding:.16,minZoom:.3,maxZoom:1,duration:0});
  const focus=()=>{const n=nodes.value.find(n=>n.id===s.selectedId);if(n)void api.setCenter(n.position.x+108,n.position.y+50,{zoom:.9,duration:0});};
  const nodeChanges=(changes:Array<{type:string}>)=>api.applyNodeChanges(changes.filter(c=>['position','dimensions','select'].includes(c.type)));
  const dragStart=()=>{dragBefore.value=s.snapshot?JSON.stringify(s.snapshot):null;};
  const dragStop=async({node}:{node:FlowNode})=>{
    if(!s.canLeave())return;
    if(dragBefore.value!==JSON.stringify(s.snapshot)){s.error='The project changed while dragging. Position was not saved.';return;}
    await s.commit({type:'arrange',positions:{[node.id]:{x:node.position.x,y:node.position.y}}});
  };
  const connect=({source,target}:{source:string|null;target:string|null})=>{if(source&&target)s.proposeMove(target,source);};
  watch(()=>s.snapshot,()=>nextTick(()=>{if(nodes.value.length&&zoom.value===1){void fit();zoom.value=0;}}));
  onMounted(()=>nextTick(fit));
  onBeforeUnmount(()=>api.$destroy());
  return {id,api,nodeTypes,nodes,edges,fit,focus,nodeChanges,dragStart,dragStop,connect,nodeClick:({node}:{node:FlowNode})=>s.select(node.id)};
}
