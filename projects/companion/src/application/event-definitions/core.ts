import { defineEvent } from '../event-definition';
import type { ShellEvents } from '../events';
import { record, natural, path } from './validation';
const dataFact = (value: unknown): value is ShellEvents['plugin-data.created'] =>
  record(value, ['entity', 'id', 'schemaVersion', 'revision']) &&
  path(value.entity) &&
  path(value.id) &&
  natural(value.schemaVersion) &&
  natural(value.revision);
const documentFact = (value: unknown): value is ShellEvents['documents.created'] =>
  record(value, ['entity', 'id', 'schemaVersion', 'path']) &&
  path(value.entity) &&
  path(value.id) &&
  natural(value.schemaVersion) &&
  path(value.path);
const revisionFact = (value: unknown): value is ShellEvents['preferences.changed'] =>
  record(value, ['revision']) && natural(value.revision);
export const pluginDataCreated = defineEvent('plugin-data.created', dataFact);
export const pluginDataUpdated = defineEvent('plugin-data.updated', dataFact);
export const pluginDataDeleted = defineEvent('plugin-data.deleted', dataFact);
export const documentCreated = defineEvent('documents.created', documentFact);
export const documentUpdated = defineEvent('documents.updated', documentFact);
export const documentDeleted = defineEvent('documents.deleted', documentFact);
export const preferencesChanged = defineEvent('preferences.changed', revisionFact);
export const coreEvents = [
  pluginDataCreated,
  pluginDataUpdated,
  pluginDataDeleted,
  documentCreated,
  documentUpdated,
  documentDeleted,
  preferencesChanged,
] as const;
