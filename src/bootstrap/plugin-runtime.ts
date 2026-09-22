import { Notice, type Plugin } from 'obsidian';
import { createServices } from './services';
import { mountShowcase } from './mount-ui';
import { nativeAdapters } from '../infrastructure/obsidian/adapters';
import { ShellSettingsTab } from '../infrastructure/obsidian/settings-tab';
import { ShowcaseView, SHOWCASE_VIEW } from '../infrastructure/obsidian/showcase-view';
export async function initializePlugin(plugin: Plugin) {
  const services = await createServices(nativeAdapters(plugin));
  let disposed = false;
  const mounts = new Set<() => void>();
  const mount = (root: HTMLElement) => {
    const close = mountShowcase(root, services);
    const dispose = () => { close(); mounts.delete(dispose); };
    mounts.add(dispose); return dispose;
  };
  try {
    plugin.registerView(SHOWCASE_VIEW, leaf => new ShowcaseView(leaf, mount));
    const open = async () => {
      if (disposed) return;
      try {
        const existing = plugin.app.workspace.getLeavesOfType(SHOWCASE_VIEW)[0];
        const leaf = existing ?? plugin.app.workspace.getLeaf('tab');
        if (!existing) await leaf.setViewState({ type: SHOWCASE_VIEW, active: true });
        await plugin.app.workspace.revealLeaf(leaf);
      } catch { services.diagnostics.report('view.open', 'view.open'); services.notifications.show('navigation', 'error', 'error.unexpected', true); }
    };
    plugin.addCommand({ id: 'open-showcase', name: services.i18n.global.t('command.open'), callback: () => { void open(); } });
    plugin.addRibbonIcon('blocks', services.i18n.global.t('command.open'), () => { void open(); });
    plugin.addSettingTab(new ShellSettingsTab(plugin, { preferences: services.preferences, notifications: services.notifications, text: key => services.i18n.global.t(key) }));
    plugin.app.workspace.onLayoutReady(() => {
      if (disposed) return;
      plugin.registerEvent(plugin.app.workspace.on('file-open', file => services.events.publish({ type: 'host.active-file-changed', payload: { available: file !== null } })));
    });
  } catch (error) { services.dispose(); new Notice('Plugin shell could not start. Check the installed version.'); throw error; }
  return { dispose() { disposed = true; for (const close of mounts) close(); services.dispose(); } };
}
