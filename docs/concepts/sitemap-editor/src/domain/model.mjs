/** Framework-independent sitemap model. Rendering positions never change routes. */
export const SCHEMA = 'companion.sitemap'
export const VERSION = 2
export const MAX_PAGES = 500
export const TYPES = ['page', 'container', 'contextual', 'external']
export const STATUSES = ['Active', 'Draft', 'Archived']
export const ROLES = ['Admin', 'Product Manager', 'Project Owner', 'Member', 'Guest']
export const clone = value => JSON.parse(JSON.stringify(value))
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}-${Math.random().toString(36).slice(2)}`
export const getPage = (doc, id) => doc.pages.find(p => p.id === id)
export const children = (doc, id) => doc.pages.filter(p => p.parentId === id)
export const root = doc => doc.pages.find(p => p.parentId === null)
export function descendants(doc, id) {
  const visited = new Set([id]), result = [], queue = [...children(doc, id)]
  while (queue.length) {
    const p = queue.shift()
    if (visited.has(p.id)) continue
    visited.add(p.id); result.push(p); queue.push(...children(doc, p.id))
  }
  return result
}
export function ancestors(doc, id) {
  const result = [], visited = new Set([id]); let p = getPage(doc, id)
  while (p?.parentId) {
    p = getPage(doc, p.parentId)
    if (!p || visited.has(p.id)) break
    visited.add(p.id); result.unshift(p)
  }
  return result
}
export function ordered(doc) {
  const result = [], visited = new Set()
  const walk = (p, depth) => { if (!p || visited.has(p.id)) return; visited.add(p.id); result.push({ ...p, depth }); children(doc, p.id).forEach(c => walk(c, depth + 1)) }
  walk(root(doc), 0); return result
}
export function routeKey(route) {
  return route.replace(/\/$/, '').replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param') || '/'
}
export function checkRoute(doc, page) {
  if (page.type === 'container') return page.route ? 'Containers do not have routes.' : ''
  const r = (page.route || '').trim()
  if (page.type === 'external') {
    try { const u = new URL(r); return ['http:', 'https:'].includes(u.protocol) ? '' : 'Use an HTTP or HTTPS link.' } catch { return 'Enter a valid HTTP or HTTPS URL.' }
  }
  if (!r.startsWith('/') || r.startsWith('//') || /[\s?#<>]/.test(r) || /\/\//.test(r)) return 'Use an absolute route such as /projects/:projectId/tasks, without spaces or query strings.'
  if (doc.pages.some(p => p.id !== page.id && p.type !== 'container' && p.type !== 'external' && routeKey(p.route) === routeKey(r))) return 'Another page already uses this route pattern.'
  return ''
}
export function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The file must contain a sitemap object.')
  if (!['companion.journey-lens', SCHEMA].includes(raw.schema)) throw new Error('Unsupported schema. Import a Journey Lens v1 or Sitemap v2 export.')
  if (raw.schema === SCHEMA && raw.version !== VERSION) throw new Error('Unsupported sitemap version.')
  if (raw.schema === 'companion.journey-lens' && raw.version !== 1) throw new Error('Unsupported legacy version.')
  if (!Array.isArray(raw.pages) || !raw.pages.length || raw.pages.length > MAX_PAGES) throw new Error(`Import between 1 and ${MAX_PAGES} pages.`)
  const text = (v, fallback = '', max = 4000) => typeof v === 'string' ? v.slice(0, max) : fallback
  const ids = new Set()
  const pages = raw.pages.map(p => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id.trim() || p.id.length > 150 || ids.has(p.id)) throw new Error('Each page requires a unique ID (maximum 150 characters).')
    ids.add(p.id)
    if (typeof p.title !== 'string' || !p.title.trim()) throw new Error(`Page ${p.id} requires a title.`)
    if (!TYPES.includes(p.type)) throw new Error(`Invalid page type on ${p.title}.`)
    if (p.parentId !== null && typeof p.parentId !== 'string') throw new Error(`Invalid parent on ${p.title}.`)
    if (typeof p.route !== 'string') throw new Error(`Invalid route on ${p.title}.`)
    return {
      id: p.id, parentId: p.parentId, title: p.title.trim().slice(0, 100), route: p.route.trim().slice(0, 500), type: p.type,
      icon: text(p.icon, 'page', 50), description: text(p.description, '', 240), purpose: text(p.purpose, '', 1600),
      layoutId: text(p.layoutId, '', 150), componentIds: Array.isArray(p.componentIds) ? [...new Set(p.componentIds.filter(v => typeof v === 'string'))] : [],
      status: STATUSES.includes(p.status) ? p.status : 'Draft', access: ['public', 'members', 'restricted'].includes(p.access) ? p.access : 'members',
      roles: Array.isArray(p.roles) ? [...new Set(p.roles.filter(v => ROLES.includes(v)))] : ['Admin', 'Member'],
      nav: ['primary', 'contextual', 'hidden'].includes(p.nav) ? p.nav : 'contextual',
      breadcrumbs: p.breadcrumbs !== false, tabsEnabled: p.tabsEnabled === true,
      navItems: Array.isArray(p.navItems) ? [...new Set(p.navItems.filter(v => typeof v === 'string'))] : [], notes: text(p.notes, '', 2000)
    }
  })
  if (pages.filter(p => p.parentId === null).length !== 1) throw new Error('The sitemap must have exactly one root container.')
  if (pages.find(p => p.parentId === null).type !== 'container') throw new Error('The root must be a non-routable container.')
  const doc = { schema: SCHEMA, version: VERSION, workspace: { id: text(raw.workspace?.id, 'sitemap'), name: text(raw.workspace?.name, 'Untitled sitemap', 100), description: text(raw.workspace?.description, '', 1000) }, pages, layouts: [], components: [], journeys: [], positions: {} }
  for (const key of ['layouts', 'components']) {
    const items = raw[key] ?? []
    if (!Array.isArray(items) || items.length > 500) throw new Error(`Invalid ${key} collection.`)
    const known = new Set()
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || known.has(item.id) || typeof item.name !== 'string') throw new Error(`Invalid or duplicate ${key} ID.`)
      known.add(item.id)
      // Keep metadata from previous editors intact; these are references, not screens.
      doc[key].push(clone(item))
    }
  }
  for (const p of pages) {
    if (p.parentId !== null && !ids.has(p.parentId)) throw new Error(`Missing parent for ${p.title}.`)
    if (getPage(doc, p.parentId)?.type === 'external') throw new Error('External links cannot contain pages.')
    const chain = new Set([p.id]); let parent = getPage(doc, p.parentId)
    while (parent) { if (chain.has(parent.id)) throw new Error(`Circular hierarchy at ${p.title}.`); chain.add(parent.id); parent = getPage(doc, parent.parentId) }
    const issue = checkRoute(doc, p); if (issue) throw new Error(`${p.title}: ${issue}`)
    if (p.layoutId && !doc.layouts.some(l => l.id === p.layoutId)) throw new Error(`Missing layout reference on ${p.title}.`)
    if (p.componentIds.some(id => !doc.components.some(c => c.id === id))) throw new Error(`Missing component reference on ${p.title}.`)
    if (p.navItems.some(id => !ids.has(id))) throw new Error(`Missing navigation target on ${p.title}.`)
    if (p.navItems.includes(p.id)) throw new Error(`A page cannot link to itself in its secondary navigation: ${p.title}.`)
  }
  if (raw.journeys != null && !Array.isArray(raw.journeys)) throw new Error('Invalid journeys collection.')
  const journeyIds = new Set()
  doc.journeys = (raw.journeys || []).map(j => {
    if (!j || typeof j.id !== 'string' || !j.id || journeyIds.has(j.id) || !Array.isArray(j.steps) || j.steps.length < 2 || j.steps.length > 60) throw new Error('Each journey requires a unique ID and 2–60 steps.')
    journeyIds.add(j.id)
    if (j.steps.some(s => !s || !ids.has(s.pageId) || getPage(doc, s.pageId)?.type === 'container')) throw new Error(`Missing or non-routable page in journey ${j.name || j.id}.`)
    return { id: j.id, name: text(j.name, 'Untitled journey', 100), purpose: text(j.purpose ?? j.description, '', 1000), role: ROLES.includes(j.role) ? j.role : 'Member', steps: j.steps.map(s => ({ pageId: s.pageId, action: text(s.action, '', 160) })) }
  })
  for (const [id, pos] of Object.entries(raw.positions || {})) {
    if (ids.has(id) && typeof pos?.x === 'number' && Number.isFinite(pos.x) && typeof pos?.y === 'number' && Number.isFinite(pos.y) && Math.abs(pos.x) < 100000 && Math.abs(pos.y) < 100000) doc.positions[id] = { x: pos.x, y: pos.y }
  }
  return doc
}
export function move(doc, id, parentId) {
  const p = getPage(doc, id), parent = getPage(doc, parentId)
  if (!p || p.parentId === null) throw new Error('The root cannot be moved.')
  if (!parent || parent.type === 'external') throw new Error('Choose a page or container as the parent.')
  if (id === parentId || descendants(doc, id).some(p => p.id === parentId)) throw new Error('A page cannot be moved into its own branch.')
  p.parentId = parentId; doc.positions = {}; return doc
}
export function addPage(doc, { title, parentId, type = 'page', route = '' }) {
  if (doc.pages.length >= MAX_PAGES) throw new Error(`The prototype supports up to ${MAX_PAGES} pages.`)
  const parent = getPage(doc, parentId)
  if (!parent || parent.type === 'external') throw new Error('Choose a valid parent page.')
  if (!title?.trim()) throw new Error('Enter a page name.')
  if (!TYPES.includes(type)) throw new Error('Invalid page type.')
  const p = { id: uid(), parentId, title: title.trim().slice(0, 100), type, route: type === 'container' ? '' : route.trim(), description: '', purpose: '', icon: type === 'container' ? 'folder' : 'page', layoutId: parent.layoutId, componentIds: [], status: 'Draft', access: parent.access, roles: [...parent.roles], nav: 'contextual', breadcrumbs: true, tabsEnabled: false, navItems: [], notes: '' }
  const error = checkRoute(doc, p); if (error) throw new Error(error)
  doc.pages.push(p); doc.positions = {}; return p
}
export function updatePage(doc, id, patch) {
  const p = getPage(doc, id); if (!p) throw new Error('Page not found.')
  const safeKeys = ['title', 'route', 'type', 'description', 'purpose', 'status', 'layoutId', 'componentIds', 'access', 'roles', 'nav', 'breadcrumbs', 'tabsEnabled', 'navItems', 'notes']
  const next = { ...p }
  for (const key of safeKeys) if (Object.hasOwn(patch, key)) next[key] = clone(patch[key])
  if (!next.title?.trim()) throw new Error('Page name cannot be empty.')
  next.title = next.title.trim().slice(0, 100)
  if (p.parentId === null && next.type !== 'container') throw new Error('The root must remain a container.')
  if (next.type === 'external' && children(doc, id).length) throw new Error('Move or remove child pages before changing this page into an external link.')
  next.route = String(next.route || '').trim()
  if (next.type === 'container') next.route = ''
  const error = checkRoute(doc, next); if (error) throw new Error(error)
  const candidate = clone(doc); candidate.pages[candidate.pages.findIndex(p => p.id === id)] = next
  validate(candidate)
  Object.assign(p, next); return p
}
export function duplicate(doc, id) {
  const p = getPage(doc, id)
  if (!p || p.parentId === null) throw new Error('The root cannot be duplicated.')
  if (doc.pages.length >= MAX_PAGES) throw new Error('Page limit reached.')
  let route = p.route
  if (p.type !== 'container' && p.type !== 'external') {
    // Add a literal segment, not a suffix on a parameter name (same route pattern).
    const base = p.route.replace(/\/$/, '') + '/copy'
    route = base; let i = 2
    while (checkRoute(doc, { ...p, id: '', route })) route = `${base}-${i++}`
  }
  const copy = { ...clone(p), id: uid(), title: `${p.title.slice(0, 90)} copy`, route, status: 'Draft' }
  doc.pages.push(copy); doc.positions = {}; return copy
}
export function removePage(doc, id, includeChildren = false) {
  const page = getPage(doc, id)
  if (!page || page.parentId === null) throw new Error('The root cannot be deleted.')
  const removed = new Set([id, ...(includeChildren ? descendants(doc, id).map(p => p.id) : [])])
  if (!includeChildren) children(doc, id).forEach(p => { p.parentId = page.parentId })
  doc.pages = doc.pages.filter(p => !removed.has(p.id))
  doc.pages.forEach(p => { p.navItems = p.navItems.filter(id => !removed.has(id)) })
  doc.journeys = doc.journeys.map(j => ({ ...j, steps: j.steps.filter(s => !removed.has(s.pageId)) })).filter(j => j.steps.length >= 2)
  doc.positions = {}; return page.parentId
}
export function allowed(page, role) {
  return role === 'All roles' || page.access === 'public' || (page.access === 'members' && role !== 'Guest') || (page.access === 'restricted' && page.roles.includes(role))
}
export function checks(doc) {
  const issues = []
  for (const p of doc.pages) {
    if (p.type !== 'container' && !p.purpose.trim()) issues.push({ id: p.id, message: 'Add a purpose', detail: 'Explain the task this page helps people complete.' })
    if (p.access === 'restricted' && !p.roles.length) issues.push({ id: p.id, message: 'No audience selected', detail: 'No selected role can access this page.' })
    if (p.tabsEnabled && !p.navItems.length) issues.push({ id: p.id, message: 'Empty secondary navigation', detail: 'Add a destination or turn secondary navigation off.' })
  }
  return issues
}
/** Compact generational layout; coordinates can be overridden by node dragging. */
export function layout(doc, { collapsed = [], focusId = null, usePositions = true } = {}) {
  const hidden = new Set(collapsed.flatMap(id => descendants(doc, id).map(p => p.id)))
  let visible = ordered(doc).filter(p => !hidden.has(p.id))
  if (focusId && getPage(doc, focusId)) {
    const scope = new Set([...ancestors(doc, focusId).map(p => p.id), focusId, ...descendants(doc, focusId).map(p => p.id)])
    visible = visible.filter(p => scope.has(p.id))
  }
  const levels = new Map()
  for (const p of visible) { if (!levels.has(p.depth)) levels.set(p.depth, []); levels.get(p.depth).push(p) }
  const maxWidth = Math.max(1, ...[...levels.values()].map(r => r.length)) * 206 - 24
  const result = []
  for (const [depth, row] of levels) row.forEach((p, i) => result.push({ page: p, position: usePositions && doc.positions?.[p.id] ? clone(doc.positions[p.id]) : { x: (maxWidth - (row.length * 206 - 24)) / 2 + i * 206, y: depth * 165 }, width: 182, height: 94 }))
  return result
}
