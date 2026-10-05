import { validateSettings } from '../documentation/adapters/settings.ts';
import { collectionPathKeys, collectionRoot, settingsPath, setupStatePath, type UserSettings } from '../domain/user-settings.ts';
import { requireSketch } from '../domain/errors.ts';
import { projectConfigFolder } from '../compiler/domain/project-config.ts';
/** One semantic validator belongs to the documentation owner; maker writes cannot bypass it. */
export function documentationSettings(settings: UserSettings) {
  const protectedPaths = [...Object.values(settings.paths), ...collectionPathKeys.map(key => collectionRoot(settings.paths, key)), settings.preferences.vaultConfigDirectory,
    settingsPath, setupStatePath, 'configs/project-setup-draft.json', projectConfigFolder];
  const documentation = validateSettings(settings.documentation ?? {}, protectedPaths);
  const index = documentation.indexFile.toLowerCase();
  requireSketch(!protectedPaths.some(path => {
    const location = path.toLowerCase();
    return location === index || index.startsWith(location + '/') || location.startsWith(index + '/');
  }), 'SETTINGS_OVERLAP', 'Documentation index overlaps a configured project path.');
  return documentation;
}
export function validateDocumentationSettings(settings: UserSettings): void {
  if (settings.documentation !== undefined) documentationSettings(settings);
}
