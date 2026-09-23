import manifest from '../../manifest.json';

/** Build-time identity shared by native views and browser composition. */
export const pluginIdentity = Object.freeze({
  id: manifest.id,
  name: manifest.name,
  version: manifest.version,
  viewType: `${manifest.id}-showcase`,
  rootClass: manifest.id,
  hostClass: `${manifest.id}-host`,
  hiddenHeaderClass: `${manifest.id}-native-header-hidden`,
});
