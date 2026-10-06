/** Integrity for the compiled CLI carried by a generated source project, without the distribution's template tree. */
import { join } from 'node:path';
import { listFiles, type KitFile } from './kit-integrity.ts';
import { hash, readBounded, readJson } from './files.ts';
import { exactKeys, object } from './configuration.ts';
import { portableFile } from './archive-path.ts';
import { requireThat } from './contracts.ts';
import { serializeJson } from '../../../../scripts/contracts/serialization.ts';
import type { ArchiveFile } from './zip.ts';

const runtimePath = (path: string) => ['bin/app', 'bin/app.js', 'bin/package.json', 'bin/README.md', 'bin/LICENSE'].includes(path) || /^bin\/(?:tools|licenses)\//.test(path);
const boundedSize = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8_000_000;
export function cliArtifact(files: readonly ArchiveFile[]): { bytes: Buffer; paths: string[] } {
  const runtime = files.filter(file => runtimePath(file.path));
  return { paths: runtime.map(file => file.path), bytes: Buffer.from(serializeJson({ schemaVersion: 1, files: runtime.map(file => ({
    path: file.path, hash: hash(file.bytes), bytes: file.bytes.length,
  })).sort((a, b) => a.path.localeCompare(b.path)) })) };
}
function runtimeFile(entry: unknown, names: Set<string>): KitFile {
  const file = object(entry); exactKeys(file, ['path', 'hash', 'bytes']);
  const { path, hash: digest, bytes } = file;
  requireThat(typeof path === 'string' && runtimePath(path) && portableFile(path) && !names.has(path.toLowerCase()), 'CLI_PATH', 'Invalid or duplicated CLI artifact path.');
  requireThat(typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest) && boundedSize(bytes), 'CLI_HASH', 'Invalid CLI artifact fingerprint.');
  names.add(path.toLowerCase());
  return { path, hash: digest, bytes };
}
function runtimeManifest(value: unknown): KitFile[] {
  const manifest = object(value);
  exactKeys(manifest, ['schemaVersion', 'files']);
  requireThat(manifest.schemaVersion === 1 && Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 5000, 'CLI_MANIFEST', 'Invalid CLI artifact inventory.');
  const names = new Set<string>();
  const files = manifest.files.map(entry => runtimeFile(entry, names));
  for (const required of ['bin/app', 'bin/app.js', 'bin/package.json', 'bin/README.md', 'bin/LICENSE']) requireThat(names.has(required.toLowerCase()), 'CLI_INVENTORY', `Missing runtime input: ${required}`);
  requireThat(files.reduce((total, file) => total + file.bytes, 0) <= 100_000_000, 'CLI_SIZE', 'CLI artifact exceeds its byte bound.');
  return files;
}
export async function verifyCliArtifact(root: string): Promise<void> {
  const files = runtimeManifest(await readJson(join(root, 'bin/cli.json')));
  const actual = (await listFiles(root, 'bin', path => path === 'bin/plugins')).filter(path => path !== 'bin/cli.json').sort();
  requireThat(JSON.stringify(actual) === JSON.stringify(files.map(file => file.path).sort()), 'CLI_INVENTORY', 'Missing or unlisted CLI artifact files.');
  for (const file of files) {
    const bytes = await readBounded(join(root, file.path), 8_000_000);
    requireThat(bytes.length === file.bytes && hash(bytes) === file.hash, 'CLI_MODIFIED', `CLI artifact changed: ${file.path}`);
  }
}
