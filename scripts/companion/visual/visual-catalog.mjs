// Pinned Nuxt UI authoring catalog v1 plus recipes that expand to ordinary IR. Generated projects pin @nuxt/ui to VISUAL_NUXT_UI_VERSION.
import { visualAssert, visualAllocate, visualElement, visualText, visualNuxt, visualLiteral, visualLayoutRules } from './visual-ir.mjs';
import { compositionDefaultUI } from '../composition-contract.mjs';
export const VISUAL_NUXT_UI_VERSION = '4.11.2';
export const VISUAL_PROP_KINDS = Object.freeze(['string', 'number', 'boolean', 'array', 'object', 'unknown']);
export const VISUAL_CONTROL_ENTRIES = Object.freeze(['u-input', 'u-textarea', 'u-select', 'u-checkbox', 'u-switch']);
const vcatColors = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
const vcatP = (name, type, extra = {}) => Object.freeze({ name, type, ...extra });
const vcatEntry = (id, label, component, category, description, props, slots, emits, preview) => Object.freeze({ id, kind: 'primitive', label, component, category, description, props: Object.freeze(props), slots: Object.freeze(slots.map(name => Object.freeze({ name }))), emits: Object.freeze(emits.map(([name, payload]) => Object.freeze({ name, payload }))), preview });
export const visualCatalog = Object.freeze([
  vcatEntry('u-button', 'Button', 'UButton', 'Actions', 'Primary and secondary actions', [vcatP('label', 'string'), vcatP('color', 'string', { default: 'primary', options: vcatColors }), vcatP('variant', 'string', { default: 'solid', options: ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'] }), vcatP('icon', 'string'), vcatP('loading', 'boolean', { default: false }), vcatP('disabled', 'boolean', { default: false })], ['leading', 'default', 'trailing'], [['click', 'unknown']], 'button'),
  vcatEntry('u-input', 'Input', 'UInput', 'Forms', 'Single-line input', [vcatP('modelValue', 'unknown'), vcatP('type', 'string', { default: 'text', options: ['text', 'number', 'date', 'datetime-local', 'email', 'search'] }), vcatP('placeholder', 'string'), vcatP('icon', 'string'), vcatP('disabled', 'boolean')], [], [['update:modelValue', 'unknown']], 'input'),
  vcatEntry('u-textarea', 'Textarea', 'UTextarea', 'Forms', 'Multi-line input', [vcatP('modelValue', 'string'), vcatP('placeholder', 'string'), vcatP('rows', 'number', { default: 3 })], [], [['update:modelValue', 'string']], 'textarea'),
  vcatEntry('u-select', 'Select', 'USelect', 'Forms', 'Option selection', [vcatP('modelValue', 'unknown'), vcatP('items', 'array'), vcatP('placeholder', 'string')], [], [['update:modelValue', 'unknown']], 'select'),
  vcatEntry('u-checkbox', 'Checkbox', 'UCheckbox', 'Forms', 'Boolean form control', [vcatP('modelValue', 'boolean'), vcatP('label', 'string')], [], [['update:modelValue', 'boolean']], 'checkbox'),
  vcatEntry('u-switch', 'Switch', 'USwitch', 'Forms', 'Immediate boolean setting', [vcatP('modelValue', 'boolean'), vcatP('label', 'string')], [], [['update:modelValue', 'boolean']], 'switch'),
  vcatEntry('u-form', 'Form', 'UForm', 'Forms', 'Validated form boundary', [vcatP('state', 'object')], ['default'], [['submit', 'unknown']], 'form'),
  vcatEntry('u-form-field', 'Form Field', 'UFormField', 'Forms', 'Label, help and validation wrapper', [vcatP('label', 'string'), vcatP('name', 'string'), vcatP('description', 'string'), vcatP('required', 'boolean')], ['default'], [], 'field'),
  vcatEntry('u-table', 'Data Table', 'UTable', 'Data', 'Structured records', [vcatP('data', 'array'), vcatP('columns', 'array'), vcatP('loading', 'boolean')], ['empty', 'loading'], [['select', 'unknown']], 'table'),
  vcatEntry('u-card', 'Card', 'UCard', 'Data', 'Grouped content container', [], ['header', 'default', 'footer'], [], 'card'),
  vcatEntry('u-badge', 'Badge', 'UBadge', 'Data', 'Compact status', [vcatP('label', 'string'), vcatP('color', 'string', { options: vcatColors }), vcatP('variant', 'string', { options: ['solid', 'outline', 'soft', 'subtle'] })], ['default'], [], 'badge'),
  vcatEntry('u-avatar', 'Avatar', 'UAvatar', 'Data', 'User or entity identity', [vcatP('src', 'string'), vcatP('alt', 'string'), vcatP('text', 'string')], [], [], 'avatar'),
  vcatEntry('u-tabs', 'Tabs', 'UTabs', 'Navigation', 'Peer surface navigation', [vcatP('items', 'array'), vcatP('modelValue', 'string')], [], [['update:modelValue', 'string']], 'tabs'),
  vcatEntry('u-breadcrumb', 'Breadcrumb', 'UBreadcrumb', 'Navigation', 'Hierarchical location', [vcatP('items', 'array')], [], [], 'breadcrumb'),
  vcatEntry('u-dropdown-menu', 'Dropdown Menu', 'UDropdownMenu', 'Navigation', 'Context actions', [vcatP('items', 'array')], ['default'], [], 'menu'),
  vcatEntry('u-command-palette', 'Command Palette', 'UCommandPalette', 'Navigation', 'Keyboard-first command discovery', [vcatP('groups', 'array'), vcatP('placeholder', 'string')], [], [['update:modelValue', 'unknown']], 'menu'),
  vcatEntry('u-modal', 'Modal', 'UModal', 'Overlays', 'Focused modal workflow', [vcatP('open', 'boolean'), vcatP('title', 'string'), vcatP('description', 'string')], ['body', 'footer'], [['update:open', 'boolean']], 'overlay'),
  vcatEntry('u-drawer', 'Drawer', 'UDrawer', 'Overlays', 'Contextual side or bottom workflow', [vcatP('open', 'boolean'), vcatP('title', 'string')], ['body', 'footer'], [['update:open', 'boolean']], 'overlay'),
  vcatEntry('u-alert', 'Alert', 'UAlert', 'Feedback', 'Persistent contextual feedback', [vcatP('title', 'string'), vcatP('description', 'string'), vcatP('color', 'string', { options: vcatColors })], [], [], 'alert'),
  vcatEntry('u-progress', 'Progress', 'UProgress', 'Feedback', 'Progress indicator', [vcatP('modelValue', 'number'), vcatP('max', 'number', { default: 100 })], [], [], 'progress'),
  vcatEntry('u-skeleton', 'Skeleton', 'USkeleton', 'Feedback', 'Loading placeholder', [], [], [], 'skeleton'),
  vcatEntry('u-separator', 'Separator', 'USeparator', 'Layout', 'Visual separation', [vcatP('orientation', 'string', { default: 'horizontal', options: ['horizontal', 'vertical'] })], [], [], 'separator'),
]);
export function visualCatalogEntry(id) { return visualCatalog.find(e => e.id === id) ?? null; }
// Export names a generated component cannot take: Vue built-ins that templates resolve before script-setup bindings,
// the type names every generated script declares, and each catalog component the generator imports explicitly.
export const VISUAL_RESERVED_EXPORTS = Object.freeze(['Component', 'Transition', 'TransitionGroup', 'BaseTransition', 'KeepAlive', 'Suspense', 'Teleport', 'Slot', 'Template', 'Error', 'VisualState', 'VisualRequest', 'ComponentProps', 'ComponentEvents', 'ComponentSlots']);
export function visualReservedExport(name) { return VISUAL_RESERVED_EXPORTS.includes(name) || visualCatalog.some(e => e.component === name); }
const vcatLit = values => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, visualLiteral(v)]));
const vcatBox = (s, tag, mode, name, children, ui = {}) => visualElement(visualAllocate(s, 'vn'), tag, { name, layout: visualLayoutRules(mode, { ...compositionDefaultUI(), ...ui }), children });
const vcatUi = (s, entryId, name, props = {}, extra = {}) => visualNuxt(visualAllocate(s, 'vn'), entryId, vcatLit(props), { name, ...extra });
const vcatTxt = (s, value, role, name) => visualText(visualAllocate(s, 'vn'), value, role, { name });
const vcatField = (s, label, entryId, props = {}) => { const field = vcatUi(s, 'u-form-field', label + ' field', { label }); field.slots.default = [vcatUi(s, entryId, label, props)]; return field; };
const vcatCard = (s, label, value) => { const card = vcatUi(s, 'u-card', label + ' card'); card.slots.default = [vcatTxt(s, label, 'span', label + ' label'), vcatTxt(s, value, 'h2', label + ' value')]; return card; };
function vcatShell(s, content) {
  return [vcatBox(s, 'div', 'row', 'Application shell', [
    vcatBox(s, 'nav', 'stack', 'Primary sidebar', [vcatTxt(s, 'Workspace', 'span', 'Product name'), vcatUi(s, 'u-button', 'Overview link', { label: 'Overview', variant: 'ghost' })], { widthMode: 'fixed', width: 224 }),
    vcatBox(s, 'div', 'stack', 'Workspace', [vcatBox(s, 'header', 'row', 'Command bar', [vcatUi(s, 'u-breadcrumb', 'Breadcrumb', { items: [{ label: 'Workspace' }] })]), vcatBox(s, 'main', 'stack', 'Content', content)]),
  ])];
}
const vcatCrud = s => [vcatBox(s, 'section', 'stack', 'List workspace', [
  vcatBox(s, 'header', 'row', 'Heading', [vcatTxt(s, 'Records', 'h1', 'Title'), vcatUi(s, 'u-button', 'Create action', { label: 'New record', icon: 'i-lucide-plus' })]),
  ...vcatFilter(s),
  vcatUi(s, 'u-table', 'Records table', { columns: [{ accessorKey: 'name', header: 'Name' }], data: [] }, { visibleIn: ['default', 'loading', 'error', 'disabled'] }),
  vcatUi(s, 'u-alert', 'Empty message', { title: 'No records yet', description: 'Create the first record to get started.', color: 'neutral' }, { visibleIn: ['empty'] }),
])];
const vcatFilter = s => [vcatBox(s, 'div', 'row', 'Filter bar', [vcatUi(s, 'u-input', 'Search', { placeholder: 'Search…', icon: 'i-lucide-search' }), vcatUi(s, 'u-select', 'Filter', { items: ['All'], placeholder: 'Filter' }), vcatUi(s, 'u-button', 'Reset filters', { label: 'Reset', variant: 'ghost' })])];
const vcatMasterDetail = s => [vcatBox(s, 'div', 'grid', 'Master / detail', [vcatBox(s, 'section', 'stack', 'Records', [vcatUi(s, 'u-table', 'Record list', { columns: [{ accessorKey: 'name', header: 'Name' }], data: [] })]), vcatBox(s, 'section', 'stack', 'Detail', [vcatTxt(s, 'Details', 'h2', 'Detail title'), vcatTxt(s, 'Select a record to see its details.', 'p', 'Detail hint')])], { columns: 2 })];
function vcatSettings(s) { const form = vcatUi(s, 'u-form', 'Settings form'); form.slots.default = [vcatField(s, 'Name', 'u-input', { placeholder: 'Workspace name' }), vcatField(s, 'Notifications', 'u-switch', { label: 'Email notifications' })]; return [vcatBox(s, 'div', 'row', 'Settings', [vcatBox(s, 'nav', 'stack', 'Settings sections', [vcatUi(s, 'u-button', 'General section', { label: 'General', variant: 'ghost' }), vcatUi(s, 'u-button', 'Notifications section', { label: 'Notifications', variant: 'ghost' })]), form])]; }
const vcatEmpty = s => [vcatBox(s, 'section', 'stack', 'Empty state', [vcatTxt(s, 'Nothing here yet', 'h2', 'Empty title'), vcatTxt(s, 'Create the first item to get started.', 'p', 'Empty copy'), vcatUi(s, 'u-button', 'Empty action', { label: 'Create' })])];
const vcatDashboard = s => [vcatBox(s, 'section', 'stack', 'Dashboard', [vcatTxt(s, 'Overview', 'h1', 'Title'), vcatBox(s, 'div', 'grid', 'KPI summary', [vcatCard(s, 'Active', '0'), vcatCard(s, 'Revenue', '0'), vcatCard(s, 'Attention', '0')], { columns: 3 }), vcatUi(s, 'u-table', 'Activity', { columns: [{ accessorKey: 'event', header: 'Event' }], data: [] })])];
function vcatForm(s) { const form = vcatUi(s, 'u-form', 'Record form'); form.slots.default = [vcatField(s, 'Title', 'u-input', { placeholder: 'Title' }), vcatField(s, 'Description', 'u-textarea', { rows: 4 })]; return [vcatBox(s, 'section', 'stack', 'Form workflow', [vcatTxt(s, 'New record', 'h1', 'Title'), form, vcatBox(s, 'footer', 'row', 'Form actions', [vcatUi(s, 'u-button', 'Cancel', { label: 'Cancel', variant: 'ghost' }), vcatUi(s, 'u-button', 'Save', { label: 'Save' })], { justify: 'end' })])]; }
const vcatRecipe = (id, label, description, build) => Object.freeze({ id, label, category: 'Application patterns', description, build });
export const visualRecipes = Object.freeze([
  vcatRecipe('recipe-app-shell', 'Application Shell', 'Sidebar, header and content region', s => vcatShell(s, [])),
  vcatRecipe('recipe-crud-list', 'CRUD List Workspace', 'Heading, actions, filter bar, table and empty state', vcatCrud),
  vcatRecipe('recipe-filter-bar', 'Filter Bar', 'Search, filter and reset', vcatFilter),
  vcatRecipe('recipe-master-detail', 'Master / Detail', 'Record collection with a detail pane', vcatMasterDetail),
  vcatRecipe('recipe-settings', 'Settings Form', 'Section navigation plus grouped validated form', vcatSettings),
  vcatRecipe('recipe-empty-state', 'Empty State', 'Message, supporting copy and primary action', vcatEmpty),
]);
const vcatLayout = (id, name, category, description, build) => Object.freeze({ id, name, category, scope: 'page', description, build });
export const visualBuiltinLayouts = Object.freeze([
  vcatLayout('builtin-list-workspace', 'List workspace', 'application', 'Sidebar, command bar, filters and data table', s => vcatShell(s, vcatCrud(s))),
  vcatLayout('builtin-dashboard', 'Operations dashboard', 'dashboard', 'KPI row and activity table', vcatDashboard),
  vcatLayout('builtin-master-detail', 'Master / detail', 'master-detail', 'Record list with persistent detail pane', s => vcatShell(s, vcatMasterDetail(s))),
  vcatLayout('builtin-form', 'Form workflow', 'form', 'Sectioned form with actions', vcatForm),
  vcatLayout('builtin-settings', 'Settings', 'settings', 'Settings navigation and grouped forms', s => vcatShell(s, vcatSettings(s))),
]);
export function visualExpand(store, id) {
  const item = visualRecipes.find(r => r.id === id) ?? visualBuiltinLayouts.find(l => l.id === id);
  visualAssert(item, 'Unknown recipe or layout ' + JSON.stringify(id) + '.');
  return item.build(store);
}
