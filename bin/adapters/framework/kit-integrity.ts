import { mapBounded } from '../../../scripts/shared/bounded-map.ts';
import { portableFile } from './archive-path.ts';
import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { exactKeys, object } from './configuration.ts';
import { exists, hash, readBounded, readJson } from './files.ts';
import { requireThat } from './contracts.ts';

export interface KitFile { path: string; hash: string; bytes: number }
/** The packaged CLI has one launcher. Runtime, data and templates are owned below bin/. */
export const launcherFiles = ['bin/app'];
export const bootstrapFiles = [...launcherFiles, 'package.json', 'README.md', 'LICENSE'];
export interface Kit { schemaVersion: 2; version: string; compilerVersion: string; sourceHash: string; files: KitFile[]; bootstrap: Array<{path: string; hash: string}> }

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

const sha256Hex = /^[a-f0-9]{64}$/;
type ManifestHeader = { version: string; compilerVersion: string; sourceHash: string; files: unknown[]; bootstrap: unknown[] };
function manifestHeader(value: unknown): ManifestHeader {
  const input = object(value); exactKeys(input, ['schemaVersion', 'version', 'compilerVersion', 'sourceHash', 'files', 'bootstrap']);
  const { version, compilerVersion, sourceHash, files, bootstrap } = input;
  requireThat(input.schemaVersion === 2 && typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version) && typeof compilerVersion === 'string', 'KIT_VERSION', 'Unsupported kit manifest.');
  requireThat(typeof sourceHash === 'string' && sha256Hex.test(sourceHash), 'KIT_HASH', 'Invalid kit source hash.');
  requireThat(Array.isArray(files) && files.length > 0 && files.length <= 5000 && Array.isArray(bootstrap) && bootstrap.length <= 10, 'KIT_LIMIT', 'Invalid kit inventory.');
  return { version, compilerVersion, sourceHash, files, bootstrap };
}
const ownedKitPath = (path: unknown): path is string => typeof path === 'string' && (path === 'bin/app.js' || /^bin\/(?:template|plugins|licenses)\//.test(path));
const validBytes = (bytes: unknown): bytes is number => typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= 8_000_000;
function kitFile(value: unknown, names: Set<string>): KitFile {
  const file = object(value); exactKeys(file, ['path', 'hash', 'bytes']);
  const { path, hash: digest, bytes } = file;
  requireThat(ownedKitPath(path) && portableFile(path), 'KIT_PATH', 'Unsafe kit path.');
  requireThat(!names.has(path.toLowerCase()), 'KIT_DUPLICATE', 'Duplicate kit file.'); names.add(path.toLowerCase());
  requireThat(typeof digest === 'string' && sha256Hex.test(digest) && validBytes(bytes), 'KIT_HASH', 'Invalid file fingerprint.');
  return { path, hash: digest, bytes };
}
function bootstrapFile(value: unknown): { path: string; hash: string } {
  const file = object(value); exactKeys(file, ['path', 'hash']);
  const { path, hash: digest } = file;
  requireThat(typeof path === 'string' && bootstrapFiles.includes(path) && typeof digest === 'string' && sha256Hex.test(digest), 'KIT_BOOTSTRAP', 'Invalid bootstrap fingerprint.');
  return { path, hash: digest };
}
export function kitManifest(value: unknown): Kit {
  const header = manifestHeader(value), names = new Set<string>();
  const files = header.files.map(file => kitFile(file, names));
  const bootstrap = header.bootstrap.map(bootstrapFile);
  const paths = new Set(bootstrap.map(file => file.path));
  requireThat(paths.size === bootstrapFiles.length && bootstrap.length === bootstrapFiles.length && bootstrapFiles.every(path => paths.has(path)), 'KIT_BOOTSTRAP', 'Missing or duplicated bootstrap identity.');
  return { schemaVersion: 2, version: header.version, compilerVersion: header.compilerVersion, sourceHash: header.sourceHash, files, bootstrap };
}

export async function verifyKit(root: string): Promise<Kit> {
  const kit = kitManifest(await readJson(join(root, 'bin/kit.json')));
  const actual = (await listFiles(root, 'bin')).filter(path => path !== 'bin/app' && path !== 'bin/kit.json').sort();
  requireThat(JSON.stringify(actual) === JSON.stringify(kit.files.map(file => file.path).sort()), 'KIT_INVENTORY', 'Missing or unlisted kit files.');
  requireThat(kit.files.reduce((total, file) => total + file.bytes, 0) <= 100_000_000, 'KIT_MODIFIED', 'Kit inventory exceeds its byte bound.');
  await mapBounded(kit.files, 8, async file => {
    const content = await readBounded(join(root, file.path), 8_000_000);
    requireThat(content.length === file.bytes && hash(content) === file.hash, 'KIT_MODIFIED', `Kit fingerprint mismatch: ${file.path}.`);
  });
  if (!await exists(join(root, '.companion/generation.json'))) for (const file of kit.bootstrap) {
    requireThat(hash(await readBounded(join(root, file.path), 8_000_000)) === file.hash, 'BOOTSTRAP_MODIFIED', `Bootstrap changed before generation: ${file.path}.`);
  }
  return kit;
}
