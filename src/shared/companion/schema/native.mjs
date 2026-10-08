import { record, text, line, list, choice } from './primitives.mjs';
import { nativeReservedExtensions } from '../native-contract.mjs';
const id = { ...text(48, 1), pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' };
const extension = { ...text(16, 1), pattern: '^[a-z][a-z0-9]{0,15}$' };
export const nativeSchema = record({ schemaVersion: { const: 1 },
  fileTypes: list(record({ id, name: line(80), extension: { ...extension, not: { enum: [...nativeReservedExtensions] } },
    format: choice(['json', 'text']), initialContent: text(65536) }), 12),
  contextMenus: list(record({ id, name: line(80), extensions: { ...list(extension, 16, 1), uniqueItems: true } }), 24),
});
