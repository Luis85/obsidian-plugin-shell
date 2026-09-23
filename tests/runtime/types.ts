import type { EventInput, ShellEvents } from '../../src/application/events';
import type { DocumentCreationService } from '../../src/application/document-service';
import type { EntityInputs } from '../../src/features/tasks/form';
import { taskEntity, type TaskValues } from '../../src/features/tasks/entity';
import { projectEntity } from '../../src/features/projects/entity';
import { createNoteFeatures } from '../../src/application/note-feature';
import { taskFeature } from '../../src/features/tasks/definition';
import { projectFeature } from '../../src/features/projects/definition';
import { defineCommand, defineRibbon } from '../../src/features/api';
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
  // Defaults are optional on input; genuinely optional output fields can be omitted.
  taskEntity.parse({ title: 'Task' });
  const task: TaskValues = { title: 'Task', status: 'done', tags: [] };
  const due: string | undefined = task.due;
  projectEntity.parse({ name: 'Project', budget: 0, archived: false });
  // @ts-expect-error Defaulted status is materialized and required on output.
  const missingStatus: TaskValues = { title: 'Task', tags: [] };
  // @ts-expect-error Repository inputs use a list, never comma-separated form text.
  taskEntity.parse({ title: 'Task', tags: 'one,two' });
  // @ts-expect-error Enum inputs remain the declared literal union.
  taskEntity.parse({ title: 'Task', status: 'unknown' });
  // @ts-expect-error Managed identity is never a caller-supplied entity field.
  taskEntity.parse({ title: 'Task', id: 'caller-id' });
  // @ts-expect-error Distinct entity inputs are not interchangeable.
  projectEntity.parse({ title: 'Task', status: 'todo' });
  // @ts-expect-error Numbers and booleans remain typed, not coerced strings.
  projectEntity.parse({ name: 'Project', budget: '0', archived: 'false' });
  void task; void due; void missingStatus;
}
export function featureTypeContract(shared: Parameters<typeof createNoteFeatures>[0]): void {
  const features = createNoteFeatures(shared, register => ({ task: register(taskFeature), project: register(projectFeature) }));
  void features.repositories.task.create({ title: 'Task', tags: ['work'] }, 'task');
  void features.repositories.project.create({ name: 'Project', budget: 0, archived: false }, 'project');
  // @ts-expect-error Only explicitly registered feature keys exist.
  void features.repositories.meeting;
  // @ts-expect-error Repository inputs are inferred from their feature definition.
  void features.repositories.task.create({ name: 'Project' }, 'mismatch');
  // @ts-expect-error Fields retain their declared numeric type through registration.
  void features.repositories.project.create({ name: 'Project', budget: '0' }, 'bad');
  features.dispose();
  // @ts-expect-error Async registration would escape synchronous ownership/rollback.
  createNoteFeatures(shared, async register => ({ task: register(taskFeature) }));
}
export function commandTypeContract(): void {
  const open = defineCommand({ id: 'open-example', titleKey: 'command.open', execute() {} });
  const ribbon = defineRibbon(open, { id: 'example-ribbon', icon: 'blocks' });
  const id: 'open-example' = ribbon.command.id;
  // @ts-expect-error Availability is a synchronous query, not asynchronous work.
  defineCommand({ id: 'bad-check', titleKey: 'command.open', execute() {}, available: async () => true });
  // @ts-expect-error Handlers return void or an explicit application Result, never arbitrary values.
  defineCommand({ id: 'bad-result', titleKey: 'command.open', execute: () => 'success' });
  // @ts-expect-error Ribbon bindings reference a typed command, not a duplicate callback/string name.
  defineRibbon('open-example', { id: 'bad-ribbon', icon: 'blocks' });
  void id;
}
