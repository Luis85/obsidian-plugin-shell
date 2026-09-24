import { mkdir, mkdtemp, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, basename, sep, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilePlan } from '../shared/file-plan.mjs';
/** Launcher 3.2.1 reads os.tmpdir() per launch; scope it to this contained run. */
export async function nativeScratch(root = process.cwd()) {
  root = (await createFilePlan(root, [{ path: '.nq/.ownership', content: null }])).root;
  const base = resolve(root, '.nq'); await mkdir(base, { recursive: true });
  await createFilePlan(root, [{ path: '.nq/.ownership', content: null }]);
  return mkdtemp(`${base}${sep}`);
}
export async function nativeScratchDirectory(directory, root = process.cwd()) {
  root = (await createFilePlan(root, [{ path: '.nq/.ownership', content: null }])).root;
  if (typeof directory !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(basename(directory))) throw new Error('UNSAFE_NATIVE_SCRATCH');
  const target = resolve(directory); const stat = await lstat(target);
  const base = resolve(root, '.nq');
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(dirname(target)) !== base || await realpath(target) !== target) throw new Error('UNSAFE_NATIVE_SCRATCH');
  return target;
}
/** Linux sun_path has 108 bytes including NUL. The pinned 1.13.7 failure records
 * scoped_dir + six random bytes; review that suffix before qualifying another host.
 * https://raw.githubusercontent.com/torvalds/linux/master/include/uapi/linux/un.h
 * https://chromium.googlesource.com/chromium/src/+/refs/tags/141.0.7390.0/chrome/browser/process_singleton_posix.cc
 * Other platforms have different singleton implementations; this is Linux only. */
export function assertNativeSocketBudget(directory, platform = process.platform) {
  if (platform !== 'linux') return;
  const bytes = Buffer.byteLength(posix.join(directory, 'scoped_dirXXXXXX', 'SingletonSocket'), 'utf8');
  if (bytes > 107) throw new Error(`NATIVE_SOCKET_PATH_TOO_LONG: ${bytes} bytes exceeds the Linux 107-byte socket path budget; use a shorter codebase checkout path. Temporary data must remain contained.`);
  return bytes;
}
export async function nativeConfigDirectory(directory, scratch, root = process.cwd()) {
  scratch = await nativeScratchDirectory(scratch, root);
  if (typeof directory !== 'string' || !/^obsidian-launcher-config-[a-zA-Z0-9]+$/.test(basename(directory))) throw new Error('UNSAFE_NATIVE_CONFIG');
  const target = resolve(directory); const stat = await lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(dirname(target)) !== scratch || await realpath(target) !== target) throw new Error('UNSAFE_NATIVE_CONFIG');
  return target;
}
let temporaryScopeActive = false;
export async function withNativeTemporaryDirectory(scratch, callback, root = process.cwd(), platform = process.platform) {
  if (temporaryScopeActive) throw new Error('NATIVE_TEMP_SCOPE_BUSY');
  temporaryScopeActive = true;
  const keys = ['TMP', 'TEMP', 'TMPDIR']; const previous = keys.map(key => [key, process.env[key]]);
  let result; let failure; let failed = false; const cleanup = [];
  try {
    scratch = await nativeScratchDirectory(scratch, root);
    assertNativeSocketBudget(scratch, platform);
    for (const key of keys) process.env[key] = scratch;
    if (await realpath(tmpdir()) !== scratch) throw new Error('UNSAFE_NATIVE_TEMP');
    result = await callback();
  } catch (error) { failed = true; failure = error; }
  finally {
    for (const [key, value] of previous) {
      try { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      catch (error) { cleanup.push(error); }
    }
    temporaryScopeActive = false;
  }
  if (cleanup.length) throw new AggregateError(failed ? [failure, ...cleanup] : cleanup, 'NATIVE_TEMP_RESTORE_FAILED');
  if (failed) throw failure;
  return result;
}
export async function assertNativeVault(actual, requested) {
  if (typeof actual !== 'string' || resolve(actual) !== resolve(requested) || await realpath(actual) !== resolve(requested)) throw new Error('UNSAFE_NATIVE_VAULT');
}
