import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import ShowcaseApp from '../presentation/ShowcaseApp.vue';
import { contextKey } from '../presentation/context';
import type { Services } from './services';
let mountSequence = 0;
export function mountShowcase(root: HTMLElement, services: Services, showViewActions?: (event: MouseEvent) => void): () => void {
  root.classList.add('plugin-shell'); root.dataset.pluginUi = 'plugin-shell';
  const document = root.ownerDocument;
  const syncTheme = () => {
    const dark = document.body.classList.contains('theme-dark');
    root.classList.toggle('dark', dark); root.classList.toggle('light', !dark);
  };
  const WindowObserver = document.defaultView?.MutationObserver;
  if (!WindowObserver) throw new Error('VIEW_DOCUMENT_UNAVAILABLE');
  const observer = new WindowObserver(syncTheme);
  const pinia = createPinia();
  const app = createApp(ShowcaseApp, { portalRoot: root, showViewActions });
  app.config.idPrefix = `shell-${++mountSequence}-`;
  app.config.errorHandler = () => services.diagnostics.report('vue.unexpected', 'view.render');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true; observer.disconnect();
    try { app.unmount(); } finally { disposePinia(pinia); }
  };
  try {
    syncTheme(); observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    app.use(pinia); app.use(services.i18n); app.use(ui); app.provide(contextKey, services);
    app.mount(root);
    return close;
  } catch (error) { close(); throw error; }
}
