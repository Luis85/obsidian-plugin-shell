<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import SitemapGraph from './SitemapGraph.vue';
import PageInspector from './PageInspector.vue';
import EditorForm from './EditorForm.vue';
import type { EditorStore } from '../composables/use-editor.ts';
defineProps<{store:EditorStore}>();
</script>
<template>
  <section class="jm-root ps--plugin-shell" data-plugin-ui="plugin-shell" aria-label="Journey Lens sitemap editor">
    <header class="jm-toolbar"><div><h1>Sitemap</h1><span class="jm-help">{{ store.snapshot?.nodes.length??0 }} surfaces · one connected project</span></div><div class="jm-toolbar-spacer"></div><UButton variant="ghost" color="neutral" :aria-pressed="store.focused" :disabled="store.busy||store.dirty||!!store.panel" @click="store.toggleFocus">{{ store.focused?'Restore panels':'Focus canvas' }}</UButton><UButton variant="ghost" color="neutral" @click="store.go('import')">Import</UButton><UButton variant="ghost" color="neutral" @click="store.go('export')">Export JSON</UButton><UButton :disabled="!store.available||store.busy" @click="store.open('create')">Add surface</UButton></header>
    <div class="jm-context"><nav aria-label="Selected surface path"><button v-for="id in store.context?.breadcrumb" :key="id" @click="store.select(id)">{{ store.snapshot?.nodes.find(n=>n.id===id)?.label }}</button></nav><span role="status" aria-live="polite" aria-atomic="true">{{ store.saveStatus }}</span></div>
    <div class="jm-lensbar"><UButton variant="ghost" color="neutral" @click="store.treeOpen?store.treeOpen=false:store.showPanel('outline')" :aria-pressed="store.treeOpen">Outline</UButton><div class="jm-tabs" aria-label="Map lens"><button :aria-pressed="store.lens==='hierarchy'" @click="store.lens='hierarchy'">Structure</button><button :aria-pressed="store.lens==='navigation'" @click="store.lens='navigation'">Navigation</button><button :aria-pressed="store.lens==='journey'" @click="store.lens='journey'">Journeys</button></div><div class="jm-toolbar-spacer"></div><UInput v-model="store.query" placeholder="Find a surface…" aria-label="Find a surface" /><UButton v-if="!store.inspectorOpen" variant="ghost" color="neutral" @click="store.showPanel('details')">Details</UButton></div>
    <div class="jm-journeybar" v-if="store.lens==='journey'"><label for="jm-journey">Journey</label><select id="jm-journey" v-model="store.journeyId"><option value="">Choose a journey</option><option v-for="j in store.snapshot?.sitemap?.journeys??[]" :key="j.id" :value="j.id">{{ j.name }}</option></select><UButton variant="outline" color="neutral" size="sm" @click="store.open('journey')">New journey</UButton><span class="jm-help">{{ store.findings.filter(f=>f.journey===store.journeyId).length }} unresolved steps or actions</span></div>
    <p class="jm-error" role="alert" v-if="store.error&&!store.panel">{{ store.error }} <button v-if="!store.available" @click="store.load">Reload current project</button></p>
    <div class="jm-body">
      <aside v-if="store.treeOpen" class="jm-tree" aria-label="Surface outline"><header class="jm-panel-heading"><h2>Outline</h2><UButton variant="ghost" color="neutral" @click="store.treeOpen=false">Close</UButton></header><div class="jm-tree-scroll"><button v-for="n in store.projection.nodes.filter(n=>n.matched)" :key="n.id" :aria-current="store.selectedId===n.id?'true':undefined" @click="store.select(n.id)"><span>{{ n.label }}</span><small>{{ n.kind }}</small></button></div></aside>
      <SitemapGraph v-if="store.snapshot" :store="store" /><p v-else class="jm-empty">Loading the saved project…</p>
      <PageInspector v-if="store.inspectorOpen" :store="store" />
    </div>
    <footer class="jm-status"><UButton variant="ghost" color="neutral" size="sm" :disabled="!store.canUndo||store.busy" @click="store.undo">Undo</UButton><UButton variant="ghost" color="neutral" size="sm" :disabled="!store.canRedo||store.busy" @click="store.redo">Redo</UButton><span class="jm-help">Structure, routes and visual arrangement are independent.</span><UBadge color="neutral" variant="subtle">Project v6</UBadge></footer>
    <EditorForm v-if="store.panel" :store="store" />
  </section>
</template>
