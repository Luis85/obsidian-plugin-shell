import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { object, keys, list } from '../domain/data.ts';
import { projectPath, type UserSettings } from '../domain/user-settings.ts';
import { typedPrd, type PrdMarkdown } from '../domain/prd-markdown.ts';
import { requireSketch } from '../domain/errors.ts';
import { hash } from '../../scripts/framework/files.ts';
import { guardedText } from './user-settings.ts';
import type { Entry } from './storage.ts';
export interface PrdRecord extends PrdMarkdown { source: { path: string; sha256: string }; intake: 'unmapped' }
export interface Intake { prds: PrdRecord[]; guards: Entry[]; imports: Entry[]; ignored: string[] }
async function directory(root: string, path: string, depth: number) {
  try { return await readdir(join(root, path), { withFileTypes: true }); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT' && depth === 0) return []; throw error; }
}
async function scan(root: string, folder: string, recursive: boolean): Promise<string[]> {
  await guardedText(root, folder + '/.shell-prd-scan');
  const files: string[] = []; let count = 0;
  async function walk(path: string, depth: number): Promise<void> {
    requireSketch(depth <= 20, 'PRD_LIMIT', 'PRD directory nesting exceeds 20 levels.');
    const items = await directory(root, path, depth);
    for (const item of items.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      requireSketch(++count <= 2000, 'PRD_LIMIT', 'PRD scan is limited to 2000 directory entries.');
      const child = projectPath(path + '/' + item.name);
      const stat = await lstat(join(root, child));
      requireSketch(!stat.isSymbolicLink(), 'PRD_SYMLINK', 'PRD scan refuses symbolic links: ' + child);
      if (stat.isDirectory() && recursive) await walk(child, depth + 1);
      if (stat.isFile() && /\.md$/i.test(child)) files.push(child);
    }
  }
  await walk(folder, 0); return files;
}
function inlineDocuments(documents: unknown, result: Intake, add: (markdown: string, source: string) => void, folder: string = 'docs/prds'): void {
  for (const input of list(documents ?? [], 'documents', 12)) {
    const value = object(input); keys(value, ['filename', 'markdown']);
    const filename = projectPath(value.filename);
    requireSketch(!filename.includes('/') && /\.md$/i.test(filename), 'PRD_PATH', 'Inline PRDs need a Markdown filename, not a directory.');
    requireSketch(typeof value.markdown === 'string', 'PRD_TYPE', 'Markdown must be text.');
    const path = folder + '/' + filename, markdown = value.markdown;
    result.imports.push({ path, content: markdown }); add(markdown, path);
  }

}
export async function intakePrds(root: string, settings: UserSettings, input: unknown): Promise<Intake> {
  const request = object(input); keys(request, ['mode', 'files', 'documents']);
  requireSketch(['scan', 'add'].includes(String(request.mode)), 'PRD_MODE', 'Choose scan or add.');
  requireSketch(request.mode !== 'scan' || (request.files === undefined && request.documents === undefined), 'PRD_MODE', 'Scan uses the configured folder; files/documents belong to add.');
  const paths = request.mode === 'scan' ? await scan(root, settings.paths.prds, settings.preferences.scanRecursive)
    : list(request.files ?? [], 'files', 12).map(projectPath);
  const result: Intake = { prds: [], guards: [], imports: [], ignored: [] };
  const owned = new Set<string>();
  function add(markdown: string, source: string): void {
    const prd = typedPrd(markdown, source);
    if (!prd) { result.ignored.push(source); return; }
    requireSketch(!result.prds.some(item => item.id.toLowerCase() === prd.id.toLowerCase()), 'PRD_DUPLICATE', 'Duplicate PRD identity: ' + prd.id);
    requireSketch(result.prds.length < 12, 'PRD_LIMIT', 'The canonical project supports at most 12 PRDs.');
    result.prds.push({ ...prd, source: { path: source, sha256: hash(markdown) }, intake: 'unmapped' });
  }
  for (const path of paths) {
    requireSketch(/\.md$/i.test(path) && !owned.has(path.toLowerCase()), 'PRD_PATH', 'Use unique Markdown source paths.'); owned.add(path.toLowerCase());
    const read = await guardedText(root, path);
    requireSketch(read.content !== null, 'PRD_MISSING', 'Missing PRD: ' + path);
    result.guards.push({ path, content: read.content });
    if (request.mode === 'add' && !path.startsWith(settings.paths.prds + '/')) {
      const destination = settings.paths.prds + '/' + path.split('/').at(-1)!;
      result.imports.push({ path: destination, content: read.content }); add(read.content, destination);
    } else add(read.content, path);
  }
  inlineDocuments(request.documents, result, add, settings.paths.prds);
  requireSketch(request.mode !== 'add' || result.ignored.length === 0, 'PRD_TYPE', 'Added Markdown must contain scalar frontmatter type: prd.');
  requireSketch(result.prds.length > 0, 'PRD_EMPTY', 'No typed PRDs found. Add Markdown with frontmatter type: prd, or correct the configured path.');
  return result;
}
