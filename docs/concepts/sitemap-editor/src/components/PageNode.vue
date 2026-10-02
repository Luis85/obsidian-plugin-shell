<script setup>
import { Handle, Position } from '@vue-flow/core'
import Icon from './Icon.vue'
defineProps({ id: String, data: Object, selected: Boolean })
</script>
<template>
  <article class="page-node" :class="{ 'is-selected': data.selected, 'is-dimmed': data.dimmed, 'is-restricted': data.restricted, 'in-journey': data.inJourney, 'is-ancestor': data.ancestor }" :data-page-id="id">
    <Handle v-if="data.page.parentId !== null" type="target" :position="Position.Top" class="hierarchy-handle" />
    <div class="page-node-heading">
      <span class="page-node-icon" :class="data.page.type"><Icon :name="data.page.icon" /></span>
      <div class="page-node-text"><strong :title="data.page.title">{{ data.page.title }}</strong><code :title="data.page.route">{{ data.page.route || 'Organizational group' }}</code></div>
      <button class="node-menu nodrag nopan" :aria-label="`Page actions: ${data.page.title}`" @click.stop="data.actions.menu(id)"><Icon name="more" /></button>
    </div>
    <p v-if="data.showLabels">{{ data.page.description || data.page.purpose || 'Add a page purpose' }}</p>
    <div class="node-meta"><span :class="`type-label ${data.page.type}`">{{ data.page.type === 'contextual' ? 'Contextual page' : data.page.type === 'container' ? 'Container' : data.page.type === 'external' ? 'External link' : 'Page' }}</span><Icon v-if="data.restricted" name="lock" /><span v-else-if="data.page.status === 'Draft'" class="draft-label">Draft</span></div>
    <button v-if="data.childCount" class="branch-toggle nodrag nopan" :aria-label="`${data.collapsed ? 'Expand' : 'Collapse'} ${data.page.title}`" @click.stop="data.actions.collapse(id)"><Icon :name="data.collapsed ? 'plus' : 'minus'" /><span>{{ data.childCount }}</span></button>
    <Handle v-if="data.page.type !== 'external'" type="source" :position="Position.Bottom" class="hierarchy-handle" />
  </article>
</template>
