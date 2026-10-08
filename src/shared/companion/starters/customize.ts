/** Turns a loaded Companion starter into an independent, editable project v6 document. No catalog projection or execution trust. */
import { parseAuthoringDocument, validateAuthoringDocument, validateCompanionFolders, type AuthoringDocument } from '../authoring-contract.ts';
import { record } from '../sitemap/safety.ts';
import type { StarterDefinition } from './types.ts';
const FIELDS = ['id', 'name', 'author', 'version', 'description', 'codebaseFolder', 'testsFolder', 'extension', 'extensions'];
const IDENTITY = ['id', 'name', 'author', 'version', 'description'] as const;
export interface StarterSource { definition: StarterDefinition; sha256: string }
function starterAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('STARTER_INVALID: ' + message);
}
function single(value: unknown, key: string): Record<string, unknown> | null {
  const list: unknown = record(value) ? value[key] : undefined;
  const only: unknown = Array.isArray(list) && list.length === 1 ? list[0] : undefined;
  return record(only) ? only : null;
}
function rewriteStrings(value: unknown, rewrite: (text: string) => string): void {
  if (!record(value) && !Array.isArray(value)) return;
  const node = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(node)) {
    if (typeof item === 'string') node[key] = rewrite(item);
    else rewriteStrings(item, rewrite);
  }
}
/** A new extension renames the sample format wherever it is named (`.folio`, `Folio`, a matching file type id), never inside other words. */
function renameFormat(document: AuthoringDocument, fileType: Record<string, unknown>, extension: string): void {
  const previous = String(fileType.extension);
  if (fileType.id === previous) fileType.id = extension;
  fileType.extension = extension;
  if (previous === extension || !/^[a-z][a-z0-9]*$/.test(previous)) return;
  const title = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
  const dotted = new RegExp(`\\.${previous}\\b`, 'g'), named = new RegExp(`\\b${title(previous)}\\b`, 'g');
  const rewrite = (text: string): string => text.replace(dotted, () => '.' + extension).replace(named, () => title(extension));
  rewriteStrings(document.design, rewrite);
  rewriteStrings(document.notes, rewrite);
}
/** Only identity, folders and one native extension choice are configurable; the rest of the design is copied unchanged. */
export function customizeStarter(source: StarterSource, fields: Record<string, string>): AuthoringDocument {
  const { definition, sha256 } = source;
  starterAssert(definition.generator.kind === 'companion', 'This starter does not declare an editable Companion model.');
  starterAssert(/^[a-f0-9]{64}$/.test(sha256), 'Invalid local source identity.');
  starterAssert(Object.keys(fields).every(key => FIELDS.includes(key)), 'Unknown configuration.');
  starterAssert(Object.values(fields).every(value => typeof value === 'string'), 'Configuration values must be text.');
  const document = validateAuthoringDocument(structuredClone(definition.generator.document));
  for (const key of IDENTITY) document.project[key] = String(fields[key] ?? document.project[key]).trim();
  document.settings = validateCompanionFolders({ codebaseFolder: fields.codebaseFolder ?? document.settings.codebaseFolder, testsFolder: fields.testsFolder ?? document.settings.testsFolder });
  for (const folder of Object.values(document.settings)) starterAssert(!['scripts', 'docs', 'harness', 'dist'].includes(folder.split('/')[0]!.toLowerCase()), 'Folder overlaps framework tooling.');
  if (fields.extension !== undefined) {
    const fileType = single(document.design.nativeIntegrations, 'fileTypes');
    starterAssert(fileType, '--extension requires a starter with exactly one custom file type.');
    renameFormat(document, fileType, fields.extension);
  }
  if (fields.extensions !== undefined) {
    const menu = single(document.design.nativeIntegrations, 'contextMenus');
    starterAssert(menu, '--extensions requires a starter with exactly one context action.');
    menu.extensions = fields.extensions.split(',');
  }
  // Provenance is informational Markdown, not a schema extension or execution authority.
  document.notes.push('# Project starter\n\nDefinition: ' + definition.id + ' @ ' + definition.version + '\nSource SHA-256: ' + sha256 + '\n\nThis project is an independent editable copy. Catalog updates never overwrite it. No execution approvals, credentials, machine paths, test results or plugin installation are imported.\n');
  return parseAuthoringDocument(JSON.stringify(document));
}
