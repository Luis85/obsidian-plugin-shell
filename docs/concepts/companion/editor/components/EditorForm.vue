<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import JourneyFields from './JourneyFields.vue';
import type { EditorStore } from '../composables/use-editor.ts';
defineProps<{store:EditorStore}>();
const titles:Record<string,string>={create:'Add a surface',move:'Move surface',route:'Set an explicit route',link:'Add a navigation link',journey:'Create a journey','journey-edit':'Edit journey',remove:'Review surface removal',arrange:'Arrange the complete map',position:'Set visual position'};
const dialog=ref<HTMLDialogElement|null>(null);
let returnFocus:HTMLElement|null=null;
onMounted(()=>{returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.value?.showModal();});
onBeforeUnmount(()=>{dialog.value?.close();returnFocus?.focus();});
</script>
<template>
  <dialog ref="dialog" class="jm-dialog ps--plugin-shell" data-plugin-ui="plugin-shell" aria-labelledby="jm-form-title" @cancel.prevent="store.cancel">
    <form @submit.prevent="store.applyForm">
      <h2 id="jm-form-title">{{ titles[store.panel] }}</h2>
      <p v-if="store.panel==='arrange'" class="jm-help">Replace the visual positions of all {{ store.snapshot?.nodes.length }} surfaces with a readable hierarchy layout. Names, routes, links, designs and hierarchy stay unchanged. This applies to the whole map, including filtered surfaces. Cancel preserves all positions; Undo restores this change.</p>
      <template v-if="store.panel==='position'"><p id="jm-position-help" class="jm-help">Only visual arrangement changes. This is the non-drag alternative to moving a card on the map.</p><label for="jm-x">X coordinate</label><input id="jm-x" type="number" step="any" min="-50000" max="50000" v-model="store.form.x" aria-describedby="jm-position-help" required /><label for="jm-y">Y coordinate</label><input id="jm-y" type="number" step="any" min="-50000" max="50000" v-model="store.form.y" aria-describedby="jm-position-help" required /></template>
      <p v-if="store.panel==='move'" class="jm-help">Only hierarchy changes. Routes, page designs and navigation references remain attached to the same identities.</p>
      <template v-if="store.panel==='create'"><label for="jm-new-name">Name</label><UInput id="jm-new-name" v-model="store.form.name" autofocus /><label for="jm-kind">Surface type</label><select id="jm-kind" v-model="store.form.kind"><option value="page">Internal page</option><option value="view">Native view</option><option value="modal">Dialog</option><option value="settings">Settings</option><option value="group">Navigation group</option></select></template>
      <template v-if="store.panel==='move'||store.panel==='create'&&['page','group'].includes(store.form.kind)"><label for="jm-parent">Parent</label><select id="jm-parent" v-model="store.form.parent"><option value="">Top level</option><option v-for="node in store.snapshot?.nodes.filter(n=>['view','page','group'].includes(n.kind))" :key="node.id" :value="node.id">{{ node.label }} · {{ node.kind }}</option></select></template>
      <template v-if="store.panel==='route'"><label for="jm-route">Route</label><UInput id="jm-route" v-model="store.form.name" placeholder="/projects/:projectId" autofocus /><p class="jm-help">Local paths only. Existing routes are not derived from page names or hierarchy.</p></template>
      <template v-if="store.panel==='link'"><label for="jm-link-name">Action label</label><UInput id="jm-link-name" v-model="store.form.name" autofocus /><label for="jm-target">Destination</label><select id="jm-target" v-model="store.form.target"><option value="">Choose a surface</option><option v-for="node in store.snapshot?.nodes.filter(n=>n.kind!=='group'&&n.id!==store.selectedId)" :value="node.id" :key="node.id">{{ node.label }}</option></select></template>
      <JourneyFields v-if="store.panel==='journey'||store.panel==='journey-edit'" :store="store" />
      <template v-if="store.panel==='remove'&&store.removal">
        <p>Removing <strong>{{ store.selected?.label }}</strong> affects {{ store.removal.links.length }} navigation links, {{ store.removal.routes.length }} routes and {{ store.removal.journeySteps.length }} journey steps.</p>
        <p v-if="store.removal.canRemove">Journey steps will remain explicitly unresolved. Undo can restore this operation.</p>
        <p v-else>Removal is blocked. Move its {{ store.removal.children.length }} children and resolve {{ store.removal.externalReferences.length }} external references first. Page designs, requirements and shared components will not be silently deleted.</p>
        <ul><li v-for="path in store.removal.externalReferences.slice(0,8)" :key="path"><code>{{ path }}</code></li></ul>
      </template>
      <p v-if="store.error" role="alert" class="jm-error">{{ store.error }}</p>
      <footer><UButton color="neutral" variant="ghost" :disabled="store.busy" @click="store.cancel">Cancel</UButton><UButton type="submit" :disabled="!store.available||store.busy||store.panel==='remove'&&!store.removal?.canRemove">{{ store.panel==='remove'?'Remove surface':'Apply' }}</UButton></footer>
    </form>
  </dialog>
</template>
