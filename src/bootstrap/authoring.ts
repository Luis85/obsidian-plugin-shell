import { createAuthoringRuntime, type AuthoringFactory, type AuthoringServices } from '../application/authoring';
import type { Component } from 'vue';
import type { createFeatures } from './features';

type Capabilities = AuthoringServices & { readonly repositories: ReturnType<typeof createFeatures>['repositories'] };
const authoringFactories: readonly AuthoringFactory<Capabilities>[] = [
];
export const authoringPanels: readonly { readonly id: string; readonly titleKey: string; readonly component: Component; readonly props: (services: Capabilities) => Record<string, unknown> }[] = [
];
export function createAuthoring(services: Capabilities) { return createAuthoringRuntime(authoringFactories, services); }
export function createAuthoringPanels(services: Capabilities) {
  return assembleAuthoringPanels(authoringPanels, services);
}
export function assembleAuthoringPanels<T>(panels: readonly { readonly id: string; readonly component: Component; readonly props: (services: T) => Record<string, unknown> }[], services: T) {
  const seen = new Set<string>();
  return panels.map(panel => {
    if (seen.has(panel.id)) throw new Error('AUTHORING_DUPLICATE_PANEL');
    seen.add(panel.id);
    return { id: panel.id, component: panel.component, props: panel.props(services) };
  });
}

