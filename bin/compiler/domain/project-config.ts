import { CompilerError, diagnostic } from './diagnostics.ts';
/** The single location rule for a project's saved starter selection: `configs/<project-id>-config.json`, directly
 * inside `configs/`. Every reader, writer and message derives the path from this module; no caller spells it. */
export const projectConfigFolder = 'configs';
const suffix = '-config.json';
/** Placeholder form for messages and documentation. */
export const projectConfigPattern = `${projectConfigFolder}/<project-id>${suffix}`;
/** The retired root location. It is never read: finding it only yields a coded relocation diagnostic. */
export const retiredProjectConfigPath = 'project.config.json';
/** The portable lowercase ID rule shared by Companion v6 project identities and starter definitions. */
export const portableIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function isPortableId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 60 && portableIdPattern.test(value);
}
export function projectConfigPath(projectId: string): string {
  if (!isPortableId(projectId)) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', 'A project configuration needs a portable project ID.'));
  return `${projectConfigFolder}/${projectId}${suffix}`;
}
/** The project ID a contained relative path names, or undefined when it is not exactly a top-level project configuration. */
export function projectConfigId(path: string): string | undefined {
  const prefix = projectConfigFolder + '/';
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return undefined;
  const id = path.slice(prefix.length, -suffix.length);
  return isPortableId(id) ? id : undefined;
}
export type ProjectConfigDiscovery =
  | { kind: 'none' } | { kind: 'found'; path: string } | { kind: 'retired'; path: string }
  | { kind: 'ambiguous'; candidates: string[] } | { kind: 'invalid'; path: string } | { kind: 'missing'; path: string };
export interface ProjectConfigListing {
  /** Entry names directly inside `configs/` (subfolders such as starters/ or types/ are never searched). */
  names: readonly string[];
  /** Whether the retired root `project.config.json` exists. */
  retired: boolean;
  /** An explicitly chosen relative path, such as the CLI's --config option. */
  explicit?: string;
}
/** Every `*-config.json` entry of a `configs/` listing as a sorted relative path, valid name or not. */
export function projectConfigCandidates(names: readonly string[]): string[] {
  return names.filter(name => name.endsWith(suffix)).map(name => `${projectConfigFolder}/${name}`).sort();
}
/** Pure discovery: the explicit choice, otherwise the single `*-config.json` entry. The retired root file is never a fallback. */
export function discoverProjectConfig(listing: ProjectConfigListing): ProjectConfigDiscovery {
  if (listing.explicit !== undefined) {
    if (projectConfigId(listing.explicit) === undefined) return { kind: 'invalid', path: listing.explicit };
    const name = listing.explicit.slice(projectConfigFolder.length + 1);
    return listing.names.includes(name) ? { kind: 'found', path: listing.explicit } : { kind: 'missing', path: listing.explicit };
  }
  const candidates = projectConfigCandidates(listing.names);
  const invalid = candidates.find(path => projectConfigId(path) === undefined);
  if (invalid) return { kind: 'invalid', path: invalid };
  if (candidates.length > 1) return { kind: 'ambiguous', candidates };
  if (candidates.length === 1) return { kind: 'found', path: candidates[0]! };
  return listing.retired ? { kind: 'retired', path: retiredProjectConfigPath } : { kind: 'none' };
}
