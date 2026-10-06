/** Optional v5 project namespace. JSON describes capabilities, never executable handlers. */
export const nativeReservedExtensions = Object.freeze([
  'md',
  'markdown',
  'canvas',
  'base',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
  'bmp',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'flac',
  'mp4',
  'webm',
  'ogv',
  'mov',
  '3gp',
]);
const nativeExtension = (value) => typeof value === 'string' && /^[a-z][a-z0-9]{0,15}$/.test(value);
function nativeRequire(condition, message) {
  if (!condition) throw new Error('NATIVE_INTEGRATION_INVALID: ' + message);
}
function nativeObject(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function validateNativeIntegrations(value) {
  if (value === undefined) return { schemaVersion: 1, fileTypes: [], contextMenus: [] };
  nativeRequire(
    nativeObject(value, ['schemaVersion', 'fileTypes', 'contextMenus']) && value.schemaVersion === 1,
    'Expected namespace schemaVersion 1.',
  );
  nativeRequire(
    Array.isArray(value.fileTypes) &&
      value.fileTypes.length <= 12 &&
      Array.isArray(value.contextMenus) &&
      value.contextMenus.length <= 24,
    'At most 12 file types and 24 menu actions.',
  );
  const ids = new Set(),
    extensions = new Set();
  for (const [kind, definitions, keys] of [
    ['file', value.fileTypes, ['id', 'name', 'extension', 'format', 'initialContent']],
    ['menu', value.contextMenus, ['id', 'name', 'extensions']],
  ]) {
    for (const definition of definitions) {
      nativeRequire(nativeObject(definition, keys), 'Unknown or missing ' + kind + ' declaration field.');
      nativeRequire(
        typeof definition.id === 'string' &&
          /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) &&
          definition.id.length <= 48 &&
          !ids.has(definition.id),
        'Use unique lowercase IDs.',
      );
      ids.add(definition.id);
      nativeRequire(
        typeof definition.name === 'string' &&
          definition.name.trim() &&
          definition.name.length <= 80 &&
          !/[\r\n]/.test(definition.name),
        definition.id + ': use a single-line name.',
      );
      if (kind === 'file') {
        nativeRequire(
          nativeExtension(definition.extension) &&
            !nativeReservedExtensions.includes(definition.extension) &&
            !extensions.has(definition.extension),
          definition.id + ': extension must be unique, lowercase, dotless and not owned by Obsidian.',
        );
        extensions.add(definition.extension);
        nativeRequire(
          ['json', 'text'].includes(definition.format) &&
            typeof definition.initialContent === 'string' &&
            definition.initialContent.length <= 65536,
          definition.id + ': expected json/text and bounded initialContent.',
        );
        if (definition.format === 'json') {
          try {
            JSON.parse(definition.initialContent);
          } catch {
            throw new Error('NATIVE_INTEGRATION_INVALID: ' + definition.id + ': initialContent must be valid JSON.');
          }
        }
      } else
        nativeRequire(
          Array.isArray(definition.extensions) &&
            definition.extensions.length > 0 &&
            definition.extensions.length <= 16 &&
            definition.extensions.every(nativeExtension) &&
            new Set(definition.extensions).size === definition.extensions.length,
          definition.id + ': expected unique extension filters.',
        );
    }
  }
  return value;
}
