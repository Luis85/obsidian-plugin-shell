import { composeEvents, type EventDefinition } from '../application/event-definition';
import { coreEvents } from '../application/event-definitions/core';
import { hostEvents } from '../application/event-definitions/host';
import { exampleEvents } from './example-events';
const featureEvents: readonly EventDefinition[] = [];
export const runtimeEventDefinitions = composeEvents(coreEvents, hostEvents, exampleEvents, featureEvents);
