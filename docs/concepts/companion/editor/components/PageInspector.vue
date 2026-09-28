<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import type { EditorStore } from '../composables/use-editor.ts';
defineProps<{store:EditorStore}>();
</script>
<template>
  <aside class="jm-inspector" aria-label="Selected surface" v-if="store.selected">
    <header class="jm-panel-heading"><h2>Surface details</h2><UButton variant="ghost" color="neutral" :disabled="store.dirty||store.busy||!!store.panel" @click="store.inspectorOpen=false" aria-label="Close surface details">Close</UButton></header>
    <div class="jm-panel-content">
      <div class="jm-tabs" aria-label="Inspector sections"><button :aria-pressed="store.tab==='details'" @click="store.tab='details'">Details</button><button :aria-pressed="store.tab==='related'" @click="store.tab='related'">Related</button></div>
      <template v-if="store.tab==='details'">
        <label for="jm-name">Name</label><UInput :disabled="store.busy" :readonly="!store.available" id="jm-name" v-model="store.draftName" @update:model-value="store.dirty=true" @keydown.enter="store.saveName" />
        <div class="jm-actions" v-if="store.dirty"><UButton size="sm" :disabled="store.busy||!store.available" @click="store.saveName">Save name</UButton><UButton size="sm" variant="ghost" color="neutral" :disabled="store.busy" @click="store.cancel">Cancel</UButton></div>
        <dl><dt>Surface</dt><dd>{{ store.selected.kind }}</dd><dt>Code name</dt><dd><code>{{ store.selected.slug }}</code></dd><dt>Route</dt><dd><code>{{ store.route?.path??'No route declared' }}</code></dd></dl>
        <UButton v-if="['page','view'].includes(store.selected.kind)" variant="outline" color="neutral" size="sm" @click="store.open('route')">Edit route</UButton>
        <p class="jm-help">Routes stay unchanged when a surface is renamed or moved.</p>
        <h3>Design and structure</h3><div class="jm-action-stack">
          <UButton v-if="['page','modal','settings'].includes(store.selected.kind)" @click="store.go('page')">Open page editor</UButton>
          <UButton variant="outline" color="neutral" @click="store.open('move')">Move surface</UButton>
          <UButton v-if="store.selected.kind!=='group'" variant="outline" color="neutral" @click="store.open('link')">Add navigation link</UButton>
        </div>
        <UButton variant="ghost" color="neutral" @click="store.open('position')">Set visual position</UButton>
        <h3>In this section</h3><button class="jm-related" v-for="id in store.context?.siblings" :key="id" @click="store.select(id)">{{ store.snapshot?.nodes.find(n=>n.id===id)?.label }}</button>
        <p v-if="!store.context?.siblings.length" class="jm-help">No sibling surfaces.</p>
        <h3>References</h3><UButton variant="ghost" color="neutral" @click="store.go('components')">Component library</UButton><UButton variant="ghost" color="neutral" @click="store.go('sources')">Source contracts</UButton>
        <hr><UButton color="error" variant="outline" size="sm" @click="store.open('remove')">Review removal</UButton>
      </template>
      <template v-else>
        <section v-for="group in [{title:'Parent',ids:store.context?.parent?[store.context.parent]:[]},{title:'Siblings',ids:store.context?.siblings??[]},{title:'Children',ids:store.context?.children??[]},{title:'Connected pages',ids:store.context?.related??[]}]" :key="group.title">
          <h3>{{ group.title }} <small>{{ group.ids.length }}</small></h3><button class="jm-related" v-for="id in group.ids" :key="id" @click="store.select(id)">{{ store.snapshot?.nodes.find(n=>n.id===id)?.label }}</button><p v-if="!group.ids.length" class="jm-help">None.</p>
        </section>
      </template>
    </div>
  </aside>
</template>
