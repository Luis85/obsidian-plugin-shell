import { Notice, type Plugin } from 'obsidian';
import { createServices } from './services';
import { mountShowcase } from './mount-ui';
import { nativeAdapters } from '../infrastructure/obsidian/adapters';
import { ShellSettingsTab } from '../infrastructure/obsidian/settings-tab';
import { ShowcaseView, SHOWCASE_VIEW } from '../infrastructure/obsidian/showcase-view';
import { bindHostEvents } from '../infrastructure/obsidian/event-bridge';
import { bindCommands } from '../infrastructure/obsidian/commands';
import { createCommands } from './commands';
export async function initializePlugin(plugin: Plugin) {
  const services = await createServices(nativeAdapters(plugin));
  let disposed = false;
  const views = new Set<ShowcaseView>();
  let stopHostEvents = () => {};
  let stopCommands = () => {};
  const text = (key: string) => services.i18n.global.t(key);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopCommands();
    for (const view of Array.from(views)) {
      try { view.disposeView(); } catch { services.diagnostics.report('view.dispose', 'view.close'); }
    }
    stopHostEvents(); services.dispose();
  };
  const toggleHeader = async () => {
    if (disposed) return;
    const result = await services.preferences.toggleViewHeader();
    if (!result.ok) services.notifications.show('header-toggle', 'error', result.error.key, true, 'runtime');
  };
  try {
    plugin.registerView(SHOWCASE_VIEW, leaf => new ShowcaseView(leaf,
      (root, actions) => mountShowcase(root, services, actions, refresh => {
        const workspace = plugin.app.workspace;
        const refs = [workspace.on('layout-change', refresh), workspace.on('css-change', refresh), workspace.on('window-open', refresh)];
        return () => { for (const ref of refs) workspace.offref(ref); };
      }),
      { preferences: services.preferences, diagnostics: services.diagnostics, text, toggleHeader: () => { void toggleHeader(); } },
      (view, open) => { if (open) views.add(view); else views.delete(view); }));
    const open = async () => {
      if (disposed) return;
      try {
        const existing = plugin.app.workspace.getLeavesOfType(SHOWCASE_VIEW)[0];
        const leaf = existing ?? plugin.app.workspace.getLeaf('tab');
        if (!existing) await leaf.setViewState({ type: SHOWCASE_VIEW, active: true });
        await plugin.app.workspace.revealLeaf(leaf);
      } catch { services.diagnostics.report('view.open', 'view.open'); services.notifications.show('navigation', 'error', 'error.unexpected', true, 'runtime'); }
    };
    stopCommands = bindCommands(plugin, createCommands(services, { openShowcase: open, toggleHeader }), text, services.diagnostics);
    plugin.addSettingTab(new ShellSettingsTab(plugin, { preferences: services.preferences, notifications: services.notifications, text }));
    stopHostEvents = bindHostEvents(plugin, services.events, services.diagnostics, services.scheduler);
  } catch (error) { dispose(); new Notice(`${plugin.manifest.name} could not start. Check the installed version.`); throw error; }
  return { dispose, diagnosticSnapshot: () => services.diagnostics.current };
}
