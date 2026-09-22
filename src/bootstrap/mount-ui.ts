import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import ShowcaseApp from '../presentation/ShowcaseApp.vue';
import { contextKey } from '../presentation/context';
import type { Services } from './services';
let mountSequence = 0;
export function mountShowcase(root: HTMLElement, services: Services): () => void {
  root.classList.add('plugin-shell'); root.dataset.pluginUi = 'plugin-shell';
  const document = root.ownerDocument;
  const syncTheme = () => {
    const dark = document.body.classList.contains('theme-dark');
    root.classList.toggle('dark', dark); root.classList.toggle('light', !dark);
  };
  syncTheme();
  const WindowObserver = document.defaultView?.MutationObserver ?? MutationObserver;
  const observer = new WindowObserver(syncTheme);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const pinia = createPinia();
  const app = createApp(ShowcaseApp, { portalRoot: root });
  app.config.idPrefix = `shell-${++mountSequence}-`;
  app.config.errorHandler = () => services.diagnostics.report('vue.unexpected', 'view.render');
  app.use(pinia); app.use(services.i18n); app.use(ui); app.provide(contextKey, services);
  try { app.mount(root); } catch (error) { observer.disconnect(); disposePinia(pinia); throw error; }
  let closed = false;
  return () => { if (closed) return; closed = true; observer.disconnect(); app.unmount(); disposePinia(pinia); };
}
