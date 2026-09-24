/** Author-facing building blocks. Runtime ports and host wiring stay in bootstrap. */
export { defineEntity, fields } from '../domain/entity';
export { defineDocument, heading } from '../application/document-definition';
export { defineNoteFeature } from '../application/note-feature';
export { definePluginDataFeature } from '../application/plugin-data-feature';
export { defineCommand, defineRibbon } from '../application/command-definitions';
export { defineLogCatalog } from '../application/logging';
export { BooleanSetting } from '../application/boolean-setting';
export { defineEvent } from '../application/event-definition';
export { createActionScope } from '../application/action-scope';
export type { ActionScope, OperationPermit } from '../application/action-scope';
export type { Result, Failure } from '../domain/outcome';
export type { NoteSnapshot } from '../application/note-repository';
export type { PluginDataStatus } from '../application/plugin-data-store';
export type { AuthoringServices, AuthoringExtension } from '../application/authoring';
export type { LifecycleObservation, Diagnostic } from '../application/ports';
export type { EventDefinition, EventPayload, EventMapOf } from '../application/event-definition';
export type { EventObserver, EventPublisher, EventSubscriber, EventInput } from '../application/events';
