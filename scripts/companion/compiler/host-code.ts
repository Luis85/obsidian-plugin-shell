import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './data-code.ts';
export function hostCode(m: Model, add: Add): void {
  const root = m.sourceRoot; const init = `${root}/bootstrap/install.ts`;
  const ref = (path: string) => literal(relativeImport(init,path));
  add(init,`import { Modal, PluginSettingTab, type Plugin } from 'obsidian';
import { createServices } from ${ref('src/bootstrap/services.ts')};
import { nativeAdapters } from ${ref('src/infrastructure/obsidian/adapters.ts')};
import { nativeViewClass, type ShowcaseView } from ${ref('src/infrastructure/obsidian/showcase-view.ts')};
import { bindHostEvents } from ${ref('src/infrastructure/obsidian/event-bridge.ts')};
import { screens } from '../domain/screens.ts';
import { createSources } from './sources.ts';
import { mountProject } from './mount.ts';
export async function initializeProject(plugin: Plugin) {
  const shell = await createServices(nativeAdapters(plugin)); const sources = createSources(shell);
  const views = new Set<ShowcaseView>(); const modals = new Set<Modal>(); const settings = new Set<() => void>();
  let disposed = false; let stopEvents = () => {};
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const modal of modals) { try { modal.close(); } catch { shell.diagnostics.report('generated.cleanup','modal.close'); } }
    for (const release of settings) { try { release(); } catch { shell.diagnostics.report('generated.cleanup','settings.close'); } }
    for (const view of views) { try { view.disposeView(); } catch { shell.diagnostics.report('generated.cleanup','view.close'); } }
    try { stopEvents(); } finally { shell.dispose(); }
  };
  function openModal(id: string) {
    if (disposed) return;
    const screen = screens.find(s => s.id === id && s.kind === 'modal'); if (!screen) throw new Error('MODAL_NOT_DECLARED');
    const modal = new Modal(plugin.app); let release = () => {};
    modal.setTitle(screen.label);
    modal.onOpen = () => { release = mountProject(modal.contentEl,shell,sources,openModal,id,true); };
    modal.onClose = () => { release(); modals.delete(modal); };
    modals.add(modal);
    try { modal.open(); } catch (error) { modal.close(); throw error; }
  }
  const viewType = plugin.manifest.id + '-project-workbench';
  async function open(id?: string) {
    if (disposed) return;
    if (id && screens.find(s => s.id === id)?.kind === 'modal') { openModal(id); return; }
    // A fresh explicit-screen view avoids rewriting another view's independent draft state.
    const type = id ? viewType + '-' + screens.find(s => s.id === id)!.slug : viewType;
    const leaf = plugin.app.workspace.getLeavesOfType(type)[0] ?? plugin.app.workspace.getLeaf('tab');
    await leaf.setViewState({type,active:true}); await plugin.app.workspace.revealLeaf(leaf);
  }
  try {
    const definitions = [{id:undefined as string | undefined,type:viewType,label:plugin.manifest.name}, ...screens.filter(s => !['modal','group','action'].includes(s.kind)).map(s => ({id:s.id,type:viewType+'-'+s.slug,label:s.label}))];
    for (const definition of definitions) {
      const View = nativeViewClass({type:definition.type,title:()=>definition.label});
      plugin.registerView(definition.type,leaf => new View(leaf,
        element => mountProject(element,shell,sources,openModal,definition.id),
        {preferences:shell.preferences,diagnostics:shell.diagnostics,text:key=>shell.i18n.global.t(key),toggleHeader:()=>{void shell.preferences.toggleViewHeader();}},
        (view,visible) => { if (visible) views.add(view); else views.delete(view); }));
    }
    const invoke = (id?: string) => { void open(id).catch(() => shell.diagnostics.report('generated.open','view.open')); };
    plugin.addCommand({id:'open-project',name:'Open '+plugin.manifest.name,callback:()=>invoke()});
    for (const screen of screens.filter(s => s.command || s.ribbon)) {
      if (['group','action'].includes(screen.kind)) continue;
      if (screen.command) plugin.addCommand({id:'open-'+screen.slug,name:screen.label,callback:()=>invoke(screen.id)});
      if (screen.ribbon) plugin.addRibbonIcon('blocks',screen.label,()=>invoke(screen.id));
    }
    for (const screen of screens.filter(s => s.kind === 'settings')) {
      class ProjectSettings extends PluginSettingTab {
        private release = () => {};
        display() { this.hide(); this.containerEl.empty(); this.release = mountProject(this.containerEl,shell,sources,openModal,screen.id,true); settings.add(this.release); }
        override hide() { this.release(); settings.delete(this.release); this.release = () => {}; }
      }
      plugin.addSettingTab(new ProjectSettings(plugin.app,plugin));
    }
    stopEvents = bindHostEvents(plugin,shell.hostEvents,shell.diagnostics,shell.scheduler);
    return {dispose};
  } catch (error) { dispose(); throw error; }
}
`);
  const mount = `${root}/bootstrap/mount.ts`;
  add(mount,`import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import type { Services } from ${literal(relativeImport(mount,'src/bootstrap/services.ts'))};
import { bindHostTheme } from ${literal(relativeImport(mount,'src/infrastructure/ui/host-theme.ts'))};
import Workbench from '../presentation/components/Workbench.vue';
import { projectKey } from '../presentation/context/project.ts';
import type { Sources } from '../application/sources.ts';
import { panels } from './panels.ts';
import { bindFlows } from './flows.ts';
import { provideDetailContext } from '../presentation/composables/use-detail.ts';
import { createDetailContext } from './detail-context.ts';
import '../presentation/detail-layout.css';
export function mountProject(root: HTMLElement,shell: Services,sources: Sources,openModal: (id: string) => void,initial?: string,isolated = false) {
  const pinia = createPinia(); const app = createApp(Workbench); let mounted = false; let closed = false; let theme = () => {};
  const close = () => { if (closed) return; closed = true; try { if (mounted) app.unmount(); } finally { disposePinia(pinia); theme(); } };
  try {
    root.classList.add(shell.identity.rootClass,shell.identity.scopeClass); root.dataset.pluginUi = shell.identity.id;
    theme = bindHostTheme(root); app.use(pinia); provideDetailContext(app, createDetailContext(sources, pinia, openModal)); app.provide(projectKey,{panels,flows:bindFlows(sources,pinia),initial,isolated,openModal});
    app.config.errorHandler = () => shell.diagnostics.report('generated.render','view.render');
    mounted = true; app.mount(root); return close;
  } catch (error) { close(); throw error; }
}
`);
  add('src/main.ts',`import { Plugin } from 'obsidian';\nimport { initializeProject } from ${literal(relativeImport('src/main.ts',init))};\nimport './styles/app.css';\nimport ${literal(relativeImport('src/main.ts',`${root}/styles/project.css`))};\nexport default class GeneratedPlugin extends Plugin {\n  private runtime?: Awaited<ReturnType<typeof initializeProject>>;\n  async onload(): Promise<void> { this.runtime = await initializeProject(this); }\n  onunload(): void { this.runtime?.dispose(); }\n}\n`);
  add(`${root}/styles/project.css`,`.generated-workbench { display: flex; min-width: 0; gap: var(--size-4-4); padding: var(--size-4-4); color: var(--text-normal); background: var(--background-primary); }
.generated-workbench nav { display: flex; flex-direction: column; flex: 0 0 12rem; gap: var(--size-4-1); }
.generated-workbench nav button { white-space: normal; text-align: start; }
.generated-workbench [aria-current="page"] { font-weight: 700; outline: 2px solid var(--interactive-accent); }
.generated-workbench main { flex: 1; min-width: 0; }
.generated-screen { display: grid; gap: var(--size-4-3); }
.generated-component { border: 1px solid var(--background-modifier-border); border-radius: var(--radius-m); padding: var(--size-4-3); }
.generated-hint { color: var(--text-muted); }
.generated-workbench button:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: 2px; }
@media (max-width: 600px) { .generated-workbench { flex-direction: column; } .generated-workbench nav { flex-basis: auto; } }
`);
}
