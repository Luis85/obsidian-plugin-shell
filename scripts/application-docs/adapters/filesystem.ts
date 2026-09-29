import { lstat, readdir, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { insist } from '../domain/contracts.ts';
export const digest = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function portable(path: string): string {
  insist(typeof path === 'string' && path.length <= 1024 && !isAbsolute(path) && !path.includes('\\'), 'DOCS_PATH', 'Use a portable project-relative path.');
  insist(path.split('/').every(part => part && part !== '.' && part !== '..' && !/[<>:"|?*\u0000-\u001f]/.test(part) && !/[ .]$/.test(part) && !reserved.test(part)), 'DOCS_PATH', 'Unsafe path segment.');
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
export async function readBytes(path: string, maximum = 4_000_000): Promise<Buffer | null> {
  if (!await safePath(path)) return null;
  const observed = await lstat(path);
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await file.stat();
    insist(before.isFile() && before.size <= maximum && before.ino === observed.ino && before.dev === observed.dev, 'DOCS_LIMIT', 'Input must be a bounded regular file: ' + path);
    const buffer = Buffer.alloc(Math.min(maximum + 1, before.size + 1)); let length = 0;
    while (length < buffer.length) { const result = await file.read(buffer, length, buffer.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
    const bytes = buffer.subarray(0, length), after = await file.stat();
    insist(bytes.length <= maximum && before.size === after.size && bytes.length === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'DOCS_INPUT_CHANGED', 'Input changed while reading: ' + path);
    return bytes;
  } finally { await file.close(); }
}
export const decode = (bytes: Buffer): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
export interface Source { path: string; relative: string; boundary: string; bytes: Buffer }
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
const ignored = new Set(['.git', '.obsidian', '.framework', '.companion', 'node_modules', '.codex-authoring.lock']);
export async function discover(roots: string[], options: { recursive: boolean; include: string[]; exclude: string[] }): Promise<Source[]> {
  const found = new Map<string, Source>(), includes = options.include.map(glob), excludes = options.exclude.map(glob);
  let total = 0, visited = 0;
  async function visit(path: string, boundary: string, depth: number, explicit = false): Promise<void> {
    insist(depth <= 40 && ++visited <= 20000, 'DOCS_LIMIT', 'Discovery exceeds the directory budget.');
    if (!await safePath(path)) { insist(!explicit, 'DOCS_INPUT_MISSING', 'Selected input does not exist: ' + path); return; }
    const info = await lstat(path), rel = localPath(boundary, path) ?? '';
    if (rel) portable(rel);
    if (rel && (excludes.some(pattern => pattern.test(rel)) || rel.split('/').some(part => ignored.has(part.toLowerCase())))) return;
    if (info.isDirectory()) {
      if (depth && !options.recursive) return;
      const names = await readdir(path); names.sort();
      for (const name of names) if (!ignored.has(name.toLowerCase())) await visit(join(path, name), boundary, depth + 1);
      return;
    }
    const isMarkdown = /\.md$/i.test(path), asset = /\.(?:png|jpe?g|webp|gif|svg|pdf)$/i.test(path);
    if (!isMarkdown && !asset || isMarkdown && !explicit && !includes.some(pattern => pattern.test(rel))) return;
    const canonical = await realpath(path);
    if (found.has(canonical)) return;
    const bytes = await readBytes(path, asset ? 8_000_000 : 4_000_000); insist(bytes, 'DOCS_INPUT_CHANGED', 'Discovered input disappeared.');
    total += bytes.length; insist(total <= 32_000_000 && found.size < 4000, 'DOCS_LIMIT', 'Documentation exceeds 32 MB or 4000 files.');
    found.set(canonical, { path, relative: rel, boundary, bytes });
  }
  for (const root of [...new Set(roots.map(path => resolve(path)))].sort()) {
    if (!await safePath(root)) continue;
    const info = await lstat(root); await visit(root, info.isDirectory() ? root : dirname(root), 0, true);
  }
  return [...found.values()].sort((a, b) => a.path < b.path ? -1 : 1);
}
