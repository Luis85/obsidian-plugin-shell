/** Bounded companion-project reads: a contained vault target, one regular input file, no writes (the v1 seam). */
import { constants, type Stats } from 'node:fs';
import { lstat, open, realpath, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { COMPANION_MAX_BYTES, companionRelativeFolder, parseCompanionDocument, migrateCompanionDocument } from '../../../scripts/companion/project-contract.mjs';

export interface CompanionRequest { input: unknown; target: string; vault?: string }
export interface Migrated { document: { settings: Record<string, string> }; report: unknown }
export interface CompanionReader<M extends Migrated> { parse: (text: string) => unknown; migrate: (value: unknown) => M }
/** The shared companion contract: parse, then migrate legacy versions to the current one. */
export const companionReader = { parse: parseCompanionDocument, migrate: migrateCompanionDocument };

const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
async function checkDirectoryChain(root: string, path: string): Promise<void> {
  let current = root;
  for (const part of path === '.' ? [] : path.split('/')) {
    current = join(current, part);
    let stat: Stats;
    try { stat = await lstat(current); } catch (error) {
      if (missing(error)) return; // A future directory, never created in v1.
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('COMPANION_TARGET: Target contains a link or non-directory.');
  }
}
async function readLimited(file: FileHandle): Promise<Buffer> {
  const buffer = Buffer.alloc(COMPANION_MAX_BYTES + 1);
  let length = 0;
  while (length < buffer.length) {
    const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
    if (!bytesRead) break;
    length += bytesRead;
  }
  if (length > COMPANION_MAX_BYTES) throw new Error('COMPANION_INPUT: File exceeds 4 MB.');
  return buffer.subarray(0, length);
}
/** The input's exact bytes and their strict UTF-8 text, from the same regular file that was inspected. */
async function readBoundedText(input: string): Promise<{ content: Buffer; text: string }> {
  const before = await lstat(input);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('COMPANION_INPUT: Expected a regular JSON file, not a link.');
  const file = await open(input, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev) throw new Error('COMPANION_INPUT: Input changed before reading.');
    if (stat.size > COMPANION_MAX_BYTES) throw new Error('COMPANION_INPUT: File exceeds 4 MB.');
    const content = await readLimited(file);
    return { content, text: new TextDecoder('utf-8', { fatal: true }).decode(content) };
  } finally { await file.close(); }
}
function requireInput(input: unknown): asserts input is string {
  if (typeof input !== 'string' || !input.trim()) throw new Error('COMPANION_INPUT: Supply --input <project.json>.');
}
async function vaultRoot(vault: string, message: string): Promise<string> {
  const root = await realpath(resolve(vault));
  if (!(await lstat(root)).isDirectory()) throw new Error('COMPANION_TARGET: ' + message);
  return root;
}

/** Read and return a project definition. This v1 seam never generates files. */
export async function readCompanionProject<M extends Migrated>({ input, target, vault = process.cwd() }: CompanionRequest, reader: CompanionReader<M>) {
  requireInput(input);
  if (!companionRelativeFolder(target, true)) throw new Error('COMPANION_TARGET: Use a portable vault-relative --target path, or dot for the vault root.');
  const root = await vaultRoot(vault, 'The vault root must be an existing directory.');
  await checkDirectoryChain(root, target);
  const { content, text } = await readBoundedText(resolve(input));
  const { document, report } = reader.migrate(reader.parse(text));
  for (const folder of Object.values(document.settings)) {
    await checkDirectoryChain(root, target === '.' ? folder : target + '/' + folder);
  }
  return { content, document, migration: report, vault: root, target: resolve(root, target) };
}

/** Raw input for the dedicated compiler. Same containment and bounded byte checks; no semantic parsing. */
export async function readCompanionInput({ input, target, vault = process.cwd() }: CompanionRequest) {
  requireInput(input);
  if (!companionRelativeFolder(target, true)) throw new Error('COMPANION_TARGET: Use a portable vault-relative --target path.');
  const root = await vaultRoot(vault, 'Expected an existing directory.');
  await checkDirectoryChain(root, target);
  const { content } = await readBoundedText(resolve(input));
  return { content, vault: root, target: resolve(root, target) };
}
