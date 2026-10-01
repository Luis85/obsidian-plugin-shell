import { mapBounded } from '../../../scripts/shared/bounded-map.ts';
import { portableFile } from './archive-path.ts';
import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { exactKeys, object } from './configuration.ts';
import { exists, hash, readBounded, readJson } from './files.ts';
import { requireThat } from './contracts.ts';
export interface KitFile { path: string; hash: string; bytes: number }
/** Launchers copied to the kit root. Kits packed before the app.mjs rename carry only shell.mjs. */
export const launcherFiles = ['app.mjs', 'bin/app', 'shell.mjs'];
export const bootstrapFiles = [...launcherFiles, 'package.json', 'README.md', 'LICENSE'];
const legacyBootstrap = ['shell.mjs', 'package.json', 'README.md', 'LICENSE'];
export interface Kit { schemaVersion: 1; version: string; compilerVersion: string; sourceHash: string; files: KitFile[]; bootstrap: Array<{path: string; hash: string}> }
export async function listFiles(root: string, folder: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(path: string): Promise<void> {
    const stat = await lstat(join(root, path));
    requireThat(!stat.isSymbolicLink(), 'KIT_LINK', 'Kit inputs must not contain links.');
    if (stat.isDirectory()) for (const name of (await readdir(join(root, path))).sort()) await walk(path + '/' + name);
    else { requireThat(stat.isFile() && stat.nlink === 1, 'KIT_FILE', 'Kit inputs must be regular files.'); result.push(path); }
  }
  await walk(folder); return result;
}
export function kitManifest(value: unknown): Kit {
  const input = object(value); exactKeys(input, ['schemaVersion', 'version', 'compilerVersion', 'sourceHash', 'files', 'bootstrap']);
  requireThat(input.schemaVersion === 1 && typeof input.version === 'string' && /^\d+\.\d+\.\d+$/.test(input.version) && typeof input.compilerVersion === 'string', 'KIT_VERSION', 'Unsupported kit manifest.');
  requireThat(typeof input.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(input.sourceHash), 'KIT_HASH', 'Invalid kit source hash.');
  requireThat(Array.isArray(input.files) && input.files.length > 0 && input.files.length <= 5000 && Array.isArray(input.bootstrap) && input.bootstrap.length <= 10, 'KIT_LIMIT', 'Invalid kit inventory.');
  const names = new Set<string>();
  const files = input.files.map(value => {
    const file = object(value); exactKeys(file, ['path', 'hash', 'bytes']);
    requireThat(typeof file.path === 'string' && /^(?:\.framework\/(?:template|compiled))\//.test(file.path) && portableFile(file.path), 'KIT_PATH', 'Unsafe kit path.');
    requireThat(!names.has(file.path.toLowerCase()), 'KIT_DUPLICATE', 'Duplicate kit file.'); names.add(file.path.toLowerCase());
    requireThat(typeof file.hash === 'string' && /^[a-f0-9]{64}$/.test(file.hash) && typeof file.bytes === 'number' && Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= 8_000_000, 'KIT_HASH', 'Invalid file fingerprint.');
    return { path: file.path, hash: file.hash, bytes: file.bytes };
  });
  const bootstrap = input.bootstrap.map(value => {
    const file = object(value); exactKeys(file, ['path', 'hash']);
    requireThat(typeof file.path === 'string' && bootstrapFiles.includes(file.path) && typeof file.hash === 'string' && /^[a-f0-9]{64}$/.test(file.hash), 'KIT_BOOTSTRAP', 'Invalid bootstrap fingerprint.');
    return { path: file.path, hash: file.hash };
  });
  const paths = new Set(bootstrap.map(file => file.path));
  const complete = [bootstrapFiles, legacyBootstrap].some(expected => paths.size === bootstrap.length && bootstrap.length === expected.length && expected.every(path => paths.has(path)));
  requireThat(complete, 'KIT_BOOTSTRAP', 'Missing or duplicated bootstrap identity.');
  return { schemaVersion: 1, version: input.version, compilerVersion: input.compilerVersion, sourceHash: input.sourceHash, files, bootstrap };
}
export async function verifyKit(root: string): Promise<Kit> {
  const kit = kitManifest(await readJson(join(root, '.framework/kit.json')));
  const actual = [...await listFiles(root, '.framework/template'), ...await listFiles(root, '.framework/compiled')].sort();
  requireThat(JSON.stringify(actual) === JSON.stringify(kit.files.map(file => file.path).sort()), 'KIT_INVENTORY', 'Missing or unlisted kit files.');
  requireThat(kit.files.reduce((total, file) => total + file.bytes, 0) <= 100_000_000, 'KIT_MODIFIED', 'Kit inventory exceeds its byte bound.');
  await mapBounded(kit.files, 8, async file => {
    // No retained metadata cache: every invocation reopens every file and all its ancestors.
    const content = await readBounded(join(root, file.path), 8_000_000);
    requireThat(content.length === file.bytes && hash(content) === file.hash, 'KIT_MODIFIED', `Kit fingerprint mismatch: ${file.path}.`);
  });
  if (!await exists(join(root, '.companion/generation.json'))) for (const file of kit.bootstrap) {
    requireThat(hash(await readBounded(join(root, file.path), 8_000_000)) === file.hash, 'BOOTSTRAP_MODIFIED', `Bootstrap changed before generation: ${file.path}.`);
  }
  return kit;
}
