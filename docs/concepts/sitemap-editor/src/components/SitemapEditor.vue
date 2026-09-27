<script setup>
import { computed, reactive, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import PageNode from './PageNode.vue'
import PageTree from './PageTree.vue'
import PageInspector from './PageInspector.vue'
import ToolButton from './ToolButton.vue'
import Icon from './Icon.vue'
import { useSitemap } from '../composables/useSitemap'
import * as m from '../domain/model.mjs'

const s = reactive(useSitemap())
const { fitView, zoomIn, zoomOut, setCenter, viewport } = useVueFlow({ id: 'sitemap-editor' })
const fileInput = ref(null), searchInput = ref(null)
const dialog = ref(''), formError = ref(''), pendingImport = ref(null), movingId = ref(''), deleteBranch = ref(false)
const form = reactive({ title: '', route: '', type: 'page', parentId: '', journeyName: '', journeyRole: 'Member', steps: [] })
const dialogOpen = computed({ get: () => Boolean(dialog.value), set: value => { if (!value) dialog.value = '' } })
const title = computed(() => ({ add: 'Add a page', move: 'Move page', delete: 'Delete page', import: 'Review JSON import', help: 'Editor guide', checks: 'Sitemap checks', pageMenu: s.selected.title, journey: 'Create a journey' }[dialog.value] || 'Sitemap editor'))
const description = computed(() => ({ add: 'Create a page in the sitemap. You can refine its details afterwards.', move: 'Choose a new parent. Existing routes and navigation references stay unchanged.', delete: 'Choose what happens to this page and its children.', import: 'Replace the current sitemap only after reviewing the file. This can be undone.', help: 'An editor surface, not a simulated application.', checks: 'Review the structure and intent of your pages.', pageMenu: 'Page-specific sitemap operations.', journey: 'Highlight a sequence of existing pages without opening a simulated application.' }[dialog.value] || ''))
const parentOptions = computed(() => {
  const excluded = dialog.value === 'move' ? new Set([movingId.value, ...m.descendants(s.document, movingId.value).map(p => p.id)]) : new Set()
  return m.ordered(s.document).filter(p => p.type !== 'external' && !excluded.has(p.id)).map(p => ({ label: `${'· '.repeat(Math.min(p.depth, 5))}${p.title}`, value: p.id }))
})
const pageOptions = computed(() => s.document.pages.filter(p => p.type !== 'container').map(p => ({ label: `${p.title} · ${p.route}`, value: p.id })))
const pathIds = computed(() => new Set([...s.selectionPath.map(p => p.id), s.selected.id]))
const journeyPageIds = computed(() => new Set(s.activeJourney?.steps.map(p => p.pageId) || []))
const positions = computed(() => m.layout(s.document, { collapsed: s.collapsed, focusId: s.focusId }))
const nodes = computed(() => positions.value.map(({ page, position }) => ({
  id: page.id, type: 'page', position,
  selected: page.id === s.selectedId,
  data: {
    page, selected: page.id === s.selectedId, ancestor: pathIds.value.has(page.id), childCount: m.children(s.document, page.id).length,
    collapsed: s.collapsed.includes(page.id), showLabels: s.showLabels,
    dimmed: (s.hasFilters && !s.matches(page)) || (s.activeJourney && !journeyPageIds.value.has(page.id) && page.type !== 'container'),
    restricted: !m.allowed(page, s.role), inJourney: journeyPageIds.value.has(page.id),
    actions: { collapse: id => { s.toggleBranch(id); nextTick(fit) }, menu: id => { s.select(id); open('pageMenu') } }
  }
})))
const edges = computed(() => {
  const ids = new Set(nodes.value.map(n => n.id))
  const result = s.document.pages.filter(p => p.parentId && ids.has(p.id) && ids.has(p.parentId)).map(p => ({
    id: `hierarchy:${p.id}`, source: p.parentId, target: p.id, type: 'smoothstep',
    style: { stroke: !s.activeJourney && pathIds.value.has(p.id) ? '#35d6c9' : '#415363', strokeWidth: !s.activeJourney && pathIds.value.has(p.id) ? 1.8 : 1.25 },
    selectable: false
  }))
  const steps = s.activeJourney?.steps || []
  for (let i = 0; i < steps.length - 1; i++) if (ids.has(steps[i].pageId) && ids.has(steps[i + 1].pageId)) result.push({
    id: `journey:${i}`, source: steps[i].pageId, target: steps[i + 1].pageId, type: 'bezier',
    label: steps[i].action || `${i + 1} → ${i + 2}`, animated: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#38dfd0' }, style: { stroke: '#38dfd0', strokeWidth: 2.5 },
    labelStyle: { fill: '#061c1d', fontWeight: 600, fontSize: 11 }, labelBgStyle: { fill: '#54e4d6' }, labelBgPadding: [8, 5], labelBgBorderRadius: 4, selectable: false
  })
  return result
})
const journeyItems = computed(() => [{ label: 'No journey overlay', value: '__none' }, ...s.document.journeys.map(j => ({ label: j.name, value: j.id }))])
const journeySelection = computed({ get: () => s.journeyId || '__none', set: value => { s.journeyId = value === '__none' ? '' : value } })
const mappedCount = computed(() => s.document.pages.filter(p => p.type !== 'container').length)
const menuItems = computed(() => [
  [{ label: 'Import JSON…', onSelect: () => fileInput.value?.click() }, { label: 'Export JSON', onSelect: s.exportJSON }, { label: 'Export map as SVG', onSelect: exportSVG }],
  [{ label: 'Expand all branches', onSelect: () => { s.collapsed = []; nextTick(fit) } }, { label: 'Reset node positions', onSelect: autoLayout }, { label: 'Create journey…', onSelect: openJourney }],
  [{ label: 'Help & keyboard shortcuts', onSelect: () => open('help') }]
])
function fit() { if (s.view === 'map') fitView({ padding: .12, minZoom: .15, maxZoom: 1.08, duration: 180 }) }
function centerSelected() {
  const n = nodes.value.find(n => n.id === s.selected.id)
  if (n) setCenter(n.position.x + 91, n.position.y + 47, { zoom: Math.max(viewport.value.zoom, .85), duration: 220 })
}
function selectAndCenter(id) { s.select(id); nextTick(centerSelected) }
function toggleTree() { s.treeOpen = !s.treeOpen; if (s.treeOpen && innerWidth < 1000) s.inspectorOpen = false; nextTick(fit) }
function toggleInspector() { s.inspectorOpen = !s.inspectorOpen; if (s.inspectorOpen && innerWidth < 1000) s.treeOpen = false; nextTick(fit) }
function open(name) { formError.value = ''; dialog.value = name }
function openAdd(parentId = s.selected.type === 'external' ? s.selected.parentId : s.selected.id) {
  form.title = ''; form.route = ''; form.type = 'page'; form.parentId = parentId; open('add')
}
function suggestRoute() {
  if (form.route || form.type === 'container' || form.type === 'external') return
  const parentRoute = m.getPage(s.document, form.parentId)?.route || ''
  const slug = form.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (slug) form.route = `${parentRoute.replace(/\/$/, '')}/${slug}`
}
function openMove(id = s.selected.id, parentId) { movingId.value = id; form.parentId = parentId || m.getPage(s.document, id).parentId; open('move') }
function openDelete() { deleteBranch.value = false; open('delete') }
function openJourney() { form.journeyName = ''; form.journeyRole = 'Member'; const fallback = pageOptions.value[0]?.value; form.steps = [{ pageId: s.selected.type === 'container' ? fallback : s.selected.id, action: 'Continue' }, { pageId: s.childPages.find(p => p.type !== 'container')?.id || fallback, action: '' }]; open('journey') }
function submit() {
  try {
    if (dialog.value === 'add') {
      const page = s.commit('Page added', doc => m.addPage(doc, form)); s.select(page.id)
    } else if (dialog.value === 'move') s.commit('Page moved. Routes unchanged.', doc => m.move(doc, movingId.value, form.parentId))
    else if (dialog.value === 'delete') { const parentId = s.commit('Page removed and references cleaned up', doc => m.removePage(doc, s.selected.id, deleteBranch.value)); s.select(parentId) }
    else if (dialog.value === 'import') {
      s.commit('Sitemap imported', doc => { Object.keys(doc).forEach(k => delete doc[k]); Object.assign(doc, m.clone(pendingImport.value)) }); s.selectedId = m.root(s.document).id; s.collapsed = []; s.journeyId = ''; s.focusId = null; s.clearFilters(); pendingImport.value = null
    } else if (dialog.value === 'journey') {
      if (!form.journeyName.trim()) throw new Error('Enter a journey name.')
      if (form.steps.length < 2 || form.steps.some(step => !step.pageId)) throw new Error('Select at least two page destinations.')
      const id = m.uid()
      s.commit('Journey created', doc => doc.journeys.push({ id, name: form.journeyName.trim(), purpose: '', role: form.journeyRole, steps: m.clone(form.steps) })); s.journeyId = id
    }
    dialog.value = ''; awaitFit()
  } catch (error) { formError.value = error.message }
}
function awaitFit() { nextTick(() => setTimeout(fit, 60)) }
function patch(patch) { try { s.patch(patch) } catch { /* Notification preserves the valid model and explains rejection. */ } }
function duplicate() { try { const page = s.commit('Page duplicated', doc => m.duplicate(doc, s.selected.id)); s.select(page.id); dialog.value = ''; awaitFit() } catch {} }
function autoLayout() { try { s.commit('Automatic layout restored', doc => { doc.positions = {} }); awaitFit() } catch {} }
function onDragStop({ node }) { try { s.commit('Node position saved', doc => { doc.positions[node.id] = { x: node.position.x, y: node.position.y } }) } catch {} }
function onConnect({ source, target }) {
  if (!source || !target || source === target) return
  try { m.move(m.clone(s.document), target, source); openMove(target, source) } catch (error) { s.notify(error.message) }
}
async function importFile(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
  if (file.size > 3 * 1024 * 1024) return s.notify('File is too large. Import a JSON file below 3 MB.')
  try { pendingImport.value = m.validate(JSON.parse(await file.text())); open('import') } catch (error) { s.notify(`Import rejected: ${error.message}`) }
}
function exportSVG() {
  const items = positions.value, byId = new Map(items.map(n => [n.page.id, n]))
  const minX = Math.min(0, ...items.map(n => n.position.x)) - 35, minY = Math.min(0, ...items.map(n => n.position.y)) - 35
  const width = Math.max(...items.map(n => n.position.x + 182)) - minX + 35, height = Math.max(...items.map(n => n.position.y + 94)) - minY + 35
  const escape = v => String(v).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
  const lines = items.map(n => { const a = byId.get(n.page.parentId); if (!a) return ''; const sx = a.position.x + 91, sy = a.position.y + 94, ex = n.position.x + 91, ey = n.position.y; return `<path d="M${sx} ${sy}V${(sy+ey)/2}H${ex}V${ey}" stroke="#526570" fill="none"/>` }).join('')
  const cards = items.map(({ page: p, position: a }) => `<g transform="translate(${a.x},${a.y})"><rect width="182" height="94" rx="8" fill="#14212a" stroke="${p.id===s.selectedId?'#42dccc':'#3b505d'}"/><text x="13" y="28" fill="#edf4f7" font-size="13" font-weight="600">${escape(p.title.slice(0,22))}</text><text x="13" y="48" fill="#9cafbd" font-size="9">${escape((p.route||'Organizational group').slice(0,31))}</text><text x="13" y="77" fill="#70bdb8" font-size="10">${escape(p.type)}</text></g>`).join('')
  s.download(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" font-family="system-ui,sans-serif"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#0d161e"/>${lines}${cards}</svg>`], { type: 'image/svg+xml' }), 'application-sitemap.svg')
  s.notify('SVG exported: current visible hierarchy. Journey overlays are not included.')
}
function onKey(event) {
  const input = event.target.closest('input,textarea,select,[contenteditable="true"],[role="combobox"]')
  if (dialog.value) return
  const modifier = event.ctrlKey || event.metaKey
  if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.value?.inputRef?.focus(); return }
  if (input) return
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? s.redo() : s.undo(); return }
  if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); s.exportJSON(); return }
  if (event.key === '0') fit()
  if (event.key.toLowerCase() === 'f') centerSelected()
  if (event.key.toLowerCase() === 'n' && !modifier) openAdd()
  if (event.key === 'Delete' && s.selected.parentId !== null) openDelete()
  if (event.key === 'Escape') { s.focusId = null; s.journeyId = ''; if (innerWidth < 1000) { s.treeOpen = false; s.inspectorOpen = false } }
}
let observer
onMounted(() => { window.addEventListener('keydown', onKey); observer = new ResizeObserver(() => { /* Vue Flow observes its own canvas size. Keep the user's viewport. */ }); const stage = window.document.querySelector('.canvas-stage'); if (stage) observer.observe(stage) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); observer?.disconnect() })
</script>

<template>
  <div class="sitemap-editor" :class="{ 'tree-open': s.treeOpen, 'inspector-open': s.inspectorOpen }">
    <a class="skip-link" href="#sitemap-canvas">Skip to editor</a>
    <header class="editor-toolbar" aria-label="Sitemap editor tools">
      <ToolButton icon="panel" label="Toggle page tree" :active="s.treeOpen" @click="toggleTree" />
      <div class="editor-title"><h1>Application sitemap</h1><span>{{ s.document.workspace.name.replace(/ Workspace$/, '') }} <span class="title-dot">/</span> {{ mappedCount }} pages</span></div>
      <div class="toolbar-divider"></div>
      <div class="view-switch" role="group" aria-label="Sitemap view"><UButton :variant="s.view==='map'?'soft':'ghost'" :color="s.view==='map'?'primary':'neutral'" :aria-pressed="s.view==='map'" @click="s.view='map'; awaitFit()"><Icon name="sitemap" /><span>Map</span></UButton><UButton :variant="s.view==='outline'?'soft':'ghost'" :color="s.view==='outline'?'primary':'neutral'" :aria-pressed="s.view==='outline'" @click="s.view='outline'"><Icon name="list" /><span>Outline</span></UButton></div>
      <div class="toolbar-spacer"></div>
      <UInput ref="searchInput" v-model="s.query" aria-label="Search pages and routes" placeholder="Search pages…" class="toolbar-search"><template #leading><Icon name="search" /></template><template #trailing><kbd>⌘ K</kbd></template></UInput>
      <ToolButton icon="undo" label="Undo" :disabled="!s.past.length" @click="s.undo" /><ToolButton icon="redo" label="Redo" :disabled="!s.future.length" @click="s.redo" />
      <div class="toolbar-divider"></div>
      <ToolButton icon="panel" label="Toggle page inspector" :active="s.inspectorOpen" @click="toggleInspector" />
      <UDropdownMenu :items="menuItems"><ToolButton icon="more" label="Import, export and editor actions" /></UDropdownMenu>
      <UButton class="add-page-button" @click="openAdd()"><Icon name="plus" /><span>Add page</span></UButton>
    </header>
    <div class="editor-context">
      <div class="context-breadcrumb"><button @click="s.focusId=null; s.clearFilters(); awaitFit()">All pages</button><template v-for="p in [...s.selectionPath,s.selected].filter(p=>p.parentId!==null)" :key="p.id"><Icon name="chevron-right" /><button :class="{current:p.id===s.selected.id}" @click="selectAndCenter(p.id)">{{ p.title }}</button></template></div>
      <div class="context-actions"><span class="save-status" :class="{warning:s.saveState==='Session only'}"><span></span>{{ s.saveState }}</span><ToolButton icon="help" label="Editor guide" @click="open('help')" /></div>
    </div>
    <div class="editor-body">
      <PageTree v-if="s.treeOpen" :document="s.document" :selected-id="s.selectedId" :collapsed="s.collapsed" :query="s.query" @select="selectAndCenter" @toggle="s.toggleBranch($event); awaitFit()" @close="toggleTree" @search="s.query=$event" @expand="s.collapsed=[]; awaitFit()" />
      <main id="sitemap-canvas" class="canvas-stage" tabindex="-1" aria-label="Application sitemap">
        <div class="canvas-options">
          <div class="canvas-option-group"><UPopover><UButton color="neutral" variant="ghost" :class="{ 'filter-active':s.hasFilters }"><Icon name="filter" /><span>Filters</span><span v-if="s.hasFilters" class="active-dot"></span></UButton><template #content><div class="filter-popover"><h3>Filter pages</h3><label>Status</label><USelect v-model="s.statusFilter" :items="['All statuses','Active','Draft','Archived']" class="w-full" /><label>Type</label><USelect v-model="s.typeFilter" :items="['All types', ...m.TYPES]" class="w-full" /><UButton variant="ghost" @click="s.clearFilters">Clear filters</UButton></div></template></UPopover><span class="micro-divider"></span><Icon name="journey" /><USelect v-model="journeySelection" :items="journeyItems" aria-label="Journey overlay" class="journey-select" @update:model-value="awaitFit" /></div>
          <div class="canvas-option-group audience-control"><label>View as</label><USelect v-model="s.role" :items="['All roles',...m.ROLES]" aria-label="Audience visibility preview" /></div>
        </div>
        <div v-if="s.focusId || s.activeJourney || s.hasFilters" class="canvas-context-note"><Icon :name="s.activeJourney?'journey':s.focusId?'target':'filter'" /><span v-if="s.activeJourney">{{ s.activeJourney.name }} <small>· {{ s.activeJourney.steps.length }} steps · design intent only</small></span><span v-else-if="s.focusId">Focus: {{ m.getPage(s.document,s.focusId)?.title }}</span><span v-else>{{ s.matchingPages.length }} matches · context remains visible</span><button @click="s.focusId=null;s.journeyId='';s.clearFilters();awaitFit()">Clear</button></div>
        <div class="flow-wrap" v-show="s.view === 'map'">
          <VueFlow id="sitemap-editor" :nodes="nodes" :edges="edges" :min-zoom=".15" :max-zoom="2" :default-edge-options="{type:'smoothstep'}" :delete-key-code="null" :nodes-connectable="true" :snap-to-grid="true" :snap-grid="[12,12]" :zoom-on-double-click="false" :pan-on-scroll="false" :nodes-draggable="true" :selection-on-drag="false" fit-view-on-init @nodes-initialized="fit" @node-click="({node})=>s.select(node.id)" @node-drag-stop="onDragStop" @connect="onConnect" @node-double-click="({node})=>{s.select(node.id);s.focusId=node.id;awaitFit()}">
            <Background :gap="22" :size="1" pattern-color="#233440" />
            <template #node-page="props"><PageNode v-bind="props" /></template>
            <MiniMap v-if="s.showMinimap" pannable zoomable :node-color="n=>n.data?.selected?'#40d9cb':n.data?.ancestor?'#28665f':'#293d4a'" mask-color="#0a151dbc" :node-stroke-width="0" />
          </VueFlow>
          <div class="canvas-legend"><span><i class="legend-dot page"></i>Page</span><span><i class="legend-dot container"></i>Container</span><span><i class="legend-dot contextual"></i>Contextual</span></div>
          <div class="floating-zoom"><ToolButton icon="minus" label="Zoom out" @click="zoomOut({duration:120})" /><span>{{ Math.round(viewport.zoom*100) }}%</span><ToolButton icon="plus" label="Zoom in" @click="zoomIn({duration:120})" /><span class="micro-divider"></span><ToolButton icon="fit" label="Fit visible pages (0)" @click="fit" /><ToolButton icon="target" label="Center selected page (F)" @click="centerSelected" /></div>
          <div v-if="s.hasFilters&&!s.matchingPages.length" class="no-match-message"><Icon name="search" /><strong>No matching pages</strong><p>Try another name or reset your filters.</p><UButton variant="soft" @click="s.clearFilters">Clear filters</UButton></div>
        </div>
        <div v-if="s.view==='outline'" class="outline-wrap"><table><thead><tr><th>Page</th><th>Route</th><th>Type</th><th>Status</th><th>Access</th></tr></thead><tbody><tr v-for="p in s.matchingPages" :key="p.id" :class="{selected:p.id===s.selectedId}" @click="s.select(p.id)"><td><button class="outline-name" :style="{paddingLeft:`${Math.min(p.depth,10)*15}px`}" @click.stop="s.select(p.id)"><Icon :name="p.icon" /><strong>{{ p.title }}</strong></button></td><td><code>{{ p.route||'Not routable' }}</code></td><td>{{ p.type }}</td><td><UBadge :color="p.status==='Active'?'primary':'neutral'" variant="subtle" size="sm">{{ p.status }}</UBadge></td><td>{{ p.access }}</td></tr></tbody></table><div v-if="!s.matchingPages.length" class="empty-message"><h3>No matching pages</h3><UButton variant="ghost" @click="s.clearFilters">Clear filters</UButton></div></div>
        <footer class="editor-statusbar"><span>{{ mappedCount }} pages <span>·</span> {{ nodes.length }} visible nodes</span><button @click="open('checks')" :class="{'has-issues':s.issueList.length}"><Icon :name="s.issueList.length?'warning':'check-circle'" />{{ s.issueList.length ? `${s.issueList.length} checks` : 'All clear' }}</button><span class="status-hint">Drag to arrange <span>·</span> Connect handles to change parent</span><label><USwitch v-model="s.showLabels" size="xs" aria-label="Show page descriptions" /><span>Labels</span></label><ToolButton icon="map" label="Toggle minimap" :active="s.showMinimap" @click="s.showMinimap=!s.showMinimap" /></footer>
      </main>
      <PageInspector v-if="s.inspectorOpen" :page="s.selected" :document="s.document" :tab="s.inspectorTab" :role="s.role" @patch="patch" @select="selectAndCenter" @tab="s.inspectorTab=$event" @close="toggleInspector" @add="openAdd" @move="openMove()" @duplicate="duplicate" @delete="openDelete" @focus="s.focusId=s.selectedId;awaitFit()" />
    </div>
    <div v-if="s.notice" class="editor-notice" role="status"><Icon name="info" /><span>{{ s.notice }}</span><button aria-label="Dismiss notification" @click="s.notice=''"><Icon name="x" /></button></div>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importFile" />
    <UModal v-model:open="dialogOpen" :title="title" :description="description" :ui="{content:'max-w-lg'}">
      <template #body>
        <form id="editor-dialog-form" class="dialog-form" @submit.prevent="submit">
          <template v-if="dialog==='add'">
            <label for="new-page-name">Page name</label><UInput id="new-page-name" v-model="form.title" placeholder="e.g. Project timeline" autofocus required maxlength="100" @blur="suggestRoute" class="w-full" />
            <label for="new-page-parent">Parent</label><USelect id="new-page-parent" v-model="form.parentId" :items="parentOptions" class="w-full" />
            <label for="new-page-type">Type</label><USelect id="new-page-type" v-model="form.type" :items="[{label:'Standard page',value:'page'},{label:'Container',value:'container'},{label:'Contextual page',value:'contextual'},{label:'External link',value:'external'}]" class="w-full" />
            <template v-if="form.type!=='container'"><label for="new-page-route">{{ form.type==='external'?'External URL':'Route' }}</label><UInput id="new-page-route" v-model="form.route" :placeholder="form.type==='external'?'https://example.com':'/projects/:projectId/timeline'" required class="w-full" /></template>
          </template>
          <template v-else-if="dialog==='move'"><div class="move-summary"><Icon name="page" /><div><strong>{{ m.getPage(s.document,movingId)?.title }}</strong><code>{{ m.getPage(s.document,movingId)?.route }}</code></div></div><label>New parent</label><USelect v-model="form.parentId" :items="parentOptions" aria-label="New parent page" class="w-full" /><div class="safe-change"><Icon name="lock" />Routes and navigation links will not change.</div></template>
          <template v-else-if="dialog==='delete'"><p>Remove <strong>{{ s.selected.title }}</strong> from the sitemap?</p><div v-if="s.childPages.length" class="field-row"><label>Also delete {{ m.descendants(s.document,s.selected.id).length }} descendant pages</label><USwitch v-model="deleteBranch" aria-label="Also delete descendants" /></div><p class="muted-copy">{{ deleteBranch?'The entire branch will be removed.':'Children will move to the current parent.' }} Navigation references are cleaned up and journeys with fewer than two remaining steps are removed. Undo restores them.</p></template>
          <template v-else-if="dialog==='import'&&pendingImport"><div class="import-summary"><h3>{{ pendingImport.workspace.name }}</h3><div>{{ pendingImport.pages.length }} nodes · {{ pendingImport.journeys.length }} journeys</div><div>{{ pendingImport.layouts.length }} layout references · {{ pendingImport.components.length }} component references</div></div><div class="safe-change"><Icon name="check-circle" />Hierarchy, routes and references validated.</div><p class="muted-copy">The current document is replaced. Export a backup first, or use Undo after importing.</p><UButton variant="outline" color="neutral" @click="s.exportJSON">Export current sitemap first</UButton></template>
          <template v-else-if="dialog==='pageMenu'"><div class="page-action-list"><UButton color="neutral" variant="ghost" :disabled="s.selected.type==='external'" @click="openAdd()"><Icon name="plus" />Add child page</UButton><UButton color="neutral" variant="ghost" @click="s.focusId=s.selected.id;dialog='';awaitFit()"><Icon name="target" />Focus this branch</UButton><UButton color="neutral" variant="ghost" :disabled="s.selected.parentId===null" @click="openMove()"><Icon name="move" />Move page…</UButton><UButton color="neutral" variant="ghost" :disabled="s.selected.parentId===null" @click="duplicate"><Icon name="copy" />Duplicate page</UButton><UButton color="error" variant="ghost" :disabled="s.selected.parentId===null" @click="openDelete"><Icon name="trash" />Delete page…</UButton></div></template>
          <template v-else-if="dialog==='journey'"><label>Journey name</label><UInput v-model="form.journeyName" placeholder="e.g. Review project tasks" required class="w-full" /><label>Audience</label><USelect v-model="form.journeyRole" :items="m.ROLES" class="w-full" /><div v-for="(step,i) in form.steps" :key="i" class="journey-step"><span>{{ i+1 }}</span><div><USelect v-model="step.pageId" :items="pageOptions" aria-label="Journey page" class="w-full" /><UInput v-model="step.action" placeholder="Action to the next page" aria-label="Journey action" class="w-full" /></div><ToolButton icon="x" label="Remove step" :disabled="form.steps.length<=2" @click="form.steps.splice(i,1)" /></div><UButton variant="outline" :disabled="form.steps.length>=60" @click="form.steps.push({pageId:pageOptions[0]?.value,action:''})">Add step</UButton></template>
          <template v-else-if="dialog==='checks'"><button v-for="(issue,i) in s.issueList" :key="i" type="button" class="check-item" @click="selectAndCenter(issue.id);dialog=''"><Icon name="warning" /><span><strong>{{ m.getPage(s.document,issue.id)?.title }}: {{ issue.message }}</strong><small>{{ issue.detail }}</small></span><Icon name="chevron-right" /></button><p v-if="!s.issueList.length">All checked pages have a purpose, valid navigation intent and an audience.</p></template>
          <template v-else-if="dialog==='help'"><div class="help-body"><h3>Structure, not a simulated app</h3><p>All controls belong to the sitemap. The left panel is the page tree; the right inspector provides page metadata and nearby destinations.</p><h3>Three separate relationships</h3><p><b>Hierarchy</b> defines parent and child pages. <b>Navigation</b> links existing pages. <b>Journey overlays</b> describe a user path. Moving a node on the canvas changes its position only.</p><h3>Safe structural changes</h3><p>Connect one page's bottom handle to another page's top handle to propose a new parent, then confirm. Or use Move in the inspector. Routes are preserved and cycles are rejected.</p><div class="shortcut-grid"><kbd>N</kbd><span>Add page</span><kbd>F</kbd><span>Center selected page</span><kbd>0</kbd><span>Fit visible pages</span><kbd>Ctrl / ⌘ Z</kbd><span>Undo</span><kbd>Ctrl / ⌘ Shift Z</kbd><span>Redo</span><kbd>Ctrl / ⌘ S</kbd><span>Export JSON</span><kbd>Delete</kbd><span>Delete with confirmation</span></div><h3>Keep a portable backup</h3><p>Use the toolbar menu to export JSON. Browser storage is convenient, not a backup. Legacy Journey Lens v1 files are accepted. Audience previews express design intent and do not enforce permissions.</p></div></template>
          <div v-if="formError" role="alert" class="form-error"><Icon name="warning" />{{ formError }}</div>
        </form>
      </template>
      <template #footer><div class="dialog-footer"><UButton color="neutral" variant="outline" @click="dialog=''">{{ ['help','checks','pageMenu'].includes(dialog)?'Close':'Cancel' }}</UButton><UButton v-if="['add','move','delete','import','journey'].includes(dialog)" :color="dialog==='delete'?'error':'primary'" type="submit" form="editor-dialog-form">{{ {add:'Create page',move:'Move page',delete:'Delete page',import:'Replace sitemap',journey:'Create journey'}[dialog] }}</UButton></div></template>
    </UModal>
  </div>
</template>
