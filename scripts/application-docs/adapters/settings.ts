import { hasPortableProjectSegments, hasProtectedProjectRoot } from '../../shared/project-path.ts';
import { join } from 'node:path';
import { DOC_TYPES, docsObject as object, array, insist, type DocType } from '../domain/contracts.ts';
import { portable, readBytes, decode } from './filesystem.ts';
export const SETTINGS_FILE = 'configs/user-settings.json';
function projectPath(value: unknown): string {
  insist(typeof value === 'string' && value.trim().length > 0 && value.length <= 240, 'DOCS_SETTINGS_PATH', 'Project path needs bounded text.');
  const path = value.trim();
  insist(path === value && hasPortableProjectSegments(path), 'DOCS_SETTINGS_PATH', 'Use a portable project-relative path without whitespace or dot segments.');
  insist(!hasProtectedProjectRoot(path), 'DOCS_SETTINGS_PATH', 'Project path cannot target host, framework, dependency or Git directories.');
  return path;
}
export const folders: Record<DocType, string> = { project: '', page: 'pages', component: 'components', interaction: 'interactions', journey: 'journeys', route: 'routes', transition: 'transitions', layout: 'layouts', 'component-revision': 'component-revisions', 'library-component': 'library-components', feature: 'features', prd: 'prds' };
export interface DocsSettings { root: string; indexFile: string; paths: Record<string, string>; recursive: boolean; include: string[]; exclude: string[]; linkFormat: 'markdown' | 'wikilink' }
function defaults(root = 'docs/application'): DocsSettings {
  return { root, indexFile: 'design/docs-index.json', paths: Object.fromEntries(DOC_TYPES.filter(type => type !== 'project').map(type => [folders[type], root + '/' + folders[type]])),
    recursive: true, include: ['**/*.md'], exclude: ['**/generated/**'], linkFormat: 'markdown' };
}
const SETTING_KEYS = ['root', 'indexFile', 'paths', 'recursive', 'include', 'exclude', 'linkFormat', 'preserveAuthoredContent', 'conflictPolicy', 'deleteMissing'];
export const PROTECTED_ROOTS: readonly string[] = ['.git', '.obsidian', '.framework', '.companion', '.codex-authoring.lock', 'node_modules', 'scripts', 'bin', 'src', 'tests', 'dist', 'configs', 'design'];
function keepsSafetyPolicy(raw: Record<string, unknown>): boolean {
  return (raw.preserveAuthoredContent === undefined || raw.preserveAuthoredContent === true) && (raw.deleteMissing === undefined || raw.deleteMissing === false)
    && (raw.conflictPolicy === undefined || raw.conflictPolicy === 'review');
}
function overlaps(folder: string, lower: string): boolean {
  const blocked = folder.toLowerCase();
  return lower === blocked || lower.startsWith(blocked + '/') || blocked.startsWith(lower + '/');
}
function safeLocation(blocked: readonly string[], path: string): void {
  portable(path); const lower = path.toLowerCase();
  insist(!path.split('/').some(part => part.startsWith('.')), 'DOCS_SETTINGS_PATH', 'Documentation paths must remain outside hidden directories: ' + path);
  insist(!blocked.some(folder => overlaps(folder, lower)), 'DOCS_SETTINGS_PATH', 'Documentation overlaps a protected project path: ' + path);
}
function patterns(input: unknown): string[] {
  const values = array(input);
  insist(values.length <= 32 && values.every(item => typeof item === 'string' && item.length <= 240), 'DOCS_SETTINGS', 'Use bounded include/exclude glob patterns.');
  return values as string[];
}
export function validateSettings(input: unknown, protectedPaths: string[]): DocsSettings {
  const raw = object(input), base = defaults(typeof raw.root === 'string' ? raw.root : undefined);
  insist(Object.keys(raw).every(key => SETTING_KEYS.includes(key)), 'DOCS_SETTINGS', 'Unknown documentation setting.');
  insist(keepsSafetyPolicy(raw), 'DOCS_SETTINGS', 'Authored content preservation, no implicit deletion and conflict review cannot be disabled.');
  const value = { ...base, ...raw, paths: { ...base.paths, ...(raw.paths === undefined ? {} : object(raw.paths)) } };
  insist(typeof value.root === 'string' && typeof value.indexFile === 'string', 'DOCS_SETTINGS', 'Invalid documentation paths.');
  portable(value.root); portable(value.indexFile);
  insist(value.indexFile.startsWith('design/') && value.indexFile.endsWith('.json') && value.indexFile !== 'design/project.json', 'DOCS_SETTINGS', 'Keep the documentation index in design/, separate from project.json.');
  const blocked = [...PROTECTED_ROOTS, ...protectedPaths];
  safeLocation(blocked, value.root);
  for (const [key, path] of Object.entries(value.paths)) {
    insist(Object.values(folders).includes(key) && typeof path === 'string', 'DOCS_SETTINGS', 'Unknown documentation path.'); safeLocation(blocked, path);
  }
  insist(typeof value.recursive === 'boolean' && ['markdown', 'wikilink'].includes(String(value.linkFormat)), 'DOCS_SETTINGS', 'Invalid recursion or link preference.');
  return { root: value.root, indexFile: value.indexFile, paths: value.paths as Record<string, string>, recursive: value.recursive,
    include: patterns(value.include), exclude: patterns(value.exclude), linkFormat: value.linkFormat as DocsSettings['linkFormat'] };
}
export async function readDocumentationSettings(root: string, protectedPaths: string[], output?: string) {
  const bytes = await readBytes(join(root, SETTINGS_FILE));
  const user = bytes ? object(JSON.parse(decode(bytes))) : { schemaVersion: 1 };
  insist(user.schemaVersion === 1, 'DOCS_SETTINGS_VERSION', 'Unsupported user-settings version; original settings are preserved.');
  const paths = user.paths === undefined ? {} : object(user.paths);
  const canonicalProjectPath = projectPath(paths.project ?? 'design/project.json');
  const locations = Object.values(paths).filter((value): value is string => typeof value === 'string');
  const raw = user.documentation === undefined ? {} : object(user.documentation);
  const settings = validateSettings(output ? { ...raw, root: portable(output), paths: defaults(output).paths } : raw, [...protectedPaths, ...locations]);
  insist(settings.indexFile !== canonicalProjectPath, 'DOCS_SETTINGS_PATH', 'Documentation index overlaps the canonical project.');
  return { settings, bytes, projectPath: canonicalProjectPath, protectedPaths: locations, create: bytes ? null : JSON.stringify({ ...user, documentation: { ...settings, preserveAuthoredContent: true, conflictPolicy: 'review', deleteMissing: false } }, null, 2) + '\n' };
}
