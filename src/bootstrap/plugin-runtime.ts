import { Notice, type Plugin } from 'obsidian';
import { createServices } from './services';
import { mountShowcase } from './mount-ui';
import { nativeAdapters } from '../infrastructure/obsidian/adapters';
import { ShellSettingsTab } from '../infrastructure/obsidian/settings-tab';
import { ShowcaseView, SHOWCASE_VIEW, nativeViewClass } from '../infrastructure/obsidian/showcase-view';
import { bindHostEvents } from '../infrastructure/obsidian/event-bridge';
import { bindCommands } from '../infrastructure/obsidian/commands';
import { createCommands } from './commands';
import { authoringPanels } from './authoring';
import { authoringViewDefinitions } from './authoring-views';
import { failure } from '../domain/outcome';
export async function initializePlugin(plugin: Plugin) {
  const services = await createServices(nativeAdapters(plugin));
  let disposed = false;
  const views = new Set<ShowcaseView>();
  let stopHostEvents = () => {};
  let stopCommands = () => {};
  let stopSettings = () => {};
  const text = (key: string) => services.i18n.global.t(key);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopSettings();
    stopCommands();
    for (const view of Array.from(views)) {
      try { view.disposeView(); } catch { services.diagnostics.report('view.dispose', 'view.close'); }
    }
    stopHostEvents(); services.dispose();
  };
  const toggleHeader = async () => {
    if (disposed) return failure('disposed', 'error.disposed');
    return services.preferences.toggleViewHeader();
  };
  const toggleFromMenu = () => {
    void toggleHeader().then(result => { if (!result.ok) services.notifications.show('header-toggle', 'error', result.error.key, true, 'runtime'); })
      .catch(() => services.diagnostics.report('header.toggle', 'view.header'));
  };
  try {
    const definitions = [{ id: undefined, type: SHOWCASE_VIEW, title: () => services.identity.name },
      ...authoringViewDefinitions(authoringPanels).map(panel => ({ ...panel, title: () => text(panel.titleKey) }))];
    for (const definition of definitions) {
      const View = nativeViewClass(definition);
      plugin.registerView(definition.type, leaf => new View(leaf,
      (root, actions) => mountShowcase(root, services, actions, refresh => {
        const workspace = plugin.app.workspace;
        const refs = [workspace.on('layout-change', refresh), workspace.on('css-change', refresh), workspace.on('window-open', refresh)];
        return () => { for (const ref of refs) workspace.offref(ref); };
      }, definition.id),
      { preferences: services.preferences, diagnostics: services.diagnostics, text, toggleHeader: toggleFromMenu },
      (view, open) => { if (open) views.add(view); else views.delete(view); }));
    }
    const open = async (type: string = SHOWCASE_VIEW) => {
      if (disposed) return;
      try {
        const existing = plugin.app.workspace.getLeavesOfType(type)[0];
        const leaf = existing ?? plugin.app.workspace.getLeaf('tab');
        if (!existing) await leaf.setViewState({ type, active: true });
        await plugin.app.workspace.revealLeaf(leaf);
      } catch { services.diagnostics.report('view.open', 'view.open'); throw new Error('VIEW_OPEN_FAILED'); }
    };
    stopCommands = bindCommands(plugin, createCommands(services, { openShowcase: open, toggleHeader,
      async openAuthoring(id) { const view = definitions.find(definition => definition.id === id); if (!view) throw new Error('AUTHORING_VIEW_NOT_REGISTERED'); await open(view.type); },
    }), text, services.diagnostics);
    const settings = new ShellSettingsTab(plugin, { preferences: services.preferences, notifications: services.notifications,
      diagnostics: services.diagnostics, settings: services.authoring.settings, text });
    stopSettings = () => settings.dispose(); plugin.addSettingTab(settings);
    stopHostEvents = bindHostEvents(plugin, services.events, services.diagnostics, services.scheduler);
  } catch (error) { dispose(); new Notice(`${plugin.manifest.name} could not start. Check the installed version.`); throw error; }
  return { dispose, diagnosticSnapshot: () => services.diagnostics.current };
}
