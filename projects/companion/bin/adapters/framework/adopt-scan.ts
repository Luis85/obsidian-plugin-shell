import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import type { ScanFacts } from '../../domain/adoption/contracts.ts';
import { isAdoptionOutput } from '../../domain/adoption/paths.ts';

export interface ScanLimits { maxFiles: number; maxFileBytes: number; maxDepth: number; maxSourceFiles: number; maxTotalBytes: number }
export const defaultLimits: Readonly<ScanLimits> = Object.freeze({ maxFiles: 20000, maxFileBytes: 262144, maxDepth: 14, maxSourceFiles: 4000, maxTotalBytes: 16 * 1024 * 1024 });
export interface Scanned { files: Array<{ path: string; bytes: number }>; texts: Map<string, string>; scan: ScanFacts }

/** Output, cache and dependency folders are never entered. */
const excludedDirectories = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage', '.nx', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.output', '.parcel-cache', '.yarn', '.pnpm-store', 'bower_components', 'build', 'out']);
const configNames = /(?:^|\/)(?:package\.json|angular\.json|project\.json|nx\.json|tsconfig(?:\.[A-Za-z0-9-]+)?\.json|\.nvmrc|\.node-version|\.tool-versions)$/;
const rootOnly = new Set(['manifest.json', '.claude/settings.json']);
const sourceFile = /\.ts$/;
const notSource = /(?:\.d|\.spec|\.test|\.stories|\.e2e)\.ts$/;
const byCodeUnit = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

interface State { limits: ScanLimits; files: Scanned['files']; texts: Map<string, string>; scan: ScanFacts; sources: number; signal?: AbortSignal | undefined }

const wantsText = (path: string): boolean => rootOnly.has(path) || configNames.test(path);
const wantsSource = (path: string): boolean => sourceFile.test(path) && !notSource.test(path);
/** Reads one regular file without following a link; null means it was counted as skipped. */
async function readText(state: State, absolute: string, size: number): Promise<string | null> {
  if (size > state.limits.maxFileBytes) { state.scan.skipped.oversize++; return null; }
  if (state.scan.bytesRead + size > state.limits.maxTotalBytes) { state.scan.truncated = true; return null; }
  try {
    const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > state.limits.maxFileBytes) { state.scan.skipped.unreadable++; return null; }
      const buffer = Buffer.alloc(stat.size);
      const { bytesRead } = await handle.read(buffer, 0, stat.size, 0);
      const bytes = buffer.subarray(0, bytesRead);
      if (bytes.includes(0)) { state.scan.skipped.binary++; return null; }
      state.scan.bytesRead += bytesRead;
      return bytes.toString('utf8');
    } finally { await handle.close(); }
  } catch { state.scan.skipped.unreadable++; return null; }
}
async function visitFile(state: State, root: string, path: string): Promise<void> {
  if (isAdoptionOutput(path)) return;
  const absolute = join(root, path);
  let size: number;
  try { size = (await lstat(absolute)).size; } catch { state.scan.skipped.unreadable++; return; }
  state.files.push({ path, bytes: size });
  const source = wantsSource(path);
  if (source && state.sources >= state.limits.maxSourceFiles) { state.scan.truncated = true; return; }
  if (!source && !wantsText(path)) return;
  if (source) state.sources++;
  const text = await readText(state, absolute, size);
  if (text !== null) state.texts.set(path, text);
}
/** Defends against a folder swapped for a link after it was listed: its real path must stay inside the target. */
async function contained(root: string, absolute: string): Promise<boolean> {
  try {
    const inside = relative(root, await realpath(absolute));
    return !(inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside));
  } catch { return false; }
}
/** A folder holding an extracted CLI kit is recorded by its kit.json marker only and not entered. */
async function isKit(absolute: string, names: readonly string[]): Promise<boolean> {
  if (!names.includes('bin')) return false;
  try { return (await lstat(join(absolute, 'bin', 'kit.json'))).isFile() && (await lstat(join(absolute, 'bin', 'app'))).isFile(); } catch { return false; }
}
type Entry = { name: string; isSymbolicLink(): boolean; isDirectory(): boolean; isFile(): boolean };
async function listDirectory(state: State, root: string, folder: string): Promise<Entry[] | null> {
  const absolute = folder ? join(root, folder) : root;
  if (folder && !await contained(root, absolute)) { state.scan.skipped.symlinks++; return null; }
  try { return (await readdir(absolute, { withFileTypes: true })).sort((a, b) => byCodeUnit(a.name, b.name)); } catch { state.scan.skipped.unreadable++; return null; }
}
async function recordKit(state: State, root: string, folder: string): Promise<void> {
  state.files.push({ path: `${folder}/bin/kit.json`, bytes: (await lstat(join(root, folder, 'bin', 'kit.json'))).size });
  state.scan.skipped.directories.push(`${folder} (CLI kit)`);
}
const stopped = (state: State): boolean => Boolean(state.signal?.aborted) || (state.scan.truncated && state.files.length >= state.limits.maxFiles);
async function visitEntry(state: State, root: string, folder: string, entry: Entry, depth: number): Promise<void> {
  const path = folder ? `${folder}/${entry.name}` : entry.name;
  if (entry.isSymbolicLink()) state.scan.skipped.symlinks++;
  else if (entry.isDirectory()) await enterDirectory(state, root, path, entry.name, depth);
  else if (entry.isFile()) await countFile(state, root, path);
}
async function visitDirectory(state: State, root: string, folder: string, depth: number): Promise<void> {
  const entries = await listDirectory(state, root, folder);
  if (entries === null) return;
  if (folder && await isKit(join(root, folder), entries.map(entry => entry.name))) { await recordKit(state, root, folder); return; }
  for (const entry of entries) {
    if (stopped(state)) return;
    await visitEntry(state, root, folder, entry, depth);
  }
}
async function countFile(state: State, root: string, path: string): Promise<void> {
  if (state.files.length >= state.limits.maxFiles) { state.scan.truncated = true; return; }
  await visitFile(state, root, path);
}
async function enterDirectory(state: State, root: string, path: string, name: string, depth: number): Promise<void> {
  if (excludedDirectories.has(name)) { if (state.scan.skipped.directories.length < 30) state.scan.skipped.directories.push(path); return; }
  if (depth >= state.limits.maxDepth) { state.scan.truncated = true; return; }
  await visitDirectory(state, root, path, depth + 1);
}
/** Bounded, read-only walk. Never follows symbolic links, never executes anything, never writes. */
export async function scanProject(root: string, limits: ScanLimits = defaultLimits, signal?: AbortSignal): Promise<Scanned> {
  const scan: ScanFacts = { files: 0, bytesRead: 0, truncated: false, maxFiles: limits.maxFiles, maxFileBytes: limits.maxFileBytes, skipped: { directories: [], symlinks: 0, oversize: 0, binary: 0, unreadable: 0 } };
  const state: State = { limits, files: [], texts: new Map(), scan, sources: 0, signal };
  await visitDirectory(state, root, '', 0);
  state.files.sort((a, b) => byCodeUnit(a.path, b.path));
  scan.files = state.files.length;
  scan.skipped.directories.sort(byCodeUnit);
  return { files: state.files, texts: state.texts, scan };
}
