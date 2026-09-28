import { computed, markRaw, nextTick, onBeforeUnmount, ref, type Component } from 'vue';
import type { EditorStore } from './use-editor.ts';
import type { FlowNode } from '../contracts.ts';
import { sitemapDisplayLayout } from '../../../../../scripts/companion/sitemap/layout.ts';

export function useGraph(s:EditorStore, nodeComponent:Component) {
  const id='journey-canvas',api=window.VueFlowCore.useVueFlow(id), nodeTypes={surface:markRaw(nodeComponent)};
  const fitted=ref(false), dragBefore=ref<string|null>(null);
  const nodes=computed(()=>{
    const positions=sitemapDisplayLayout(s.projection.nodes);
    return s.projection.nodes.map(node=>({id:node.id,type:'surface',selected:node.id===s.selectedId,
      position:positions[node.id]!,data:node,draggable:s.available&&!s.busy&&!s.dirty&&!s.panel}));
  });
  const edges=computed(()=>s.projection.edges.map(e=>({id:e.id,source:e.source,target:e.target,type:'smoothstep',label:e.label,
    selectable:false,style:{stroke:e.kind==='journey'?'var(--jm-accent)':'var(--jm-line)',strokeWidth:e.kind==='journey'?2:1.2},
    markerEnd:e.kind==='hierarchy'?undefined:'arrowclosed'})));
  const fit=()=>api.fitView({padding:.16,minZoom:.15,maxZoom:1,duration:0});
  const initialFit=()=>{if(!fitted.value&&nodes.value.length){fitted.value=true;void nextTick(fit);}};
  const focus=()=>{const n=nodes.value.find(n=>n.id===s.selectedId);if(n)void api.setCenter(n.position.x+109,n.position.y+56,{zoom:.9,duration:0});};
  const nodeChanges=(changes:Array<{type:string}>)=>api.applyNodeChanges(changes.filter(c=>['position','dimensions','select'].includes(c.type)));
  const dragStart=()=>{dragBefore.value=s.snapshot?JSON.stringify(s.snapshot):null;};
  const dragStop=async({node}:{node:FlowNode})=>{
    if(!s.canLeave())return;
    if(dragBefore.value!==JSON.stringify(s.snapshot)){s.error='The project changed while dragging. Position was not saved.';return;}
    await s.commit({type:'arrange',positions:{[node.id]:{x:node.position.x,y:node.position.y}}});
  };
  const arrange=async()=>{if(s.canLeave()&&await s.commit({type:'arrange',positions:sitemapDisplayLayout(s.projection.nodes,false)}))await nextTick(fit);};
  const connect=({source,target}:{source:string|null;target:string|null})=>{if(source&&target)s.proposeConnection(source,target);};
  onBeforeUnmount(()=>api.$destroy());
  return {id,api,nodeTypes,nodes,edges,fit,initialFit,focus,arrange,nodeChanges,dragStart,dragStop,connect,nodeClick:({node}:{node:FlowNode})=>s.select(node.id)};
}
