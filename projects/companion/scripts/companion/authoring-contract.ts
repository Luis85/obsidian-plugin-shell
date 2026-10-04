/** The Companion project transfer contract. Schema 6 is the only readable format; earlier formats are rejected, never migrated. */
import { PRD_LIMITS } from './prd-limits.mjs';
import { validateNativeIntegrations } from './native-contract.mjs';
import { validateDesignSystem } from './design-system-contract.mjs';
import { validateStorymaps } from './storymap-contract.mjs';
import { validateVisualDesigns } from './visual/visual-validate.mjs';
import { validateProjectTooling, type ProjectTooling } from './tooling-contract.ts';
import type { SitemapDesign } from './sitemap/model.ts';
import { assertJson, record, requireSitemap, utf8Length } from './sitemap/safety.ts';
import { validateSitemapModel } from './sitemap/validate.ts';
import { editorBindings } from './sitemap/editor-bindings.ts';

export const COMPANION_FORMAT = 'obsidian-companion-project';
export const AUTHORING_VERSION = 6;
export const COMPANION_MAX_BYTES = 4_000_000;
/** Relationship cardinalities the companion ER editor writes; every generator and maker accepts exactly these. */
export const RELATIONSHIP_CARDINALITIES: readonly string[] = Object.freeze(['0..1', '1', '1..1', '0..*', '1..*']);
export interface AuthoringDocument {
  kind: 'obsidian-companion-project';
  schemaVersion: 6;
  executable: false;
  project: { id: string; name: string; author: string; version: string; description: string };
  settings: { codebaseFolder: string; testsFolder: string };
  design: SitemapDesign & { schema: 6 };
  notes: string[];
  tooling?: ProjectTooling;
}
const ENVELOPE_KEYS = ['kind', 'schemaVersion', 'executable', 'project', 'settings', 'design', 'notes', 'tooling'];
const DESIGN_KEYS = ['schema', 'blueprint', 'goal', 'platform', 'nodes', 'links', 'nextId', 'library', 'prds', 'librarySchema',
  'canvas', 'semantic', 'dataSources', 'designSystem', 'storymaps', 'visualDesigns', 'nativeIntegrations', 'sitemap', 'features', 'editors'];
const REQUIRED_DESIGN_KEYS = ['schema', 'blueprint', 'goal', 'platform', 'nodes', 'links', 'nextId', 'library', 'prds'];
const PROTECTED_FOLDERS = new Set(['.obsidian', '.git', 'node_modules', '.test-vault', '.dev-vault', '__proto__', 'prototype', 'constructor']);
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('COMPANION_INVALID: ' + message);
}
/** A violation of one named field; `jsonPointer` is its RFC 6901 location in the project document. */
export class CompanionFieldError extends Error {
  readonly jsonPointer: string;
  constructor(message: string, jsonPointer: string) { super(message); this.name = 'CompanionFieldError'; this.jsonPointer = jsonPointer; }
}
function requireField(condition: unknown, jsonPointer: string, message: string): asserts condition {
  const field = jsonPointer.slice(jsonPointer.lastIndexOf('/') + 1);
  if (!condition) throw new CompanionFieldError(`COMPANION_INVALID: ${message} Field "${field}" at ${jsonPointer}.`, jsonPointer);
}
/** Coded for adapters and prefixed for message-based reporters (CLI, reader, browser). */
function requireVersion(condition: unknown, message: string): asserts condition {
  requireSitemap(condition, 'COMPANION_VERSION', 'COMPANION_VERSION: ' + message);
}
function text(value: unknown, limit: number, nonempty = false): value is string {
  return typeof value === 'string' && value.length <= limit && (!nonempty || value.trim().length > 0);
}
function shape(value: unknown, keys: readonly string[], required: readonly string[] = keys): value is Record<string, unknown> {
  return record(value) && Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
}

/** Portable relative folder outside protected vault and repository folders. */
export function companionRelativeFolder(value: unknown, allowRoot = false): value is string {
  if (allowRoot && value === '.') return true;
  if (typeof value !== 'string' || value.length > 240 || value.length === 0) return false;
  return value.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(part) &&
    !/[. ]$/.test(part) && !RESERVED_NAME.test(part) && !PROTECTED_FOLDERS.has(part.toLowerCase()));
}
export function validateCompanionFolders(value: unknown): AuthoringDocument['settings'] {
  requireValid(shape(value, ['codebaseFolder', 'testsFolder']), 'Expected codebaseFolder and testsFolder.');
  requireValid(companionRelativeFolder(value.codebaseFolder) && companionRelativeFolder(value.testsFolder),
    'Folders must be portable relative paths outside protected vault folders.');
  const { codebaseFolder, testsFolder } = value, a = codebaseFolder.toLowerCase(), b = testsFolder.toLowerCase();
  requireValid(a !== b && !a.startsWith(b + '/') && !b.startsWith(a + '/'), 'Codebase and tests folders must not overlap.');
  return { codebaseFolder, testsFolder };
}
function validateIdentity(value: unknown): string {
  requireField(shape(value, ['id', 'name', 'author', 'version', 'description']), '/project', 'Unsupported project identity.');
  requireField(text(value.id, 60) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id) && companionRelativeFolder(value.id),
    '/project/id', 'Use a portable lowercase plugin ID.');
  requireField(text(value.name, 80, true) && !/[\r\n]/.test(value.name), '/project/name', 'Use a single-line project name.');
  requireField(text(value.author, 80), '/project/author', 'Project author exceeds its limit of 80 characters.');
  requireField(text(value.description, 400), '/project/description', 'Project description exceeds its limit of 400 characters.');
  requireField(text(value.version, 40) && /^\d+\.\d+\.\d+$/.test(value.version), '/project/version', 'Expected an x.y.z project version.');
  return value.id;
}
function validateCollections(design: Record<string, unknown>): void {
  for (const [key, limit] of [['nodes', 60], ['links', 120], ['library', 200], ['prds', PRD_LIMITS.count]] as const) {
    const items = design[key];
    requireValid(Array.isArray(items) && items.length <= limit && items.every(item => record(item) && text(item.id, 120, true)),
      'Invalid design collection: ' + key);
    requireValid(new Set(items.map(item => (item as { id: string }).id)).size === items.length, 'Duplicate IDs in ' + key + '.');
  }
}
/** Shared subsystems validate their own stores; the envelope admits only the current design keys. */
function validateDesign(value: unknown, pluginId: string): void {
  requireValid(record(value), 'Expected a saved design.');
  validateNativeIntegrations(value.nativeIntegrations);
  validateDesignSystem(value.designSystem, pluginId);
  if (value.storymaps !== undefined) validateStorymaps(value.storymaps);
  requireValid(shape(value, DESIGN_KEYS, REQUIRED_DESIGN_KEYS), 'Unsupported design envelope.');
  requireField(text(value.blueprint, 80, true), '/design/blueprint', 'Unsupported design blueprint.');
  requireField(text(value.goal, 1000), '/design/goal', 'Design goal exceeds its limit of 1000 characters.');
  requireField(['desktop', 'mobile-ready'].includes(String(value.platform)), '/design/platform', 'Expected platform desktop or mobile-ready.');
  requireValid(Number.isSafeInteger(value.nextId) && Number(value.nextId) > 0 && Number(value.nextId) < Number.MAX_SAFE_INTEGER - 100000,
    'Invalid design counter.');
  validateCollections(value);
  if (value.visualDesigns !== undefined) {
    const ids = (key: string) => new Set((value[key] as { id: string }[]).map(item => item.id));
    validateVisualDesigns(value.visualDesigns, { surfaces: ids('nodes'), library: ids('library') });
  }
}
function assertAuthoringDocument(input: unknown): asserts input is AuthoringDocument {
  assertJson(input);
  requireValid(record(input) && input.kind === COMPANION_FORMAT, 'Unsupported companion format.');
  requireVersion(input.schemaVersion === AUTHORING_VERSION, 'Unsupported project schemaVersion ' + JSON.stringify(input.schemaVersion) +
    '; only schema 6 is supported. Earlier formats are not migrated; start from a current starter or a schema 6 export.');
  requireValid(shape(input, ENVELOPE_KEYS, ENVELOPE_KEYS.slice(0, -1)), 'Expected a full companion project, not a blueprint or recovery snapshot.');
  requireValid(input.executable === false, 'Unsupported companion executable flag.');
  validateProjectTooling(input.tooling);
  const pluginId = validateIdentity(input.project);
  validateCompanionFolders(input.settings);
  requireVersion(record(input.design) && input.design.schema === AUTHORING_VERSION, 'Transfer and design schema versions must match.');
  validateDesign(input.design, pluginId);
  requireValid(Array.isArray(input.notes) && input.notes.length <= 100 && input.notes.every(note => text(note, 100000)), 'Invalid project notes.');
  requireValid(utf8Length(JSON.stringify(input)) <= COMPANION_MAX_BYTES, 'Project exceeds the 4 MB import/export limit.');
  editorBindings(validateSitemapModel(input.design));
}

export function validateAuthoringDocument(input: unknown): AuthoringDocument {
  assertAuthoringDocument(input);
  return input;
}

export function parseAuthoringDocument(textValue: string): AuthoringDocument {
  requireSitemap(typeof textValue === 'string' && utf8Length(textValue) <= COMPANION_MAX_BYTES,
    'COMPANION_LIMIT', 'Project exceeds the 4 MB input limit.');
  let input: unknown;
  try { input = JSON.parse(textValue); } catch { throw new Error('COMPANION_INVALID: Expected valid JSON.'); }
  return validateAuthoringDocument(input);
}
export function authoringDesignKey(key: string): boolean {
  return DESIGN_KEYS.includes(key);
}
