/** File-system side of the `source` commands: the manifest, derived JSON files, project files and their imports. */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SketchError } from '#shared/contracts/sketch-errors.ts';
import { sourceManifestFile } from '#shared/platform/source-manifest.mjs';
import { implicitSourceManifest, importAliases, parseSourceManifest, type SourceManifest } from '../domain/source-projects.ts';
import { aliasPrefixes, type AliasPrefixes } from '../domain/source-imports.ts';
import { exists, readBounded } from './framework/files.ts';
import { OperationError } from './framework/contracts.ts';
import { loadSpecifierParsers, moduleSpecifiers, type ModuleSpecifier } from './module-specifiers.ts';

export { sourceManifestFile };
const nextSteps: Record<string, string> = {
  SOURCE_CYCLE: 'source graph, then source unlink <from> <to>', SOURCE_NOT_FOUND: 'source list', SOURCE_AMBIGUOUS: 'source list',
  SOURCE_EXISTS: 'source list', SOURCE_REFERENCED: 'source graph', INVALID_DATA: 'source check',
};
/** Domain failures carry a code; at the command boundary they become operation errors with a runnable next step. */
function operationError(error: unknown): unknown {
  if (!(error instanceof SketchError)) return error;
  return new OperationError(error.code, error.message, nextSteps[error.code] ?? 'source check');
}
export async function domain<T>(run: () => T | Promise<T>): Promise<T> {
  try { return await run(); } catch (error) { throw operationError(error); }
}

export interface JsonFile { value: unknown; text: string }
/** A JSON file of the project, null when absent; unparseable content is an INVALID_DATA failure left untouched. */
export async function parseSourceJson(text: string, path: string): Promise<unknown> {
  if (!/(?:^|\/)tsconfig\.json$/.test(path)) return JSON.parse(text) as unknown;
  const ts = (await import('typescript')).default;
  const parsed = ts.parseConfigFileTextToJson(path, text);
  if (parsed.error) throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'));
  return parsed.config as unknown;
}
export async function readJsonFile(root: string, path: string): Promise<JsonFile | null> {
  if (!await exists(join(root, path))) return null;
  const text = (await readBounded(join(root, path), 4_000_000)).toString('utf8');
  try { return { value: await parseSourceJson(text, path), text }; }
  catch { throw new OperationError('INVALID_DATA', `${path} is not valid JSON; it was left untouched.`, `Repair ${path} by hand.`); }
}
export async function isDirectory(root: string, path: string): Promise<boolean> {
  try { return (await stat(join(root, path))).isDirectory(); } catch { return false; }
}

export interface SourceState { manifest: SourceManifest; declared: boolean; text: string | null }
/** The declared manifest; without one, the implicit legacy project (src/plugin or a flat src with main.ts). */
export async function readSourceState(root: string): Promise<SourceState> {
  const file = await readJsonFile(root, sourceManifestFile).catch(() => { throw new OperationError('SOURCE_MANIFEST_INVALID', `${sourceManifestFile} is not valid JSON; it was left untouched.`, `Repair ${sourceManifestFile} by hand, then source check.`); });
  if (!file) return { manifest: implicitSourceManifest(await isDirectory(root, 'src/plugin'), await exists(join(root, 'src/main.ts'))), declared: false, text: null };
  try { return { manifest: parseSourceManifest(file.value), declared: true, text: file.text }; }
  catch (error) { throw new OperationError('SOURCE_MANIFEST_INVALID', `${sourceManifestFile}: ${error instanceof Error ? error.message : 'invalid'} It was left untouched.`, `Repair ${sourceManifestFile} by hand, then source check.`); }
}

/** Alias prefixes a file of this repository resolves: the manifest's library aliases, then the other package.json imports. */
export async function repositoryAliases(root: string, manifest: SourceManifest): Promise<AliasPrefixes> {
  const pkg = await readJsonFile(root, 'package.json').catch(() => null);
  const imports = pkg?.value && typeof pkg.value === 'object' ? (pkg.value as { imports?: unknown }).imports : undefined;
  return [...aliasPrefixes(importAliases(manifest)), ...aliasPrefixes(imports)];
}

const skipped = new Set(['node_modules', 'dist', 'dist-harness', 'coverage', '.cache', '.vite', 'reports', '.git']);
export const codeFile = /\.(?:[cm]?[jt]sx?|vue)$/;
/** Repository-relative files under a folder, bounded; symbolic links and generated folders are not followed. */
export async function listFiles(root: string, folder: string, limit = 20_000): Promise<string[]> {
  const found: string[] = [];
  const walk = async (path: string): Promise<void> => {
    let entries;
    try { entries = await readdir(join(root, path), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const child = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!skipped.has(entry.name)) await walk(child); }
      else if (entry.isFile()) found.push(child);
      if (found.length > limit) throw new OperationError('SOURCE_SCAN_LIMIT', `More than ${limit} files under ${folder}.`, 'Narrow the source project.');
    }
  };
  await walk(folder);
  return found;
}

export interface FileImports { file: string; text: string; specifiers: ModuleSpecifier[] }
/** Module specifiers of every code file in the list, parsed from its syntax tree. */
export async function scanImports(root: string, files: readonly string[]): Promise<FileImports[]> {
  const code = files.filter(file => codeFile.test(file));
  if (!code.length) return [];
  const parsers = await loadSpecifierParsers();
  const scanned: FileImports[] = [];
  for (const file of code) {
    const text = (await readBounded(join(root, file), 4_000_000)).toString('utf8');
    scanned.push({ file, text, specifiers: moduleSpecifiers(file, text, parsers) });
  }
  return scanned;
}
