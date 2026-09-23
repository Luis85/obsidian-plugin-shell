import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import ShowcaseApp from '../presentation/components/ShowcaseApp.vue';
import { contextKey } from '../presentation/context/use-services';
import type { Services } from './services';
import { bindHostTheme, type ObserveOwnerChange } from '../infrastructure/ui/host-theme';
import { pluginIdentity } from '../infrastructure/plugin-identity';
let mountSequence = 0;
export function mountShowcase(root: HTMLElement, services: Services, showViewActions?: (event: MouseEvent) => void, observeOwner?: ObserveOwnerChange): () => void {
  root.classList.add(pluginIdentity.rootClass); root.dataset.pluginUi = pluginIdentity.id;
  const stopTheme = bindHostTheme(root, observeOwner);
  const pinia = createPinia();
  const app = createApp(ShowcaseApp, { portalRoot: root, showViewActions });
  app.config.idPrefix = `${pluginIdentity.id}-${++mountSequence}-`;
  app.config.errorHandler = () => services.diagnostics.report('vue.unexpected', 'view.render');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; stopTheme();
    try { app.unmount(); } finally { disposePinia(pinia); }
  };
  try {
    app.use(pinia); app.use(services.i18n); app.use(ui); app.provide(contextKey, services);
    app.mount(root);
    return close;
  } catch (error) { close(); throw error; }
}
