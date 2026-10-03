/** A per-prototype Claude Design workspace: generated context plus design-owned areas that sync never touches. */
import { object, keys, text, list } from './data.ts';
import { requireSketch, slug } from './errors.ts';
import { resolveSurfaceAcceptance, validateSurfaceAcceptance } from '../../scripts/companion/sitemap/acceptance.ts';
export const designManifestFile = 'design.manifest.json';
export const defaultDesignRoot = 'docs/design';
/** Paths a designer, design agent or coding agent owns; a folder entry ends in a slash. */
export const designerOwned: readonly string[] = ['prototypes/', 'assets/', 'notes/', 'handoff/implementation-map.md'];
export interface DesignSelection { prototypeId: string; versionId: string; variantId: string }
export interface DesignSource { kind: 'project' | 'prototype-variant'; path: string; sha256: string; selection?: DesignSelection }
export interface DesignFile { path: string; sha256: string }
/** Where the prepared brief is reread from: a package path relative to the root, or a copy kept inside the folder. */
export interface DesignBrief { scope: 'root' | 'folder'; path: string }
export const keptBrief: DesignBrief = { scope: 'folder', path: 'notes/prototype-brief.md' };
export interface DesignManifest {
  /** folder is where the instructions were rendered for; a moved root makes the folder stale until synced. */
  kind: 'workbench-design-folder'; schemaVersion: 1; name: string; title: string; folder: string;
  project: { id: string; name: string }; source: DesignSource; brief: DesignBrief | null;
  targets: string[]; framework: string; managed: DesignFile[]; designerOwned: string[];
}
/** Folders are named after prototypes, so names, version and variant IDs share the prototype slug rule and its 48-character limit. */
const designNameLimit = 48;
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|constructor|prototype)$/;
export const isDesignSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= designNameLimit && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !reserved.test(value);
/** The folder name is a portable slug, never a path. */
export function designFolderName(value: unknown): string {
  requireSketch(isDesignSlug(value), 'DESIGN_NAME',
    `Use a lowercase prototype slug (letters, digits and single hyphens, starting with a letter, at most ${designNameLimit} characters).`);
  return value;
}
/** A folder name derived from a title; the prefix for a digit-leading title is applied before the length limit. */
export function designFolderSlug(title: string): string {
  return designFolderName(slug(title, 'prototype').slice(0, designNameLimit).replace(/-+$/, ''));
}
/** True when a folder-relative path belongs to the design work rather than to generation. */
function isDesignerOwned(path: string): boolean {
  return designerOwned.some(owned => owned.endsWith('/') ? path.startsWith(owned) : path === owned);
}
const digest = (value: unknown, name: string): string => {
  const sha = text(value, name, 64);
  requireSketch(/^[a-f0-9]{64}$/.test(sha), 'DESIGN_MANIFEST', `${name} must be a SHA-256 digest.`);
  return sha;
};
function relativePath(value: unknown, name: string, max = 240): string {
  const path = text(value, name, max);
  requireSketch(path === value && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..') && !path.includes('\\'),
    'DESIGN_MANIFEST', `${name} must be a relative path without dot segments.`);
  return path;
}
function readSelection(value: unknown): DesignSelection {
  const raw = object(value); keys(raw, ['prototypeId', 'versionId', 'variantId']);
  const id = (item: unknown, name: string) => { requireSketch(isDesignSlug(item), 'DESIGN_MANIFEST', `${name} must be a prototype slug.`); return item; };
  return { prototypeId: id(raw.prototypeId, 'prototypeId'), versionId: id(raw.versionId, 'versionId'), variantId: id(raw.variantId, 'variantId') };
}
function readSource(value: unknown): DesignSource {
  const raw = object(value); keys(raw, ['kind', 'path', 'sha256', 'selection']);
  requireSketch(raw.kind === 'project' || raw.kind === 'prototype-variant', 'DESIGN_MANIFEST', 'source.kind must be project or prototype-variant.');
  requireSketch((raw.kind === 'prototype-variant') === (raw.selection !== undefined), 'DESIGN_MANIFEST', 'Only a prototype-variant source has a selection.');
  return { kind: raw.kind, path: relativePath(raw.path, 'source.path'), sha256: digest(raw.sha256, 'source.sha256'),
    ...(raw.selection === undefined ? {} : { selection: readSelection(raw.selection) }) };
}
function readBrief(value: unknown): DesignBrief {
  const raw = object(value); keys(raw, ['scope', 'path']);
  requireSketch(raw.scope === 'root' || raw.scope === 'folder', 'DESIGN_MANIFEST', 'brief.scope must be root or folder.');
  return { scope: raw.scope, path: relativePath(raw.path, 'brief.path') };
}
/** Validates a saved manifest and every manifest before it is written; an edited or foreign manifest is refused, never repaired silently. */
export function readDesignManifest(value: unknown): DesignManifest {
  const raw = object(value);
  keys(raw, ['kind', 'schemaVersion', 'name', 'title', 'folder', 'project', 'source', 'brief', 'targets', 'framework', 'managed', 'designerOwned']);
  requireSketch(raw.kind === 'workbench-design-folder' && raw.schemaVersion === 1, 'DESIGN_MANIFEST', 'Unsupported design folder manifest. It has not been changed.');
  const project = object(raw.project); keys(project, ['id', 'name']);
  const managed = list(raw.managed, 'managed', 200).map(item => {
    const file = object(item); keys(file, ['path', 'sha256']);
    const path = relativePath(file.path, 'managed.path');
    requireSketch(!isDesignerOwned(path) && path !== designManifestFile, 'DESIGN_MANIFEST', 'A design-owned path cannot be a generated file.');
    return { path, sha256: digest(file.sha256, 'managed.sha256') };
  });
  requireSketch(new Set(managed.map(file => file.path)).size === managed.length, 'DESIGN_MANIFEST', 'Duplicate generated file entries.');
  return { kind: 'workbench-design-folder', schemaVersion: 1, name: designFolderName(raw.name), title: text(raw.title, 'title', 120), folder: relativePath(raw.folder, 'folder', 241 + designNameLimit),
    project: { id: text(project.id, 'project.id', 80), name: text(project.name, 'project.name', 120) }, source: readSource(raw.source),
    brief: raw.brief === null ? null : readBrief(raw.brief),
    targets: list(raw.targets, 'targets', 8).map(item => text(item, 'target', 20)), framework: text(raw.framework, 'framework', 40),
    managed, designerOwned: [...designerOwned] };
}
/** One line of a surface's UX acceptance block with its documented defaults applied, or null when it declares none. */
export function acceptanceSummary(block: unknown): string | null {
  if (block === undefined) return null;
  validateSurfaceAcceptance(block);
  const resolved = resolveSurfaceAcceptance(block), notes = resolved.notes.replace(/\s+/g, ' ').trim();
  return `states ${resolved.states.join(', ')}; themes ${resolved.themes.join(', ')}; minimum width ${resolved.minWidth}px` +
    (resolved.keyboardPath.length ? `; keyboard path ${resolved.keyboardPath.join(' → ')}` : '') + (notes ? `; ${notes}` : '');
}
