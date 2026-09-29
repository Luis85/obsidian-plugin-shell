<script setup lang="ts">
import { useFlowRuntime } from '../flow-context.ts';
import UButton from '@nuxt/ui/components/Button.vue';
import SurfaceNode from './SurfaceNode.vue';
import type { EditorStore } from '../composables/use-editor.ts';
import { useGraph } from '../composables/use-graph.ts';
const props=defineProps<{store:EditorStore}>();
const graph=useGraph(props.store,SurfaceNode);
const VueFlow=useFlowRuntime().VueFlow;
</script>
<template>
  <section class="jm-stage" aria-label="Sitemap canvas">
    <VueFlow :id="graph.id" :nodes="graph.nodes.value" :edges="graph.edges.value" :node-types="graph.nodeTypes"
      :nodes-draggable="store.available&&!store.busy&&!store.dirty&&!store.panel" :nodes-connectable="store.available&&!store.busy&&!store.dirty&&!store.panel&&store.lens!=='journey'" :apply-default="false" :min-zoom=".15" :max-zoom="1.5" :delete-key-code="null" :zoom-on-double-click="false"
      @nodes-initialized="graph.initialFit" @nodes-change="graph.nodeChanges" @node-click="graph.nodeClick"
      @node-drag-start="graph.dragStart" @node-drag-stop="graph.dragStop" @connect="graph.connect" />
    <div class="jm-canvas-note">{{ store.lens==='hierarchy'?'Drag to arrange. Use Move or connect handles to review a parent change.':store.lens==='journey'?'Journey steps reference the same pages; no application preview is opened.':'Navigation links are independent of hierarchy.' }}</div>
    <div class="jm-zoom" aria-label="Canvas controls"><UButton variant="ghost" color="neutral" @click="graph.api.zoomOut()" aria-label="Zoom out">−</UButton><UButton variant="ghost" color="neutral" :disabled="!store.available||store.busy||store.dirty" @click="store.open('arrange')">Arrange map</UButton><UButton variant="ghost" color="neutral" @click="graph.fit">Fit map</UButton><UButton variant="ghost" color="neutral" @click="graph.focus" :disabled="!store.selected">Focus</UButton><UButton variant="ghost" color="neutral" @click="graph.api.zoomIn()" aria-label="Zoom in">+</UButton></div>
  </section>
</template>
