import type { EventInput, ShellEvents } from '../../src/application/events';
import type { DocumentCreationService } from '../../src/application/document-service';
import type { EntityInputs } from '../../src/application/task-document';
const good: EventInput<ShellEvents> = { type: 'showcase.ping', payload: { sequence: 1 } };
// @ts-expect-error Unknown event names must be rejected.
const badName: EventInput<ShellEvents> = { type: 'unknown', payload: {} };
// @ts-expect-error The name and payload remain correlated.
const badPayload: EventInput<ShellEvents> = { type: 'showcase.ping', payload: { path: 'x' } };
export function typeContract(documents: DocumentCreationService<EntityInputs>): void {
  // @ts-expect-error Unknown entity keys are rejected.
  documents.prepare('meeting', {}, 'Tasks', 'id');
  // @ts-expect-error Incorrect Task values are rejected.
  documents.prepare('task', { title: 42 }, 'Tasks', 'id');
  void good; void badName; void badPayload;
}
