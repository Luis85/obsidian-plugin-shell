/** Author-facing building blocks. Runtime ports and host wiring stay in bootstrap. */
export { defineEntity, fields } from '../domain/entity';
export { defineDocument, heading } from '../application/document-definition';
export { defineNoteFeature } from '../application/note-feature';
export { definePluginDataFeature } from '../application/plugin-data-feature';
export { defineCommand, defineRibbon } from '../application/command-definitions';
export { defineLogCatalog } from '../application/logging';
