import { isProtectedSegment } from '../../../../scripts/shared/protected-directories.ts';
import { lstat, readdir, realpath, open, type FileHandle } from 'node:fs/promises';
import { constants, type Stats } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join, sep } from 'node:path';
import { sha256 } from '../../../../scripts/shared/hash.ts';
import { insist } from '../domain/contracts.ts';
import { hasControls } from '../../domain/errors.ts';
export const documentationDigest = (value: string | Uint8Array): string => sha256(value);
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function portable(path: string): string {
  insist(typeof path === 'string' && path.length <= 1024 && !isAbsolute(path) && !path.includes('\\'), 'DOCS_PATH', 'Use a portable project-relative path.');
  // Intentional portability boundary: reject Windows-reserved characters and C0/C1 controls in path segments.
  insist(path.split('/').every(part => part && part !== '.' && part !== '..' && !/[<>:"|?*]/.test(part) && !hasControls(part) && !/[ .]$/.test(part) && !reserved.test(part)), 'DOCS_PATH', 'Unsafe path segment.');
  return path;
}
export function localPath(root: string, path: string): string | null {
  const value = relative(resolve(root), resolve(path));
  return value && !isAbsolute(value) && value !== '..' && !value.startsWith('..' + sep) ? value.split(sep).join('/') : null;
}
/** Reject links in the entire chain, including the chosen source root. */
export async function safePath(path: string): Promise<boolean> {
  const parts: string[] = [];
  for (let current = resolve(path); ; current = dirname(current)) { parts.push(current); if (dirname(current) === current) break; }
  for (const current of parts.reverse()) {
    try { const info = await lstat(current); insist(!info.isSymbolicLink(), 'DOCS_SYMLINK', 'Symlink paths are not accepted: ' + current); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false; throw error; }
  }
  return true;
}
// Opening a FIFO before checking its type can block the CLI indefinitely.
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
const bounded = (info: Stats, maximum: number): boolean => info.isFile() && info.size <= maximum;
const sameFile = (left: Stats, right: Stats): boolean => left.ino === right.ino && left.dev === right.dev;
function unchanged(before: Stats, after: Stats, length: number, maximum: number): boolean {
  return length <= maximum && before.size === after.size && length === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}
async function readFully(file: FileHandle, size: number, maximum: number): Promise<Buffer> {
  const buffer = Buffer.alloc(Math.min(maximum + 1, size + 1)); let length = 0;
  while (length < buffer.length) { const result = await file.read(buffer, length, buffer.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
  return buffer.subarray(0, length);
}
export async function readBytes(path: string, maximum = 4_000_000): Promise<Buffer | null> {
  if (!await safePath(path)) return null;
  const observed = await lstat(path);
  insist(bounded(observed, maximum), 'DOCS_LIMIT', 'Input must be a bounded regular file: ' + path);
  const file = await open(path, READ_FLAGS);
  try {
    const before = await file.stat();
    insist(bounded(before, maximum) && sameFile(before, observed), 'DOCS_LIMIT', 'Input must be a bounded regular file: ' + path);
    const bytes = await readFully(file, before.size, maximum), after = await file.stat();
    insist(unchanged(before, after, bytes.length, maximum), 'DOCS_INPUT_CHANGED', 'Input changed while reading: ' + path);
    return bytes;
  } finally { await file.close(); }
}
export const decode = (bytes: Buffer): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
export interface DocumentationSource { path: string; relative: string; boundary: string; bytes: Buffer }
function glob(pattern: string): RegExp {
  let result = '^';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index]!;
    if (character === '*' && pattern[index + 1] === '*') {
      index++; if (pattern[index + 1] === '/') { index++; result += '(?:.*/)?'; } else result += '.*';
    } else if (character === '*') result += '[^/]*'; else if (character === '?') result += '[^/]';
    else result += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(result + '$', 'i');
}
interface DiscoveryOptions { recursive: boolean; include: string[]; exclude: string[] }
interface Discovery { options: DiscoveryOptions; includes: RegExp[]; excludes: RegExp[]; found: Map<string, DocumentationSource>; total: number; visited: number }
const isIgnored = (part: string): boolean => isProtectedSegment(part);
function excluded(discovery: Discovery, rel: string): boolean {
  return discovery.excludes.some(pattern => pattern.test(rel)) || rel.split('/').some(isIgnored);
}
async function visitDirectory(discovery: Discovery, path: string, boundary: string, depth: number): Promise<void> {
  if (depth && !discovery.options.recursive) return;
  const names = await readdir(path); names.sort();
  for (const name of names) if (!isIgnored(name)) await visit(discovery, join(path, name), boundary, depth + 1);
}
function selected(discovery: Discovery, path: string, rel: string, explicit: boolean): { asset: boolean } | null {
  const isMarkdown = /\.md$/i.test(path), asset = /\.(?:png|jpe?g|webp|gif|svg|pdf)$/i.test(path);
  if (!isMarkdown && !asset) return null;
  if (isMarkdown && !explicit && !discovery.includes.some(pattern => pattern.test(rel))) return null;
  return { asset };
}
async function collect(discovery: Discovery, path: string, boundary: string, rel: string, asset: boolean): Promise<void> {
  const canonical = await realpath(path);
  if (discovery.found.has(canonical)) return;
  const bytes = await readBytes(path, asset ? 8_000_000 : 4_000_000); insist(bytes, 'DOCS_INPUT_CHANGED', 'Discovered input disappeared.');
  discovery.total += bytes.length; insist(discovery.total <= 32_000_000 && discovery.found.size < 4000, 'DOCS_LIMIT', 'Documentation exceeds 32 MB or 4000 files.');
  discovery.found.set(canonical, { path, relative: rel, boundary, bytes });
}
async function visit(discovery: Discovery, path: string, boundary: string, depth: number, explicit = false): Promise<void> {
  insist(depth <= 40 && ++discovery.visited <= 20000, 'DOCS_LIMIT', 'Discovery exceeds the directory budget.');
  if (!await safePath(path)) { insist(!explicit, 'DOCS_INPUT_MISSING', 'Selected input does not exist: ' + path); return; }
  const info = await lstat(path), rel = localPath(boundary, path) ?? '';
  if (rel) portable(rel);
  if (rel && excluded(discovery, rel)) return;
  if (info.isDirectory()) return visitDirectory(discovery, path, boundary, depth);
  const kind = selected(discovery, path, rel, explicit);
  if (kind) await collect(discovery, path, boundary, rel, kind.asset);
}
export async function discover(roots: string[], options: DiscoveryOptions): Promise<DocumentationSource[]> {
  const discovery: Discovery = { options, includes: options.include.map(glob), excludes: options.exclude.map(glob), found: new Map(), total: 0, visited: 0 };
  for (const root of [...new Set(roots.map(path => resolve(path)))].sort()) {
    if (!await safePath(root)) continue;
    const info = await lstat(root); await visit(discovery, root, info.isDirectory() ? root : dirname(root), 0, true);
  }
  return [...discovery.found.values()].sort((a, b) => a.path < b.path ? -1 : 1);
}
