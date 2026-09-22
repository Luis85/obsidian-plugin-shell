import { Notice, type Plugin } from 'obsidian';
import { createServices } from './services';
import { mountShowcase } from './mount-ui';
import { nativeAdapters } from '../infrastructure/obsidian/adapters';
import { ShellSettingsTab } from '../infrastructure/obsidian/settings-tab';
import { ShowcaseView, SHOWCASE_VIEW } from '../infrastructure/obsidian/showcase-view';
export async function initializePlugin(plugin: Plugin) {
  const services = await createServices(nativeAdapters(plugin));
  let disposed = false;
  const views = new Set<ShowcaseView>();
  const text = (key: string) => services.i18n.global.t(key);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const view of Array.from(views)) {
      try { view.disposeView(); } catch { services.diagnostics.report('view.dispose', 'view.close'); }
    }
    services.dispose();
  };
  const toggleHeader = async () => {
    if (disposed) return;
    const result = await services.preferences.toggleViewHeader();
    if (!result.ok) services.notifications.show('header-toggle', 'error', result.error.key, true);
  };
  try {
    plugin.registerView(SHOWCASE_VIEW, leaf => new ShowcaseView(leaf,
      (root, actions) => mountShowcase(root, services, actions),
      { preferences: services.preferences, diagnostics: services.diagnostics, text, toggleHeader: () => { void toggleHeader(); } },
      (view, open) => { if (open) views.add(view); else views.delete(view); }));
    const open = async () => {
      if (disposed) return;
      try {
        const existing = plugin.app.workspace.getLeavesOfType(SHOWCASE_VIEW)[0];
        const leaf = existing ?? plugin.app.workspace.getLeaf('tab');
        if (!existing) await leaf.setViewState({ type: SHOWCASE_VIEW, active: true });
        await plugin.app.workspace.revealLeaf(leaf);
      } catch { services.diagnostics.report('view.open', 'view.open'); services.notifications.show('navigation', 'error', 'error.unexpected', true); }
    };
    plugin.addCommand({ id: 'open-showcase', name: text('command.open'), callback: () => { void open(); } });
    plugin.addCommand({ id: 'toggle-view-header', name: text('command.toggleHeader'), callback: () => { void toggleHeader(); } });
    plugin.addRibbonIcon('blocks', text('command.open'), () => { void open(); });
    plugin.addSettingTab(new ShellSettingsTab(plugin, { preferences: services.preferences, notifications: services.notifications, text }));
    plugin.app.workspace.onLayoutReady(() => {
      if (disposed) return;
      plugin.registerEvent(plugin.app.workspace.on('file-open', file => services.events.publish({ type: 'host.active-file-changed', payload: { available: file !== null } })));
    });
  } catch (error) { dispose(); new Notice('Plugin shell could not start. Check the installed version.'); throw error; }
  return { dispose, diagnosticSnapshot: () => services.diagnostics.current };
}
