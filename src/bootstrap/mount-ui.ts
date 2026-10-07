import ShowcaseApp from '../presentation/components/ShowcaseApp.vue';
import AuthoringView from '../presentation/components/AuthoringView.vue';
import { authoringContextKey } from '../presentation/context/authoring-context';
import { createAuthoringPanels } from './authoring';
import type { Services } from './services';
import type { ObserveOwnerChange } from '../infrastructure/ui/host-theme';
import { mountVueSurface } from './vue-surface';
export function mountShowcase(root: HTMLElement, services: Services, showViewActions?: (event: MouseEvent) => void, observeOwner?: ObserveOwnerChange, panelId?: string): () => void {
  const panels = createAuthoringPanels(services).filter(panel => panelId === undefined || panel.id === panelId);
  if (panelId !== undefined && panels.length !== 1) throw new Error('AUTHORING_VIEW_NOT_REGISTERED');
  return mountVueSurface(root, services, {
    component: panelId === undefined ? ShowcaseApp : AuthoringView,
    props: portalRoot => ({ portalRoot, showViewActions }),
    provide: app => app.provide(authoringContextKey, { services, panels }),
    observeOwner,
  });
}
