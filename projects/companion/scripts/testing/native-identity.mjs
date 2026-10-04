import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Read the built candidate identity; never rewrite source, settings or installed data. */
export function nativeIdentity(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('NATIVE_MANIFEST_INVALID');
  const { id, name, version } = manifest;
  if (typeof id !== 'string' || id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id)) throw new Error('NATIVE_MANIFEST_ID');
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.length > 80
    || Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('NATIVE_MANIFEST_NAME');
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('NATIVE_MANIFEST_VERSION');
  const viewType = `${id}-showcase`;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Object.freeze({ id, name, version, viewType, viewSelector: `.workspace-leaf-content[data-type="${viewType}"]`,
    headerMarker: `${id}-native-header-hidden`, pluginDirectory: `.obsidian/plugins/${id}`, settingsName: new RegExp(`^${escapedName}$`, 'i') });
}
export async function readNativeIdentity(path = resolve('dist/manifest.json')) {
  return nativeIdentity(JSON.parse(await readFile(path, 'utf8')));
}
