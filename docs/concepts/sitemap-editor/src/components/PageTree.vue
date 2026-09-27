<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import ToolButton from './ToolButton.vue'
import { ordered, children, descendants } from '../domain/model.mjs'
const props = defineProps({ document: Object, selectedId: String, collapsed: Array, query: String })
const emit = defineEmits(['select', 'toggle', 'close', 'search', 'expand'])
const rows = computed(() => {
  const all = ordered(props.document), q = props.query.trim().toLowerCase()
  if (q) return all.filter(p => `${p.title} ${p.route}`.toLowerCase().includes(q))
  const hidden = new Set(props.collapsed.flatMap(id => descendants(props.document, id).map(p => p.id)))
  return all.filter(p => !hidden.has(p.id))
})
</script>
<template>
  <aside class="page-tree panel" aria-label="Sitemap page tree">
    <div class="panel-heading"><h2>Pages <span>{{ document.pages.filter(p => p.type !== 'container').length }}</span></h2><ToolButton icon="panel" label="Close page tree" @click="emit('close')" /></div>
    <div class="tree-search"><UInput :model-value="query" placeholder="Find a page…" aria-label="Find a page" @update:model-value="emit('search', $event)" class="w-full" /></div>
    <div class="tree-caption"><span>PAGE HIERARCHY</span><button @click="emit('expand')">Expand all</button></div>
    <div class="tree-scroll" role="list" aria-label="Page hierarchy">
      <div v-for="p in rows" :key="p.id" role="listitem" class="tree-row" :class="{ selected: p.id === selectedId }" :style="{ paddingLeft: `${12 + Math.min(p.depth, 10) * 14}px` }">
        <button v-if="children(document, p.id).length" class="tree-chevron" :aria-label="`${collapsed.includes(p.id) ? 'Expand' : 'Collapse'} ${p.title}`" :aria-expanded="!collapsed.includes(p.id)" @click="emit('toggle', p.id)"><Icon :name="collapsed.includes(p.id) ? 'chevron-right' : 'chevron-down'" /></button><span v-else class="tree-chevron"></span>
        <button class="tree-select" :aria-current="p.id === selectedId ? 'true' : undefined" @click="emit('select', p.id)"><Icon :name="p.icon" /><span>{{ p.title }}</span><small v-if="children(document, p.id).length">{{ children(document, p.id).length }}</small></button>
      </div>
      <div v-if="!rows.length" class="empty-message">No matching pages.</div>
    </div>
    <div class="tree-foot"><Icon name="shield" /><span>Structure changes do not change routes.</span></div>
  </aside>
</template>
