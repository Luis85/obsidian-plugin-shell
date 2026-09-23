import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import ShowcaseApp from '../presentation/components/ShowcaseApp.vue';
import { contextKey } from '../presentation/context/use-services';
import type { Services } from './services';
import { bindHostTheme, type ObserveOwnerChange } from '../infrastructure/ui/host-theme';
import { pluginIdentity } from '../infrastructure/plugin-identity';
let mountSequence = 0;
export function mountShowcase(root: HTMLElement, services: Services, showViewActions?: (event: MouseEvent) => void, observeOwner?: ObserveOwnerChange): () => void {
  const releases: (() => void)[] = []; let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    let failed = false; let firstError: unknown;
    for (const release of Array.from(releases).reverse()) {
      try { release(); } catch (error) {
        if (!failed) { failed = true; firstError = error; }
        services.diagnostics.report('view.cleanup', 'view.close');
      }
    }
    if (failed) throw firstError;
  };
  try {
    root.classList.add(pluginIdentity.rootClass); root.dataset.pluginUi = pluginIdentity.id;
    releases.push(bindHostTheme(root, observeOwner));
    const pinia = createPinia(); releases.push(() => disposePinia(pinia));
    // This shared browser/native boundary needs a detached node in the owning document.
    // eslint-disable-next-line obsidianmd/prefer-create-el -- Obsidian DOM extensions are absent in the browser harness.
    const surface = root.ownerDocument.createElement('div'); surface.className = 'shell-vue-mount'; releases.push(() => surface.remove());
    const i18n = createI18n({ legacy: false, locale: services.preferences.current.locale,
      fallbackLocale: services.i18n.global.fallbackLocale.value, messages: services.i18n.global.messages.value });
    releases.push(() => i18n.dispose());
    releases.push(services.preferences.subscribe(value => { i18n.global.locale.value = value.locale; }));
    const app = createApp(ShowcaseApp, { portalRoot: surface, showViewActions }); let mounted = false;
    releases.push(() => { if (mounted) app.unmount(); });
    app.config.idPrefix = `${pluginIdentity.id}-${++mountSequence}-`;
    app.config.errorHandler = () => services.diagnostics.report('vue.unexpected', 'view.render');
    app.use(pinia); app.use(i18n); app.use(ui); app.provide(contextKey, services);
    // Finish Vue's own mount before host attachment can fail. Teleports stay owned
    // by this detached surface so they cannot bypass the attachment boundary.
    app.mount(surface); mounted = true; root.insertBefore(surface, null);
    return close;
  } catch (error) { try { close(); } catch { /* Cleanup faults were observed; preserve the original mount failure. */ } throw error; }
}
