import { literal, symbol, type Model } from './model.ts';
import { sampleCode } from './schema-code.ts';
import { relativeImport, type Add } from './file-code.ts';

/** Browser composition of the same generated pages, services, local effects and navigation as the plugin.
 * Only explicit synthetic read ports are supplied. No native adapter or unspecified business write is loaded. */
export function clickdummyCode(m: Model, add: Add): void {
  const root = m.sourceRoot, entry = 'harness/prototype/clickdummy.ts';
  const from = (path: string) => literal(relativeImport(entry, `${root}/${path}`));
  const imports = m.sources.map(s => `import { create${symbol(s.slug)}Service } from '../application/${s.slug}/service.ts';`).join('\n');
  const ports = m.sources.map(s => `${literal(s.slug)}: create${symbol(s.slug)}Service({${s.operations.map(op =>
    `${literal(op.slug)}: async () => { ${op.direction === 'read' ? `return ${sampleCode(op.output)};` : "throw new Error('NOT_IMPLEMENTED: Clickdummy has no business-write adapter.');"} }`).join(',\n')}})`).join(',\n');
  add(`${root}/bootstrap/clickdummy-sources.ts`, `${imports}
import type { Sources } from '../application/sources.ts';
/** Synthetic read values, not production records. Each call returns an independent value. */
export function createClickdummySources(): Sources { return {${ports}}; }
`);
  add(`${root}/presentation/context/clickdummy.ts`, `import { inject, type InjectionKey, type Ref } from 'vue';
import type { VisualState } from '../../domain/visual-runtime.ts';
export interface ClickdummyContext {
  name: string; state: Ref<VisualState>; error: Ref<string>; current: () => string;
  surfaces: ReadonlyArray<{ id: string; label: string }>; route: () => string;
  open(id: string): void; reset(): void; exportProject(): void;
}
export const clickdummyKey: InjectionKey<ClickdummyContext> = Symbol('clickdummy');
export function useClickdummy(): ClickdummyContext {
  const context = inject(clickdummyKey); if (!context) throw new Error('CLICKDUMMY_CONTEXT'); return context;
}
`);
  add(`${root}/presentation/components/ClickdummyPreview.vue`, `<script setup lang="ts">
import UApp from '@nuxt/ui/components/App.vue';
import ProjectWorkbench from './ProjectWorkbench.vue';
import { useClickdummy } from '../context/clickdummy.ts';
const model = useClickdummy();
</script>
<template>
<UApp><div class="clickdummy-preview">
<header class="clickdummy-toolbar">
  <div><strong>{{ model.name }}</strong><p>Clickdummy · synthetic read data · business writes unavailable</p></div>
  <label>Browse surfaces<select :value="model.current()" @change="model.open(($event.target as HTMLSelectElement).value)"><option v-for="surface in model.surfaces" :key="surface.id" :value="surface.id">{{ surface.label }}</option></select></label>
  <label>Preview state<select v-model="model.state.value"><option value="default">Default</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option><option value="disabled">Disabled</option></select></label>
  <button type="button" @click="model.reset">Reset preview</button><button type="button" @click="model.exportProject">Project JSON</button>
</header>
<p class="clickdummy-route">{{ model.route() || 'No authored route for this surface' }}</p>
<p v-if="model.error.value" class="clickdummy-error" role="alert">{{ model.error.value }}</p>
<ProjectWorkbench :key="model.state.value" />
</div></UApp>
</template>
`);
  add(entry, `import { createApp, ref, watch, type App } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import Preview from ${from('presentation/components/ClickdummyPreview.vue')};
import Workbench from ${from('presentation/components/ProjectWorkbench.vue')};
import { panels } from ${from('bootstrap/panels.ts')};
import { projectKey } from ${from('presentation/context/project.ts')};
import { clickdummyKey } from ${from('presentation/context/clickdummy.ts')};
import { createClickdummySources } from ${from('bootstrap/clickdummy-sources.ts')};
import { bindFlows } from ${from('bootstrap/flows.ts')};
import { createVisualContext } from ${from('bootstrap/visual-context.ts')};
import { provideVisualContext } from ${from('presentation/composables/use-visual.ts')};
import { useNavigation } from ${from('presentation/stores/navigation.ts')};
import { screens } from ${from('domain/screens.ts')};
import type { VisualState } from ${from('domain/visual-runtime.ts')};
import './clickdummy.css';
import '../../src/styles/app.css';
import ${from('styles/project.css')};
import ${from('presentation/detail-layout.css')};
const root = document.getElementById('prototype-app');
if (!root) throw new Error('CLICKDUMMY_ROOT');
const owner = ${literal(m.project.id)}, name = ${literal(m.project.name)};
const routes: ReadonlyArray<{id: string; surface: string; path: string}> = ${literal((m.document.design as {sitemap?: {routes?: unknown[]}}).sitemap?.routes ?? [])};
const state = ref<VisualState>('default'), error = ref('');
const dialogs: Array<() => void> = []; let stopMain: (() => void) | undefined;
document.body.classList.add('theme-dark');
function fail() { error.value = 'This surface contains an unimplemented capability. It is not accepted functionality.'; }
function exportProject() {
  const data = JSON.parse(document.getElementById('prototype-project-data')?.textContent ?? '{}');
  if (data.encoding !== 'base64' || typeof data.content !== 'string') { fail(); return; }
  const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = owner + '.companion.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openModal(id: string) {
  if (dialogs.length >= 12 || !screens.some(s => s.id === id && s.kind === 'modal')) { fail(); return; }
  const dialog = document.createElement('dialog'); dialog.className = 'clickdummy-dialog ps--' + owner; dialog.dataset.pluginUi = owner;
  dialog.setAttribute('aria-label', screens.find(s => s.id === id)!.label);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close dialog';
  const content = document.createElement('div'); dialog.append(close, content); document.body.append(dialog);
  let disposeFrame: (() => void) | undefined;
  const dispose = () => { const at = dialogs.indexOf(dispose); if (at < 0) return; dialogs.splice(at, 1); disposeFrame?.(); dialog.close(); dialog.remove(); };
  dialogs.push(dispose); close.addEventListener('click', dispose); dialog.addEventListener('cancel', e => { e.preventDefault(); dispose(); });
  disposeFrame = mountFrame(content, id); dialog.showModal(); close.focus();
}
function mountFrame(target: HTMLElement, modal?: string): () => void {
  const pinia = createPinia(), sources = createClickdummySources(), navigation = useNavigation(pinia);
  if (modal) navigation.open(modal);
  let initial: string | undefined;
  try { if (!modal && location.hash.startsWith('#surface=')) initial = decodeURIComponent(location.hash.slice(9)); } catch { error.value = 'Invalid preview address.'; }
  if (initial && screens.some(s => s.id === initial && !['group','action','modal'].includes(s.kind))) navigation.open(initial);
  const app: App = createApp(modal ? Workbench : Preview); app.use(pinia);
  const stops: Array<() => void> = [];
  app.runWithContext(() => {
    app.provide(projectKey, { panels, flows: bindFlows(sources,pinia), isolated: !!modal, openModal, designState: () => state.value });
    provideVisualContext(app, createVisualContext(sources,pinia,openModal));
  });
  if (!modal) {
    const open = (id: string) => {
      if (screens.some(s => s.id === id && s.kind === 'modal')) openModal(id);
      else if (screens.some(s => s.id === id && !['group','action'].includes(s.kind))) navigation.open(id);
    };
    app.provide(clickdummyKey, { name, state, error, current: () => navigation.current,
      surfaces: screens.filter(s => !['group','action','modal'].includes(s.kind)), route: () => routes.find(r => r.surface === navigation.current)?.path ?? '',
      open, reset, exportProject });
    // Surface hashes are preview addresses, not invented route records. Authored route metadata is displayed separately.
    const incoming = () => { try { const id = decodeURIComponent(location.hash.slice(9)); if (location.hash.startsWith('#surface=') && screens.some(s => s.id === id && !['group','action','modal'].includes(s.kind))) navigation.open(id); } catch { error.value = 'Invalid preview address.'; } };
    window.addEventListener('hashchange', incoming); stops.push(() => window.removeEventListener('hashchange', incoming));
    stops.push(watch(() => navigation.current, id => { const hash = '#surface=' + encodeURIComponent(id); if (location.hash !== hash) location.hash = hash; }));
  }
  app.config.errorHandler = fail; app.mount(target);
  return () => { stops.forEach(stop => stop()); app.unmount(); disposePinia(pinia); };
}
function reset() { dialogs.slice().reverse().forEach(close => close()); stopMain?.(); state.value = 'default'; error.value = ''; location.hash = ''; stopMain = mountFrame(root!); }
stopMain = mountFrame(root);
window.addEventListener('pagehide', () => { dialogs.slice().reverse().forEach(close => close()); stopMain?.(); }, { once: true });
`);
  add('harness/prototype/clickdummy.css', `/* Original standalone browser host simulation; never imported by the native plugin. */
@import '../styles/simulated.css';
body { margin:0; font-family:var(--font-interface,system-ui,sans-serif); background:var(--background-primary); color:var(--text-normal); }
.clickdummy-toolbar { display:flex; flex-wrap:wrap; gap:16px; align-items:center; padding:16px; border-bottom:1px solid var(--background-modifier-border); }
.clickdummy-toolbar div { flex:1 1 250px; } .clickdummy-toolbar p { margin:4px 0; } .clickdummy-toolbar label { display:grid; gap:4px; }
.clickdummy-toolbar select { max-width:250px; } .clickdummy-route,.clickdummy-error { padding-inline:16px; overflow-wrap:anywhere; }
.clickdummy-dialog { color:var(--text-normal); background:var(--background-primary); max-width:min(960px,90vw); max-height:90vh; overflow:auto; border:1px solid var(--background-modifier-border); border-radius:12px; }
.clickdummy-dialog::backdrop { background:rgba(0,0,0,.55); }
`);
}
