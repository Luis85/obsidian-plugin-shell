import { Modal, PluginSettingTab, type Plugin } from 'obsidian';
import { createServices } from "../../bootstrap/services.ts";
import { bindNativeIntegrations } from "../../infrastructure/obsidian/native-integrations.ts";
import { nativeFileTypes, nativeContextMenus } from "../../bootstrap/native-integrations.ts";
import { projectFileTypes, projectContextMenus } from './native-integrations.ts';
import { nativeAdapters } from "../../infrastructure/obsidian/adapters.ts";
import { nativeViewClass, type ShowcaseView } from "../../infrastructure/obsidian/showcase-view.ts";
import { bindHostEvents } from "../../infrastructure/obsidian/event-bridge.ts";
import { bindCommands } from "../../infrastructure/obsidian/commands.ts";
import { CommandService } from "../../application/command-service.ts";
import { createDebugCommands } from "../../features/debugging/commands.ts";
import { screens } from '../domain/screens.ts';
import { createSources } from './sources.ts';
import { disposeRelationshipIntegrity } from './relationships.ts';
import { configureSourceProviders } from './source-providers.ts';
import { mountProject } from './mount.ts';
import { createJourneyNative } from './journey-native.ts';
export async function initializeProject(plugin: Plugin) {
  const shell = await createServices(nativeAdapters(plugin));
  const journey = createJourneyNative(plugin.app.vault, () => shell.diagnostics.report('journey.storage', 'project.file'));
  let sources: ReturnType<typeof createSources>;
  let providers: ReturnType<typeof configureSourceProviders> | undefined;
  const views = new Set<ShowcaseView>(); const modals = new Set<Modal>(); const settings = new Set<() => void>();
  let disposed = false; let stopEvents = () => {}; let stopCommands = () => {}; let stopNative = () => {};
  const dispose = () => {
    if (disposed) return; disposed = true;
    stopNative();
    journey.dispose();
    for (const modal of modals) { try { modal.close(); } catch { shell.diagnostics.report('generated.cleanup','modal.close'); } }
    for (const release of settings) { try { release(); } catch { shell.diagnostics.report('generated.cleanup','settings.close'); } }
    for (const view of views) { try { view.disposeView(); } catch { shell.diagnostics.report('generated.cleanup','view.close'); } }
    disposeRelationshipIntegrity(shell);
    try { stopCommands(); } catch { shell.diagnostics.report('generated.cleanup','command.dispose'); }
    try { providers?.dispose(); } catch { shell.diagnostics.report('generated.cleanup','sources.dispose'); }
    try { stopEvents(); } finally { shell.dispose(); }
  };
  function openModal(id: string) {
    if (disposed) return;
    const screen = screens.find(s => s.id === id && s.kind === 'modal'); if (!screen) throw new Error('MODAL_NOT_DECLARED');
    const modal = new Modal(plugin.app); let release = () => {};
    modal.setTitle(screen.label);
    modal.onOpen = () => { release = mountProject(modal.contentEl,shell,sources,openModal,id,true,journey); };
    modal.onClose = () => { release(); modals.delete(modal); };
    modals.add(modal);
    try { modal.open(); } catch (error) { modal.close(); throw error; }
  }
  // The shell's view-header binding owns only <id>-view-* types; any other view type fails to open.
  const viewType = plugin.manifest.id + '-view-project-workbench';
  async function open(id?: string) {
    if (disposed) return;
    if (id && screens.find(s => s.id === id)?.kind === 'modal') { openModal(id); return; }
    // A fresh explicit-screen view avoids rewriting another view's independent draft state.
    const type = id ? viewType + '-' + screens.find(s => s.id === id)!.slug : viewType;
    const leaf = plugin.app.workspace.getLeavesOfType(type)[0] ?? plugin.app.workspace.getLeaf('tab');
    await leaf.setViewState({type,active:true}); await plugin.app.workspace.revealLeaf(leaf);
  }
  try {
    stopNative = bindNativeIntegrations(plugin, [...nativeFileTypes, ...projectFileTypes], [...nativeContextMenus, ...projectContextMenus], code => shell.diagnostics.report(code, 'native.integration'));
    providers = configureSourceProviders(shell); sources = createSources(shell,providers.ports);
    const definitions = [{id:undefined as string | undefined,type:viewType,label:plugin.manifest.name}, ...screens.filter(s => !['modal','group','action'].includes(s.kind)).map(s => ({id:s.id,type:viewType+'-'+s.slug,label:s.label}))];
    for (const definition of definitions) {
      const View = nativeViewClass({type:definition.type,title:()=>definition.label});
      plugin.registerView(definition.type,leaf => new View(leaf,
        element => mountProject(element,shell,sources,openModal,definition.id,false,journey),
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
      // eslint-disable-next-line obsidianmd/settings-tab/prefer-setting-definitions -- this tab mounts the generated Vue settings screen in display(); its controls have no declarative definitions to index.
      class ProjectSettings extends PluginSettingTab {
        private release = () => {};
        display() { this.hide(); this.containerEl.empty(); this.release = mountProject(this.containerEl,shell,sources,openModal,screen.id,true,journey); settings.add(this.release); }
        override hide() { this.release(); settings.delete(this.release); this.release = () => {}; }
      }
      plugin.addSettingTab(new ProjectSettings(plugin.app,plugin));
    }
    // Runtime debug controls (the dev loop toggles them after each load); records stay redacted.
    const debugCommands = new CommandService([createDebugCommands({debugging:shell.debugging,modals:shell.modals,notices:shell.notices})],shell.diagnostics,
      {validKey:key=>shell.i18n.global.te(key),onFailure:(error,id)=>{ shell.notifications.show('command:'+id,'error',error.key,true,'runtime'); }});
    stopCommands = bindCommands(plugin,debugCommands,key=>shell.i18n.global.t(key),shell.diagnostics);
    stopEvents = bindHostEvents(plugin,shell.hostEvents,shell.diagnostics,shell.scheduler);
    return {dispose};
  } catch (error) { dispose(); throw error; }
}
