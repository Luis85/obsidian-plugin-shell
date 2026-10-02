import { computed, ref, watch } from 'vue'
import example from '../data/example.json'
import * as model from '../domain/model.mjs'

const KEY = 'journey-lens.sitemap-editor.v2'
export function useSitemap() {
  let initial = model.validate(example), startup = '', initialSaveState = 'Local document'
  try { const saved = localStorage.getItem(KEY); if (saved) { initial = model.validate(JSON.parse(saved)); initialSaveState = 'Saved locally' } } catch { initialSaveState = 'Not persisted'; startup = 'Stored data could not be loaded. The example is open; import a backup to recover your sitemap.' }
  const document = ref(initial)
  const selectedId = ref(model.getPage(initial, 'project') ? 'project' : model.root(initial).id)
  const past = ref([]), future = ref([]), notice = ref(startup), saveState = ref(initialSaveState)
  const treeOpen = ref(false), inspectorOpen = ref(window.innerWidth > 760), view = ref('map'), inspectorTab = ref('details')
  const collapsed = ref(initial.pages.filter(p => model.children(initial, p.id).length && !['workspace', 'projects', 'project'].includes(p.id)).map(p => p.id))
  const focusId = ref(null), query = ref(''), statusFilter = ref('All statuses'), typeFilter = ref('All types'), role = ref('All roles'), journeyId = ref('')
  const showLabels = ref(true), showMinimap = ref(true)
  const selected = computed(() => model.getPage(document.value, selectedId.value) || model.root(document.value))
  const selectionPath = computed(() => model.ancestors(document.value, selected.value.id))
  const siblingPages = computed(() => model.children(document.value, selected.value.parentId).filter(p => p.id !== selected.value.id))
  const childPages = computed(() => model.children(document.value, selected.value.id))
  const issueList = computed(() => model.checks(document.value))
  const activeJourney = computed(() => document.value.journeys.find(j => j.id === journeyId.value))
  let noticeTimer
  function notify(message) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.value = '', 5500) }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(document.value)); saveState.value = 'Saved locally' }
    catch { saveState.value = 'Session only'; notify('Browser storage is unavailable. Export JSON before closing.') }
  }
  function commit(label, action) {
    const before = model.clone(document.value), next = model.clone(document.value)
    try {
      const result = action(next)
      model.validate(next)
      if (JSON.stringify(before) === JSON.stringify(next)) return result
      past.value.push({ label, data: before }); if (past.value.length > 60) past.value.shift()
      future.value = []; document.value = next; save(); notify(label); return result
    } catch (error) { notify(error.message); throw error }
  }
  function restore(snapshot) {
    document.value = snapshot
    if (!model.getPage(snapshot, selectedId.value)) selectedId.value = model.root(snapshot).id
    if (focusId.value && !model.getPage(snapshot, focusId.value)) focusId.value = null
    if (!snapshot.journeys.some(j => j.id === journeyId.value)) journeyId.value = ''
    collapsed.value = collapsed.value.filter(id => model.getPage(snapshot, id)); save()
  }
  function undo() { const entry = past.value.pop(); if (!entry) return; future.value.push({ label: entry.label, data: model.clone(document.value) }); restore(entry.data); notify(`Undone: ${entry.label}`) }
  function redo() { const entry = future.value.pop(); if (!entry) return; past.value.push({ label: entry.label, data: model.clone(document.value) }); restore(entry.data); notify(`Redone: ${entry.label}`) }
  function select(id) {
    if (!model.getPage(document.value, id)) return
    selectedId.value = id
    const parents = model.ancestors(document.value, id).map(p => p.id)
    collapsed.value = collapsed.value.filter(v => !parents.includes(v))
    if (focusId.value && id !== focusId.value && !parents.includes(focusId.value)) focusId.value = null
    inspectorOpen.value = true
    if (window.innerWidth < 1000) treeOpen.value = false
  }
  function patch(patch) { return commit('Page updated', doc => model.updatePage(doc, selected.value.id, patch)) }
  function toggleBranch(id) { collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(v => v !== id) : [...collapsed.value, id] }
  function matches(page) {
    const q = query.value.trim().toLowerCase()
    return (!q || `${page.title} ${page.route} ${page.purpose}`.toLowerCase().includes(q)) && (statusFilter.value === 'All statuses' || statusFilter.value === page.status) && (typeFilter.value === 'All types' || typeFilter.value === page.type)
  }
  const hasFilters = computed(() => Boolean(query.value || statusFilter.value !== 'All statuses' || typeFilter.value !== 'All types'))
  const matchingPages = computed(() => model.ordered(document.value).filter(matches))
  function clearFilters() { query.value = ''; statusFilter.value = 'All statuses'; typeFilter.value = 'All types' }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(document.value, null, 2)], { type: 'application/json' })
    download(blob, `${document.value.workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sitemap.json`)
    notify('JSON exported. Includes page, navigation, journey and reference data.')
  }
  function download(blob, name) { const url = URL.createObjectURL(blob); const link = globalThis.document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000) }
  watch(activeJourney, j => { if (j) { role.value = j.role; collapsed.value = collapsed.value.filter(id => !j.steps.some(s => model.ancestors(document.value, s.pageId).some(p => p.id === id))); focusId.value = null } })
  return { document, selectedId, selected, past, future, notice, saveState, treeOpen, inspectorOpen, view, inspectorTab, collapsed, focusId, query, statusFilter, typeFilter, role, journeyId, showLabels, showMinimap, selectionPath, siblingPages, childPages, issueList, activeJourney, hasFilters, matchingPages, notify, commit, undo, redo, select, patch, toggleBranch, matches, clearFilters, exportJSON, download }
}
