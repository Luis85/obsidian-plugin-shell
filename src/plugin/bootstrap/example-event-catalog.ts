import { showcasePing } from '../features/showcase/events';
export const exampleEventCatalog = [
  {
    definition: showcasePing,
    owner: 'showcase',
    meaning: 'Explicit demonstration command sequence',
    version: 1,
    publisher: 'showcase command',
    subscribers: ['view projections'],
    origin: 'application',
    sensitivity: 'none',
    delivery: 'Synchronous start; snapshot; no replay; owned subscriptions.',
  },
] as const;
