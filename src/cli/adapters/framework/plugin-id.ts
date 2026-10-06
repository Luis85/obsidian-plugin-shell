/** One plugin-ID rule for project creation (`new`) and the submission mirror (`check submission`),
 * so a project the framework creates never fails its own submission check on the ID.
 * Manifest reference: "can't end with `plugin`, and can't contain `obsidian`"; the automated
 * review rule (validate-manifest) also rejects "plugin" anywhere in the ID. */
const createPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 60;
/** The reserved-word problem shared by both commands, or null. */
export function pluginIdWordProblem(id: string): string | null {
  if (id.includes('obsidian')) return 'id must not contain "obsidian".';
  if (id.endsWith('plugin')) return 'id must not end with "plugin".';
  if (id.includes('plugin')) return 'id must not contain "plugin" (validate-manifest).';
  return null;
}
/** Remove reserved words and anything outside lowercase letters, digits and single hyphens. */
function slug(text: string): string {
  return text.toLowerCase().replaceAll('obsidian', '-').replaceAll('plugin', '-').replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '').slice(0, MAX_LENGTH).replace(/-+$/, '');
}
/** IDs shorter than this are too generic to derive silently (for example `my` from `my-plugin`). */
const MIN_DERIVED = 3;
/**
 * The default ID for a new project folder: the folder name without "obsidian"/"plugin" words.
 * A shorter remainder is combined with the starter's own (cleaned) ID, for example `my-plugin`
 * with starter `quick-capture` gives `my-quick-capture`; without a usable starter ID it becomes
 * `<remainder>-project` (`my-project`).
 */
export function derivedPluginId(name: string, starterId: string): string {
  const base = slug(name), starter = slug(starterId);
  const valid = (id: string) => id.length >= MIN_DERIVED && pluginIdProblem(id) === null;
  if (valid(base)) return base;
  const combined = base && starter !== base ? `${base}-${starter}` : '';
  if (starter.length >= MIN_DERIVED && valid(combined)) return combined;
  if (valid(starter)) return starter;
  return `${base || 'my'}-project`;
}
function formatProblem(id: string): string | null {
  return id.length > MAX_LENGTH || !createPattern.test(id) ? 'Use lowercase letters, digits and single hyphens, starting with a letter (at most 60 characters).' : null;
}
const withSuggestion = (id: string, word: string) => `Obsidian plugin IDs are checked by the community review: ${word} For example: --id ${derivedPluginId(id, '')}`;
/** Rejects IDs the framework must not create (derived or given with --id); names a usable suggestion. */
export function pluginIdProblem(id: string): string | null {
  const word = formatProblem(id) ? null : pluginIdWordProblem(id);
  return formatProblem(id) ?? (word ? withSuggestion(id, word) : null);
}
/** An exported companion project brings its own ID. "obsidian" is refused (a hard manifest rule);
 * "plugin" is reported as a warning, because refusing would block the companion's own exports. */
export function exportedIdProblem(id: string): string | null {
  return formatProblem(id) ?? (id.includes('obsidian') ? withSuggestion(id, 'id must not contain "obsidian".') : null);
}
export function exportedIdWarning(id: string): string | null {
  const word = exportedIdProblem(id) ? null : pluginIdWordProblem(id);
  return word ? `The exported plugin ID "${id}" will fail check submission: ${word} Pass --id ${derivedPluginId(id, '')} (or another ID) to change it.` : null;
}
