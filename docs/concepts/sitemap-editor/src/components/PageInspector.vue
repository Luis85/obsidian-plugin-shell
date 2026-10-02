<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import ToolButton from './ToolButton.vue'
import { getPage, children, ancestors, ROLES, allowed } from '../domain/model.mjs'
const props = defineProps({ page: Object, document: Object, tab: String, role: String })
const emit = defineEmits(['patch', 'select', 'close', 'tab', 'add', 'move', 'duplicate', 'delete', 'focus'])
const draft = ref({}), linkTarget = ref('')
watch(() => props.page, p => { draft.value = JSON.parse(JSON.stringify(p)) }, { immediate: true, deep: true })
const parent = computed(() => getPage(props.document, props.page.parentId))
const siblings = computed(() => children(props.document, props.page.parentId).filter(p => p.id !== props.page.id))
const childPages = computed(() => children(props.document, props.page.id))
const inbound = computed(() => props.document.pages.filter(p => p.navItems.includes(props.page.id)))
const targets = computed(() => props.document.pages.filter(p => p.id !== props.page.id && p.type !== 'container' && !props.page.navItems.includes(p.id)).map(p => ({ label: `${p.title} · ${p.route}`, value: p.id })))
const navPages = computed(() => props.page.navItems.map(id => getPage(props.document, id)).filter(Boolean))
const tabs = [{ value: 'details', label: 'Details' }, { value: 'related', label: 'Related' }, { value: 'navigation', label: 'Navigation' }, { value: 'access', label: 'Access' }]
function save(field) { emit('patch', { [field]: draft.value[field] }) }
function toggleRole(role, enabled) { emit('patch', { roles: enabled ? [...props.page.roles, role] : props.page.roles.filter(r => r !== role) }) }
function addLink() { if (!linkTarget.value) return; emit('patch', { navItems: [...props.page.navItems, linkTarget.value], tabsEnabled: true }); linkTarget.value = '' }
function moveLink(index, direction) { const items = [...props.page.navItems], to = index + direction; if (to < 0 || to >= items.length) return; [items[index], items[to]] = [items[to], items[index]]; emit('patch', { navItems: items }) }
</script>
<template>
  <aside class="page-inspector panel" aria-label="Selected page inspector">
    <div class="panel-heading"><h2>Page details</h2><div class="inline"><ToolButton icon="target" label="Focus this branch" @click="emit('focus')" /><ToolButton icon="x" label="Close page inspector" @click="emit('close')" /></div></div>
    <div class="inspector-identity"><span class="identity-icon"><Icon :name="page.icon" /></span><div><strong>{{ page.title }}</strong><code>{{ page.route || 'Non-routable container' }}</code></div><UBadge :color="page.status === 'Active' ? 'primary' : 'neutral'" variant="subtle" size="sm">{{ page.status }}</UBadge></div>
    <div class="inspector-tabs" role="tablist" aria-label="Inspector sections"><button v-for="item in tabs" :key="item.value" role="tab" :aria-selected="tab === item.value" :class="{ active: tab === item.value }" @click="emit('tab', item.value)">{{ item.label }}<span v-if="item.value === 'related'">{{ siblings.length + childPages.length }}</span></button></div>
    <div class="inspector-scroll" role="tabpanel">
      <template v-if="tab === 'details'">
        <section class="inspector-section">
          <label class="field-label" for="page-title">Page name</label><UInput id="page-title" v-model="draft.title" @blur="save('title')" @keydown.enter="$event.target.blur()" class="w-full" maxlength="100" />
          <label class="field-label" for="page-purpose">Purpose</label><UTextarea id="page-purpose" v-model="draft.purpose" @blur="save('purpose')" placeholder="What should this page help people do?" :rows="3" maxlength="1600" class="w-full" />
          <label class="field-label" for="page-route">Route</label><UInput id="page-route" v-model="draft.route" @blur="save('route')" :disabled="page.type === 'container'" @keydown.enter="$event.target.blur()" class="w-full route-input" />
          <div class="route-note"><Icon name="lock" /><span>Independent of its position in the sitemap.</span></div>
          <div class="field-row"><label>Type</label><USelect :model-value="page.type" :disabled="page.parentId === null" :items="[{label:'Standard page',value:'page'},{label:'Container',value:'container'},{label:'Contextual page',value:'contextual'},{label:'External link',value:'external'}]" @update:model-value="emit('patch', { type: $event })" /></div>
          <div class="field-row"><label>Layout</label><USelect :model-value="page.layoutId || '__none'" :items="[{label:'No layout',value:'__none'},...document.layouts.map(l=>({label:l.name,value:l.id}))]" @update:model-value="emit('patch', { layoutId: $event === '__none' ? '' : $event })" /></div>
          <div class="field-row"><label>Status</label><USelect :model-value="page.status" :items="['Active','Draft','Archived']" @update:model-value="emit('patch', { status: $event })" /></div>
        </section>
        <section class="inspector-section"><div class="section-heading"><h3>In this section</h3><button @click="emit('tab','related')">View related</button></div><div class="relation-mini" v-if="parent"><Icon name="folder" /><button @click="emit('select',parent.id)">{{ parent.title }}</button><span>{{ siblings.length }} siblings</span></div><p v-else class="muted-copy">Root of the application structure.</p><div class="sibling-chips"><button v-for="p in siblings.slice(0,4)" :key="p.id" @click="emit('select',p.id)">{{ p.title }}</button><button v-if="siblings.length>4" @click="emit('tab','related')">+{{ siblings.length-4 }}</button></div></section>
        <section class="inspector-section"><label class="field-label" for="page-notes">Notes</label><UTextarea id="page-notes" v-model="draft.notes" @blur="save('notes')" placeholder="Decisions, constraints, open questions…" :rows="3" maxlength="2000" class="w-full" /></section>
      </template>
      <template v-else-if="tab === 'related'">
        <section v-if="parent" class="inspector-section"><h3>Parent</h3><button class="related-page" @click="emit('select',parent.id)"><Icon :name="parent.icon" /><span><strong>{{ parent.title }}</strong><code>{{ parent.route || 'Container' }}</code></span><Icon name="chevron-up" /></button></section>
        <section class="inspector-section"><div class="section-heading"><h3>Sibling pages <span>{{ siblings.length }}</span></h3><button v-if="parent" @click="emit('add', parent.id)">Add sibling</button></div><button v-for="p in siblings" :key="p.id" class="related-page" @click="emit('select',p.id)"><Icon :name="p.icon" /><span><strong>{{ p.title }}</strong><code>{{ p.route || 'Container' }}</code></span><Icon name="chevron-right" /></button><p v-if="!siblings.length" class="muted-copy">No other pages in this section.</p></section>
        <section class="inspector-section"><div class="section-heading"><h3>Child pages <span>{{ childPages.length }}</span></h3><button v-if="page.type !== 'external'" @click="emit('add',page.id)">Add child</button></div><button v-for="p in childPages" :key="p.id" class="related-page" @click="emit('select',p.id)"><Icon :name="p.icon" /><span><strong>{{ p.title }}</strong><code>{{ p.route }}</code></span><Icon name="chevron-right" /></button><p v-if="!childPages.length" class="muted-copy">This page has no children.</p></section>
        <section class="inspector-section"><h3>Linked from <span>{{ inbound.length }}</span></h3><button v-for="p in inbound" :key="p.id" class="related-page" @click="emit('select',p.id)"><Icon name="link" /><span><strong>{{ p.title }}</strong><code>{{ p.route }}</code></span><Icon name="chevron-right" /></button><p v-if="!inbound.length" class="muted-copy">No secondary navigation links point here.</p></section>
        <section class="inspector-section"><h3>Referenced components</h3><p class="muted-copy">References stay connected to the sitemap. No component-editor shell is shown.</p><UBadge v-for="id in page.componentIds" :key="id" color="neutral" variant="subtle" class="component-badge">{{ document.components.find(c=>c.id===id)?.name || id }}</UBadge></section>
      </template>
      <template v-else-if="tab === 'navigation'">
        <section class="inspector-section"><h3>Where this page appears</h3><USelect :model-value="page.nav" :items="[{label:'Primary navigation',value:'primary'},{label:'Contextual navigation',value:'contextual'},{label:'Hidden from navigation',value:'hidden'}]" @update:model-value="emit('patch',{nav:$event})" class="w-full" /><p class="muted-copy">Navigation placement is separate from structural hierarchy.</p><div class="field-row"><label>Breadcrumbs</label><USwitch :model-value="page.breadcrumbs" aria-label="Enable breadcrumbs" @update:model-value="emit('patch',{breadcrumbs:$event})" /></div><div v-if="page.breadcrumbs" class="mini-breadcrumb"><template v-for="p in [...ancestors(document,page.id),page]" :key="p.id"><button @click="emit('select',p.id)">{{ p.title }}</button><Icon name="chevron-right" /></template></div></section>
        <section class="inspector-section"><div class="section-heading"><h3>Secondary navigation</h3><USwitch :model-value="page.tabsEnabled" aria-label="Enable secondary navigation" @update:model-value="emit('patch',{tabsEnabled:$event})" /></div><p class="muted-copy">Link existing pages. Reordering a menu never moves pages in the sitemap.</p><div v-for="(p,index) in navPages" :key="p.id" class="nav-link-row"><button @click="emit('select',p.id)"><Icon :name="p.icon" />{{ p.title }}</button><ToolButton icon="chevron-up" :label="`Move ${p.title} up`" :disabled="index===0" @click="moveLink(index,-1)" /><ToolButton icon="x" :label="`Remove link to ${p.title}`" @click="emit('patch',{navItems:page.navItems.filter(id=>id!==p.id)})" /></div><div class="add-link"><USelect v-model="linkTarget" :items="targets" placeholder="Choose an existing page" aria-label="Navigation destination" class="w-full" /><UButton :disabled="!linkTarget" @click="addLink">Add link</UButton></div></section>
      </template>
      <template v-else>
        <section class="inspector-section"><h3>Access intent</h3><USelect :model-value="page.access" :items="[{label:'Public',value:'public'},{label:'Signed-in members',value:'members'},{label:'Selected roles',value:'restricted'}]" @update:model-value="emit('patch',{access:$event})" class="w-full" /><p class="muted-copy">This describes intended visibility, not authorization enforcement.</p><div v-if="page.access==='restricted'" class="role-list"><label v-for="r in ROLES" :key="r"><span>{{ r }}</span><USwitch :model-value="page.roles.includes(r)" :aria-label="`Allow ${r}`" @update:model-value="toggleRole(r,$event)" /></label></div><div class="access-result" :class="{ restricted: !allowed(page,role) }"><Icon :name="allowed(page,role)?'check-circle':'lock'" /><span>{{ role === 'All roles' ? 'Choose an audience in the editor toolbar to review visibility.' : `${allowed(page,role)?'Visible':'Restricted'} for ${role}` }}</span></div></section>
      </template>
    </div>
    <div class="inspector-footer"><UButton color="neutral" variant="outline" :disabled="page.parentId===null" @click="emit('move')"><Icon name="move" />Move</UButton><ToolButton icon="copy" label="Duplicate this page" :disabled="page.parentId===null" @click="emit('duplicate')" /><ToolButton icon="trash" label="Delete this page" :disabled="page.parentId===null" @click="emit('delete')" /><span>PAGE / {{ page.id.slice(0,10) }}</span></div>
  </aside>
</template>
