/** Reads the facts an engineering handoff guide cites from the project's own files. Read-only, bounded and link-refusing. */
import { opendir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { exists, hash, readBounded } from './framework/files.ts';
import { guardedText } from './user-settings.ts';
import { documentTitle, libraryUsage, placementRoles, lineLimits, originFacts, packageFacts, tokenFacts, traceFacts,
  type EngineeringFacts, type FactSource, type TokenFacts } from '../domain/design-facts.ts';
const componentFile = /(?:\.vue|\.component\.ts)$/, scanLimit = 2000, readLimit = 300;
/** Architecture and style documents a coding agent follows; generated projects keep framework docs under docs/framework/. */
const docCandidates = ['AGENTS.md', 'README.md', 'docs/development/PRESENTATION-STRUCTURE.md', 'docs/development/DESIGN-SYSTEM-STYLES.md',
  'docs/development/BUILD-A-FEATURE.md', 'docs/development/MODALS-AND-NOTICES.md', 'docs/development/COMMANDS-AND-RIBBON.md',
  'docs/architecture/STYLES.md', 'docs/architecture/EVENT-BUS.md', 'docs/design/OBSIDIAN-TOKENS.md', 'docs/development/GENERATED-PROJECT-PLUGINS.md'];
const tokenCandidates = (codebase: string) => [`${codebase}/styles/tokens.css`, `${codebase}/styles/tokens.scss`, `${codebase}/tokens.css`];
async function readText(root: string, path: string, sources: FactSource[]): Promise<string | null> {
  try {
    const read = await guardedText(root, path);
    if (read.content === null || read.beforeHash === null) return null;
    sources.push({ path, sha256: read.beforeHash });
    return read.content;
  } catch { sources.push({ path, sha256: hash(''), note: 'unreadable' }); return null; }
}
async function readJson(root: string, path: string, sources: FactSource[]): Promise<unknown> {
  const text = await readText(root, path, sources);
  if (text === null) return null;
  try { return parseJsonData(text); } catch { sources.at(-1)!.note = 'invalid JSON'; return null; }
}
interface Walk { files: string[]; folders: Map<string, number>; scanned: number }
const skipped = (entry: Dirent) => entry.isSymbolicLink() || ['node_modules', 'dist', '.git'].includes(entry.name);
function count(state: Walk, owner: string, path: string): void {
  state.scanned += 1; state.folders.set(owner, (state.folders.get(owner) ?? 0) + 1);
  if (componentFile.test(path)) state.files.push(path);
}
/** Component files and per-top-level-folder file counts under the source root; links and dependency or build folders are skipped. */
async function walk(root: string, folder: string, depth: number, state: Walk, top?: string): Promise<void> {
  if (depth > 8 || !await exists(join(root, folder))) return;
  for await (const entry of await opendir(join(root, folder))) {
    if (state.scanned >= scanLimit) return;
    if (skipped(entry)) continue;
    if (entry.isDirectory()) await walk(root, `${folder}/${entry.name}`, depth + 1, state, top ?? entry.name);
    else if (entry.isFile()) count(state, top ?? '.', `${folder}/${entry.name}`);
  }
}
/** The model names its own source folder; only a plain relative folder inside the root is scanned. */
const insideRoot = (folder: string) => /^[\w.-]+(?:\/[\w.-]+)*$/.test(folder) && !folder.split('/').some(part => part === '.' || part === '..');
async function componentFacts(root: string, codebase: string, sources: FactSource[]) {
  const state: Walk = { files: [], folders: new Map(), scanned: 0 };
  if (insideRoot(codebase)) await walk(root, codebase, 0, state);
  const files = state.files.sort(), texts: string[] = [];
  for (const path of files.slice(0, readLimit)) {
    // An unreadable component stays listed with empty text, so hashes stay aligned with their paths.
    try { texts.push(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(root, path), 1_000_000))); } catch { texts.push(''); }
  }
  if (files.length) sources.push({ path: `${codebase}/**/*.vue, *.component.ts (${files.length} file${files.length === 1 ? '' : 's'})`, sha256: hash(JSON.stringify(files.map((path, index) => [path, hash(texts[index] ?? '')]))) });
  const layout = [...state.folders].map(([folder, count]) => ({ folder, files: count })).sort((a, b) => (a.folder < b.folder ? -1 : 1));
  return { files, layout, usage: libraryUsage(texts) };
}
async function documents(root: string, sources: FactSource[]) {
  const found: { path: string; title: string }[] = [];
  for (const candidate of docCandidates) {
    for (const path of [candidate, candidate.replace(/^docs\//, 'docs/framework/')]) {
      if (found.some(doc => doc.path === path) || !await exists(join(root, path))) continue;
      const text = await readText(root, path, sources);
      if (text !== null) found.push({ path, title: documentTitle(text) ?? path });
    }
  }
  return found;
}
/** Facts are read from the project root that holds the design folder, so the guide describes the code it will be implemented in. */
export async function engineeringFacts(root: string, settings: { codebaseFolder: string; testsFolder: string }): Promise<EngineeringFacts> {
  const sources: FactSource[] = [], codebase = settings.codebaseFolder, tests = settings.testsFolder;
  const packageJson = packageFacts(await readJson(root, 'package.json', sources));
  const origins = originFacts(await readJson(root, 'design/compiler-origins.json', sources));
  const trace = traceFacts(await readJson(root, 'design/visual-traceability.json', sources));
  const limits = lineLimits(await readJson(root, 'configs/quality/thresholds.json', sources));
  let tokens: TokenFacts | null = null;
  for (const path of tokenCandidates(codebase)) {
    const css = tokens ? null : await readText(root, path, sources);
    if (css !== null) tokens = tokenFacts(path, css);
  }
  const components = await componentFacts(root, codebase, sources);
  const docs = await documents(root, sources);
  const placement = [];
  for (const [path, role] of placementRoles) if (insideRoot(codebase) && await exists(join(root, codebase, path))) placement.push({ path: `${codebase}/${path}`, role });
  return { placement, sources, fingerprint: hash(JSON.stringify(sources)), codebase, tests, packageJson, layout: components.layout,
    components: components.files, libraryUsage: components.usage, tokens, origins, trace, limits, docs };
}
