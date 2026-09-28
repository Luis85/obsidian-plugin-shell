import { computed, markRaw, nextTick, onMounted, onBeforeUnmount, ref, watch, type Component } from 'vue';
import type { EditorStore } from './use-editor.ts';
import type { FlowNode } from '../contracts.ts';
import { arrangeSitemap } from '../../../../../scripts/companion/sitemap/arrangement.ts';

export function useGraph(s:EditorStore, nodeComponent:Component) {
  const id='journey-canvas-'+s.$id,api=window.VueFlowCore.useVueFlow(id), nodeTypes={surface:markRaw(nodeComponent)};
  const zoom=ref(1), dragBefore=ref<string|null>(null);
  const positions=computed(()=>s.snapshot?arrangeSitemap(s.snapshot):{});
  const nodes=computed(()=>{
    return s.projection.nodes.map(node=>({id:node.id,type:'surface',selected:node.id===s.selectedId,
      position:positions.value[node.id]??{x:0,y:0},data:node}));
  });
  const edges=computed(()=>s.projection.edges.map(e=>({id:e.id,source:e.source,target:e.target,type:'smoothstep',label:e.label,
    selectable:false,style:{stroke:e.kind==='journey'?'var(--jm-accent)':'var(--jm-line)',strokeWidth:e.kind==='journey'?2:1.2},
    markerEnd:e.kind==='hierarchy'?undefined:'arrowclosed'})));
  const fit=()=>api.fitView({padding:.16,minZoom:.3,maxZoom:1,duration:0});
  const focus=()=>{const n=nodes.value.find(n=>n.id===s.selectedId);if(n)void api.setCenter(n.position.x+108,n.position.y+50,{zoom:.9,duration:0});};
  const nodeChanges=(changes:Array<{type:string}>)=>api.applyNodeChanges(changes.filter(c=>['position','dimensions','select'].includes(c.type)));
  const dragStart=()=>{dragBefore.value=s.snapshot?JSON.stringify(s.snapshot):null;};
  const dragStop=async({node}:{node:FlowNode})=>{
    if(!s.canLeave()){api.setNodes(nodes.value);return;}
    if(dragBefore.value!==JSON.stringify(s.snapshot)){s.error='The project changed while dragging. Position was not saved.';api.setNodes(nodes.value);return;}
    if(!await s.commit({type:'arrange',positions:{[node.id]:{x:node.position.x,y:node.position.y}}}))api.setNodes(nodes.value);
  };
  const connect=({source,target}:{source:string|null;target:string|null})=>{if(source&&target)s.proposeMove(target,source);};
  watch(()=>s.snapshot,()=>nextTick(()=>{if(nodes.value.length&&zoom.value===1){void fit();zoom.value=0;}}));
  onMounted(()=>nextTick(fit));
  onBeforeUnmount(()=>api.$destroy());
  return {id,api,nodeTypes,nodes,edges,fit,focus,nodeChanges,dragStart,dragStop,connect,nodeClick:({node}:{node:FlowNode})=>s.select(node.id)};
}
