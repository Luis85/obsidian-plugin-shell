import { defineEvent } from '../event-definition';
import type { ShellEvents } from '../events';
import { record, natural, path, kind } from './validation';
const entryFact = (value: unknown): value is ShellEvents['host.vault.entry-created'] =>
  record(value, ['path', 'kind']) && path(value.path) && kind(value.kind);
export const activeFileChanged = defineEvent(
  'host.active-file-changed',
  (value: unknown): value is ShellEvents['host.active-file-changed'] =>
    record(value, ['available']) && typeof value.available === 'boolean',
);
export const entryCreated = defineEvent(
  'host.vault.entry-created',
  (value: unknown): value is ShellEvents['host.vault.entry-created'] => entryFact(value),
);
export const entryModified = defineEvent(
  'host.vault.entry-modified',
  (value: unknown): value is ShellEvents['host.vault.entry-modified'] =>
    record(value, ['path', 'modifiedTime']) &&
    path(value.path) &&
    (value.modifiedTime === null || natural(value.modifiedTime)),
);
export const entryRenamed = defineEvent(
  'host.vault.entry-renamed',
  (value: unknown): value is ShellEvents['host.vault.entry-renamed'] =>
    record(value, ['path', 'oldPath', 'kind']) && path(value.path) && path(value.oldPath) && kind(value.kind),
);
export const entryDeleted = defineEvent(
  'host.vault.entry-deleted',
  (value: unknown): value is ShellEvents['host.vault.entry-deleted'] => entryFact(value),
);
export const fileOpened = defineEvent(
  'host.workspace.file-opened',
  (value: unknown): value is ShellEvents['host.workspace.file-opened'] =>
    record(value, ['path']) && (value.path === null || path(value.path)),
);
export const activeViewChanged = defineEvent(
  'host.workspace.active-view-changed',
  (value: unknown): value is ShellEvents['host.workspace.active-view-changed'] =>
    record(value, ['viewType']) && (value.viewType === null || typeof value.viewType === 'string'),
);
export const layoutChanged = defineEvent(
  'host.workspace.layout-changed',
  (value: unknown): value is ShellEvents['host.workspace.layout-changed'] =>
    record(value, ['revision']) && natural(value.revision),
);
export const metadataChanged = defineEvent(
  'host.metadata.changed',
  (value: unknown): value is ShellEvents['host.metadata.changed'] => record(value, ['path']) && path(value.path),
);
export const hostEvents = [
  activeFileChanged,
  entryCreated,
  entryModified,
  entryRenamed,
  entryDeleted,
  fileOpened,
  activeViewChanged,
  layoutChanged,
  metadataChanged,
] as const;
