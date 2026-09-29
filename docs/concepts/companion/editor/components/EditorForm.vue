<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import JourneyFields from './JourneyFields.vue';
import type { EditorStore } from '../composables/use-editor.ts';
defineProps<{store:EditorStore}>();
const titles:Record<string,string>={create:'Add a surface',move:'Move surface',route:'Set an explicit route',link:'Add a navigation link','link-edit':'Edit navigation link','record-remove':'Review record removal',journey:'Create a journey','journey-edit':'Edit journey',remove:'Review surface removal',arrange:'Arrange the complete map',position:'Set visual position'};
const dialog=ref<HTMLDialogElement|null>(null);
let returnFocus:HTMLElement|null=null;
onMounted(()=>{const active=dialog.value?.ownerDocument.activeElement;returnFocus=active&&'focus' in active?active as HTMLElement:null;dialog.value?.showModal();});
onBeforeUnmount(()=>{dialog.value?.close();if(returnFocus?.isConnected)returnFocus.focus();});
</script>
<template>
  <dialog ref="dialog" class="jm-dialog" :class="store.ownerClass" :data-plugin-ui="store.ownerId" :aria-labelledby="store.domId('jm-form-title')" @cancel.prevent="store.cancel">
    <form @submit.prevent="store.applyForm">
      <h2 :id="store.domId('jm-form-title')">{{ titles[store.panel] }}</h2>
      <fieldset class="jm-form-fields" :disabled="store.busy">
      <p v-if="store.panel==='arrange'" class="jm-help">Replace the visual positions of all {{ store.snapshot?.nodes.length }} surfaces with a readable hierarchy layout. Names, routes, links, designs and hierarchy stay unchanged. This applies to the whole map, including filtered surfaces. Cancel preserves all positions; Undo restores this change.</p>
      <template v-if="store.panel==='position'"><p :id="store.domId('jm-position-help')" class="jm-help">Only visual arrangement changes. This is the non-drag alternative to moving a card on the map.</p><label :for="store.domId('jm-x')">X coordinate</label><input :id="store.domId('jm-x')" type="number" step="any" min="-50000" max="50000" v-model="store.form.x" :aria-describedby="store.domId('jm-position-help')" required /><label :for="store.domId('jm-y')">Y coordinate</label><input :id="store.domId('jm-y')" type="number" step="any" min="-50000" max="50000" v-model="store.form.y" :aria-describedby="store.domId('jm-position-help')" required /></template>
      <p v-if="store.panel==='move'" class="jm-help">Only hierarchy changes. Routes, page designs and navigation references remain attached to the same identities.</p>
      <template v-if="store.panel==='create'"><label :for="store.domId('jm-new-name')">Name</label><UInput :id="store.domId('jm-new-name')" v-model="store.form.name" autofocus /><label :for="store.domId('jm-kind')">Surface type</label><select :id="store.domId('jm-kind')" v-model="store.form.kind"><option value="page">Internal page</option><option value="view">Native view</option><option value="modal">Dialog</option><option value="settings">Settings</option><option value="group">Navigation group</option></select></template>
      <template v-if="store.panel==='move'||store.panel==='create'&&['page','group'].includes(store.form.kind)"><label :for="store.domId('jm-parent')">Parent</label><select :id="store.domId('jm-parent')" v-model="store.form.parent"><option value="">Top level</option><option v-for="node in store.snapshot?.nodes.filter(n=>['view','page','group'].includes(n.kind))" :key="node.id" :value="node.id">{{ node.label }} · {{ node.kind }}</option></select></template>
      <template v-if="store.panel==='route'"><label :for="store.domId('jm-route')">Route</label><UInput :id="store.domId('jm-route')" v-model="store.form.name" placeholder="/projects/:projectId" autofocus /><p class="jm-help">Local paths only. Existing routes are not derived from page names or hierarchy.</p></template>
      <template v-if="store.panel==='link'||store.panel==='link-edit'"><label :for="store.domId('jm-link-name')">Action label</label><UInput :id="store.domId('jm-link-name')" v-model="store.form.name" autofocus /><label :for="store.domId('jm-target')">Destination</label><select :id="store.domId('jm-target')" v-model="store.form.target"><option value="">Choose a surface</option><option v-for="node in store.snapshot?.nodes.filter(n=>n.kind!=='group'&&n.id!==store.selectedId)" :value="node.id" :key="node.id">{{ node.label }}</option></select><label :for="store.domId('jm-link-kind')">Action kind</label><select :id="store.domId('jm-link-kind')" v-model="store.form.linkKind"><option value="auto">Match destination</option><option value="navigate">Navigate</option><option value="open">Open dialog</option><option value="conditional">Conditional planning intent</option></select><p class="jm-help">Conditional intent is not an executable business rule. Changing a destination keeps the action ID and leaves affected journey steps unresolved.</p></template>
      <template v-if="store.panel==='move'"><label :for="store.domId('jm-before')">Place before</label><select :id="store.domId('jm-before')" v-model="store.form.before"><option value="">End of section</option><option v-for="node in store.snapshot?.nodes.filter(n=>n.id!==store.selectedId&&n.parent===(store.form.parent||null))" :key="node.id" :value="node.id">{{ node.label }}</option></select></template>
      <template v-if="store.panel==='record-remove'&&store.recordRemoval"><p>Remove {{ store.recordRemoval.kind }} <strong>{{ store.recordRemoval.label }}</strong>?</p><p>{{ store.recordRemoval.journeySteps.length }} incoming journey references remain explicitly unresolved. Other project sections are not modified.</p><p v-if="!store.recordRemoval.canRemove">Removal is blocked by external references. Resolve them first.</p><ul><li v-for="path in store.recordRemoval.references.slice(0,8)" :key="path"><code>{{ path }}</code></li></ul></template>
      <JourneyFields v-if="store.panel==='journey'||store.panel==='journey-edit'" :store="store" />
      <template v-if="store.panel==='remove'&&store.removal">
        <p>Removing <strong>{{ store.selected?.label }}</strong> affects {{ store.removal.links.length }} navigation links, {{ store.removal.routes.length }} routes and {{ store.removal.journeySteps.length }} journey steps.</p>
        <p v-if="store.removal.canRemove">Journey steps will remain explicitly unresolved. Undo can restore this operation.</p>
        <p v-else>Removal is blocked. Move its {{ store.removal.children.length }} children and resolve {{ store.removal.externalReferences.length }} external references first. Page designs, requirements and shared components will not be silently deleted.</p>
        <ul><li v-for="path in store.removal.externalReferences.slice(0,8)" :key="path"><code>{{ path }}</code></li></ul>
      </template>
      <p v-if="store.error" role="alert" class="jm-error">{{ store.error }}</p>
      </fieldset>
      <footer><UButton color="neutral" variant="ghost" :disabled="store.busy" @click="store.cancel">Cancel</UButton><UButton type="submit" :disabled="!store.available||store.busy||store.panel==='remove'&&!store.removal?.canRemove||store.panel==='record-remove'&&!store.recordRemoval?.canRemove">{{ store.panel==='remove'?'Remove surface':'Apply' }}</UButton></footer>
    </form>
  </dialog>
</template>
