import { editorBindings } from '#shared/companion/sitemap/editor-bindings.ts';
import type { SitemapDesign } from '#shared/companion/sitemap/model.ts';
import { literal, symbol, type Model } from './model.ts';
import { sampleCode } from './schema-code.ts';
import { relativeImport, type Add } from './file-code.ts';
import { clickdummyScenariosCode } from './clickdummy-scenarios-code.ts';
import { clickdummyHostCode } from './clickdummy-host-code.ts';

/** Browser composition of the same generated pages, services, local effects and navigation as the plugin.
 * Only explicit synthetic read ports are supplied. No native adapter or unspecified business write is loaded. */
export function clickdummyCode(m: Model, add: Add): void {
  const journey = editorBindings(m.document.design as SitemapDesign).length > 0;
  clickdummyHostCode(add);
  clickdummyScenariosCode(m, add);
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
  scenarios(): ReadonlyArray<{ id: string; name: string; state: VisualState; width: string }>; scenario(): string;
  selectScenario(id: string): void;${journey ? '\n  editorSurface(): boolean;' : ''}
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
  <div><h1>{{ model.name }}</h1><p>Clickdummy · synthetic read data · business writes unavailable</p></div>
  <div class="clickdummy-control"><label for="clickdummy-surface">Browse surfaces</label><select id="clickdummy-surface" :value="model.current()" @change="model.open(($event.target as HTMLSelectElement).value)${journey ? '; ($event.target as HTMLSelectElement).value = model.current()' : ''}"><option v-for="surface in model.surfaces" :key="surface.id" :value="surface.id">{{ surface.label }}</option></select></div>
  <div class="clickdummy-control"><label for="clickdummy-state">Preview state</label><select id="clickdummy-state" v-model="model.state.value"${journey ? ' :disabled="model.editorSurface()"' : ''}><option value="default">Default</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option><option value="disabled">Disabled</option></select></div>
  <div class="clickdummy-control"><label for="clickdummy-scenario">Authored scenario</label><select id="clickdummy-scenario" :value="model.scenario()" :disabled="!model.scenarios().length" @change="model.selectScenario(($event.target as HTMLSelectElement).value)"><option value="">Synthetic reads (no scenario)</option><option v-for="scenario in model.scenarios()" :key="scenario.id" :value="scenario.id">{{ scenario.name }} · {{ scenario.state }} · {{ scenario.width }}</option></select></div>
  <button id="clickdummy-reset" type="button" @click="model.reset">Reset preview</button><button type="button" @click="model.exportProject">Project JSON</button>
</header>
<p v-if="model.scenario()" class="clickdummy-route" role="status">Authored sample data · local interactions only · no data is saved. Changing scenario resets local edits.</p>
<p class="clickdummy-route">{{ model.route() || 'No authored route for this surface' }}</p>
<p v-if="model.error.value" class="clickdummy-error" role="alert">{{ model.error.value }}</p>
<ProjectWorkbench :key="model.state.value + '/' + model.scenario()" />
</div></UApp>
</template>
`);
  add(entry, `import { createApp, ref, watch, type App } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
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
import { createDialogHost, createPreviewLifecycle } from './clickdummy-host.ts';
import { scenariosForSurface, resolveScenario, type PreviewScenario } from './clickdummy-scenarios.ts';
${journey ? `import { createJourneyPreview } from ${from('bootstrap/journey-preview.ts')};\nimport { provideJourney } from ${from('bootstrap/journey-workspace.ts')};\n` : ''}import './clickdummy.css';
import '../../src/styles/app.css';
import ${from('styles/project.css')};
import ${from('presentation/detail-layout.css')};
const root = document.getElementById('prototype-app');
if (!root) throw new Error('CLICKDUMMY_ROOT');
const owner = ${literal(m.project.id)}, name = ${literal(m.project.name)};
const routes: ReadonlyArray<{id: string; surface: string; path: string}> = ${literal((m.document.design as {sitemap?: {routes?: unknown[]}}).sitemap?.routes ?? [])};
const state = ref<VisualState>('default'), error = ref('');
const dialogs = createDialogHost({ document, owner,
  label: id => screens.find(s => s.id === id && s.kind === 'modal')?.label,
  mount: (target, id) => mountFrame(target, id), error: message => { error.value = message; } });
function openModal(id: string, scenarioReadOnly = false) {
  dialogs.open(id, (target, surface) => mountFrame(target, surface, scenarioReadOnly));
}
// The host token scope is .obsidian-harness; without it the theme class would not restyle anything.
document.body.classList.add('obsidian-harness', 'theme-dark');
function fail() { error.value = 'This surface contains an unimplemented capability. It is not accepted functionality.'; }
function exportProject() {
  const data = JSON.parse(document.getElementById('prototype-project-data')?.textContent ?? '{}');
  if (data.encoding !== 'base64' || typeof data.content !== 'string') { fail(); return; }
  const bytes = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = owner + '.companion.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function mountFrame(target: HTMLElement, modal?: string, inheritedReadOnly = false): () => void {
  const pinia = createPinia(), sources = createClickdummySources(), navigation = useNavigation(pinia);
  const selection = ref<PreviewScenario | null>(null);
  const scenarioReadOnly = () => inheritedReadOnly || selection.value !== null;
  const frameOpenModal = (id: string) => openModal(id, scenarioReadOnly());
  if (modal) navigation.open(modal);
  let initial: string | undefined;
  try { if (!modal && location.hash.startsWith('#surface=')) initial = decodeURIComponent(location.hash.slice(9)); } catch { error.value = 'Invalid preview address.'; }
  if (initial && screens.some(s => s.id === initial && !['group','action','modal'].includes(s.kind))) navigation.open(initial);
  const app: App = createApp(modal ? Workbench : Preview); app.use(pinia); app.use(ui);
  const stops: Array<() => void> = [];${journey ? '\n  const journey = createJourneyPreview(); provideJourney(app,pinia,journey); stops.push(() => journey.dispose());' : ''}
  app.runWithContext(() => {
    app.provide(projectKey, { panels, flows: bindFlows(sources,pinia), isolated: !!modal, openModal: frameOpenModal, designState: () => state.value });
    provideVisualContext(app, { ...createVisualContext(sources,pinia,frameOpenModal), scenarioReadOnly,
      scenario: definition => selection.value?.definition === definition ? selection.value.id : undefined });
  });
  if (!modal) {
    const open = (id: string) => {
      if (screens.some(s => s.id === id && s.kind === 'modal')) frameOpenModal(id);
      else if (screens.some(s => s.id === id && !['group','action'].includes(s.kind))) navigation.open(id);
    };
    app.provide(clickdummyKey, { name, state, error, current: () => navigation.current,
      surfaces: screens.filter(s => !['group','action','modal'].includes(s.kind)), route: () => routes.find(r => r.surface === navigation.current)?.path ?? '',
      ${journey ? `editorSurface: () => ${literal(editorBindings(m.document.design as SitemapDesign).map(binding => binding.surface))}.includes(navigation.current),\n      ` : ''}scenarios: () => scenariosForSurface(navigation.current), scenario: () => selection.value?.id ?? '',
      selectScenario(id) {
        try { const next = resolveScenario(navigation.current, id);
          selection.value = next; state.value = next?.state ?? 'default'; error.value = '';
        } catch { error.value = 'This authored scenario is not available on the current surface.'; }
      }, open, reset, exportProject });
    stops.push(watch(() => navigation.current, () => {
      if (selection.value) { selection.value = null; state.value = 'default'; }
    }, { flush: 'sync' }));
    // Surface hashes are preview addresses, not invented route records. Authored route metadata is displayed separately.
    const incoming = () => { try { const id = decodeURIComponent(location.hash.slice(9)); if (location.hash.startsWith('#surface=') && screens.some(s => s.id === id && !['group','action','modal'].includes(s.kind))) navigation.open(id); } catch { error.value = 'Invalid preview address.'; } };
    window.addEventListener('hashchange', incoming); stops.push(() => window.removeEventListener('hashchange', incoming));
    stops.push(watch(() => navigation.current, id => { const hash = '#surface=' + encodeURIComponent(id); if (location.hash !== hash) location.hash = hash; }));
  }
  let released = false;
  const dispose = () => {
    if (released) return; released = true;
    try { stops.forEach(stop => stop()); app.unmount(); }
    finally { disposePinia(pinia); if (!modal) delete document.documentElement.dataset.prototypeReady; }
  };
  app.config.errorHandler = fail;
  try { app.mount(target); if (!modal && target.querySelector('.clickdummy-preview')) document.documentElement.dataset.prototypeReady = 'true'; }
  catch (cause) { dispose(); throw cause; }
  return dispose;
}
function reset() {
  state.value = 'default'; error.value = ''; history.replaceState(null, '', location.pathname + location.search);
  lifecycle.reset(); document.getElementById('clickdummy-reset')?.focus({ preventScroll: true });
}
const lifecycle = createPreviewLifecycle(window, { mount: () => mountFrame(root!), closeDialogs: dialogs.closeAll,
  error: message => { error.value = message; } });
`);
  add('harness/prototype/clickdummy.css', `/* Original standalone browser host simulation; never imported by the native plugin. */
@import '../styles/simulated.css';
body { margin:0; font-family:var(--font-interface,system-ui,sans-serif); background:var(--background-primary); color:var(--text-normal); }
.clickdummy-toolbar { display:flex; flex-wrap:wrap; gap:16px; align-items:center; padding:16px; border-bottom:1px solid var(--background-modifier-border); }
.clickdummy-toolbar h1 { margin:0; font-size:1.15rem; overflow-wrap:anywhere; }
.clickdummy-toolbar div { flex:1 1 250px; } .clickdummy-toolbar p { margin:4px 0; } .clickdummy-toolbar .clickdummy-control { flex:0 1 250px; display:grid; gap:4px; }
.clickdummy-toolbar select { width:100%; max-width:250px; min-width:0; }
.clickdummy-toolbar button,.clickdummy-toolbar select,.clickdummy-dialog > button { min-height:36px; padding:6px 10px; font:inherit; }
.clickdummy-toolbar :focus-visible,.clickdummy-dialog > button:focus-visible { outline:2px solid var(--interactive-accent); outline-offset:3px; }
.clickdummy-toolbar > div { min-width:0; } .clickdummy-route,.clickdummy-error { padding-inline:16px; overflow-wrap:anywhere; }
.clickdummy-dialog { color:var(--text-normal); background:var(--background-primary); max-width:min(960px,90vw); max-height:90vh; overflow:auto; border:1px solid var(--background-modifier-border); border-radius:12px; }
.clickdummy-dialog::backdrop { background:rgba(0,0,0,.55); }
@media (max-width:480px) { .clickdummy-toolbar { gap:12px; padding:12px; } .clickdummy-toolbar .clickdummy-control { flex-basis:100%; } .clickdummy-toolbar select { max-width:none; } .clickdummy-dialog { box-sizing:border-box; width:calc(100vw - 24px); max-width:none; padding:12px; } }
`);
}
