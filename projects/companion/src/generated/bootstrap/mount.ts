import { createApp } from 'vue';
import ui from '@nuxt/ui/vue-plugin';
import { createPinia, disposePinia } from 'pinia';
import type { Services } from "../../bootstrap/services.ts";
import { bindHostTheme } from "../../infrastructure/ui/host-theme.ts";
import Workbench from '../presentation/components/ProjectWorkbench.vue';
import { projectKey } from '../presentation/context/project.ts';
import type { Sources } from '../application/sources.ts';
import { panels } from './panels.ts';
import { bindFlows } from './flows.ts';
import { provideVisualContext } from '../presentation/composables/use-visual.ts';
import { createVisualContext } from './visual-context.ts';
import '../presentation/detail-layout.css';
import { provideJourney, type JourneyRuntime } from './journey-workspace.ts';
export function mountProject(root: HTMLElement,shell: Services,sources: Sources,openModal: (id: string) => void,initial?: string,isolated = false,journey?: JourneyRuntime) {
  const pinia = createPinia(); const app = createApp(Workbench); let mounted = false; let closed = false; let theme = () => {};
  const close = () => { if (closed) return; closed = true; try { if (mounted) app.unmount(); } finally { disposePinia(pinia); theme(); } };
  try {
    root.classList.add(shell.identity.rootClass,shell.identity.scopeClass); root.dataset.pluginUi = shell.identity.id;
    theme = bindHostTheme(root); app.use(pinia); app.use(ui); provideVisualContext(app, createVisualContext(sources, pinia, openModal)); app.provide(projectKey,{panels,flows:bindFlows(sources,pinia),initial,isolated,openModal});
    app.config.errorHandler = () => shell.diagnostics.report('generated.render','view.render');
    if (journey) provideJourney(app,pinia,journey);
    mounted = true; app.mount(root); return close;
  } catch (error) { close(); throw error; }
}
