import { mkdir, mkdtemp, lstat, realpath } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilePlan } from '../shared/file-plan.mjs';
/** The pinned launcher 3.2.1 keeps copy:false vaults in place and creates a
 * fresh obsidian-launcher-config-* directory directly under os.tmpdir(). */
export async function nativeScratch(root = process.cwd()) {
  await createFilePlan(root, [{ path: '.native-cache/qualification/.ownership', content: null }]);
  const base = resolve(root, '.native-cache/qualification'); await mkdir(base, { recursive: true });
  await createFilePlan(root, [{ path: '.native-cache/qualification/.ownership', content: null }]);
  return mkdtemp(join(base, 'run-'));
}
export async function nativeConfigDirectory(directory) {
  if (typeof directory !== 'string' || !/^obsidian-launcher-config-[a-zA-Z0-9]+$/.test(basename(directory))) throw new Error('UNSAFE_NATIVE_CONFIG');
  const target = resolve(directory); const stat = await lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(dirname(target)) !== await realpath(tmpdir())) throw new Error('UNSAFE_NATIVE_CONFIG');
  return target;
}
export async function assertNativeVault(actual, requested) {
  if (typeof actual !== 'string' || resolve(actual) !== resolve(requested) || await realpath(actual) !== resolve(requested)) throw new Error('UNSAFE_NATIVE_VAULT');
}
