import { createAuthoringRuntime, type AuthoringExtension, type AuthoringServices } from '../application/authoring';
import type { EventDefinition, EventMapOf } from '../application/event-definition';
import type { EventPublisher, EventSubscriber } from '../application/events';
import type { Component } from 'vue';
import type { createFeatures } from './features';

type Capabilities = AuthoringServices & {
  readonly repositories: ReturnType<typeof createFeatures>['repositories'];
};
type PublisherFactory = <D extends EventDefinition>(definition: D) => EventPublisher<EventMapOf<D>>;
type SubscriberFactory = <N extends string, P>(definition: EventDefinition<N, P>) => EventSubscriber<P>;
const authoringFactories: readonly ((
  services: Capabilities,
  publisher: PublisherFactory,
  subscriber: SubscriberFactory,
) => AuthoringExtension)[] = [];
export const authoringPanels: readonly {
  readonly id: string;
  readonly titleKey: string;
  readonly component: Component;
  readonly props: (services: Capabilities) => Record<string, unknown>;
}[] = [];
export function createAuthoring(services: Capabilities, publisher: PublisherFactory, subscriber: SubscriberFactory) {
  return createAuthoringRuntime(
    authoringFactories.map((factory) => (capabilities: Capabilities) => factory(capabilities, publisher, subscriber)),
    services,
  );
}
export function createAuthoringPanels(services: Capabilities) {
  return assembleAuthoringPanels(authoringPanels, services);
}
export function assembleAuthoringPanels<T>(
  panels: readonly {
    readonly id: string;
    readonly component: Component;
    readonly props: (services: T) => Record<string, unknown>;
  }[],
  services: T,
) {
  const seen = new Set<string>();
  return panels.map((panel) => {
    if (seen.has(panel.id)) throw new Error('AUTHORING_DUPLICATE_PANEL');
    seen.add(panel.id);
    return {
      id: panel.id,
      component: panel.component,
      props: panel.props(services),
    };
  });
}
