import { coreEventCatalog, type EventCatalogEntry } from './core-event-catalog';
import { exampleEventCatalog } from './example-event-catalog';
export const featureEventCatalog: readonly EventCatalogEntry[] = [];
export const eventCatalog = [...coreEventCatalog, ...exampleEventCatalog, ...featureEventCatalog];
