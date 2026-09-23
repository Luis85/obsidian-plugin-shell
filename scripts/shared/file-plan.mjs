import { constants } from 'node:fs';
import { lstat, realpath, readdir, readFile, writeFile, mkdir, copyFile, rename, unlink, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';

const protectedRoots = new Set(['.git', 'node_modules', '.worktrees', '.qualification', '.dev-vault', '.native-runner', '.codex-authoring.lock']);
const hash = value => createHash('sha256').update(value).digest('hex');
function relativePath(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\')) throw new Error('PLAN_UNSAFE_PATH');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\u0000-\u001f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('PLAN_UNSAFE_PATH');
  if (protectedRoots.has(parts[0].toLowerCase())) throw new Error('PLAN_PROTECTED_PATH');
  return parts;
}
async function inspect(root, path) {
  const parts = relativePath(path);
  let parent = root;
  for (let index = 0; index < parts.length; index++) {
    const names = await readdir(parent);
    const matching = names.find(name => name.toLowerCase() === parts[index].toLowerCase());
    if (matching && matching !== parts[index]) throw new Error(`PLAN_CASE_COLLISION: ${path}`);
    const current = join(parent, parts[index]);
    let entry;
    try { entry = await lstat(current); }
    catch (error) { if (error.code === 'ENOENT') return { path: join(root, ...parts), bytes: null }; throw error; }
    if (entry.isSymbolicLink()) throw new Error(`PLAN_SYMLINK: ${path}`);
    if (index < parts.length - 1) {
      if (!entry.isDirectory()) throw new Error(`PLAN_PARENT_CONFLICT: ${path}`);
      parent = current;
    } else {
      if (!entry.isFile()) throw new Error(`PLAN_FILE_CONFLICT: ${path}`);
      return { path: current, bytes: await readFile(current) };
    }
  }
  throw new Error('PLAN_UNSAFE_PATH');
}
async function directoryChain(root) {
  const ancestors = [];
  for (let path = root; ; path = dirname(path)) { ancestors.push(path); if (dirname(path) === path) break; }
  let entry;
  for (const path of ancestors.toReversed()) {
    entry = await lstat(path, { bigint: true });
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('PLAN_UNSAFE_ROOT');
  }
  return entry;
}
async function checkedRoot(input) {
  const requested = resolve(input);
  const before = await directoryChain(requested);
  // Windows case and 8.3 spellings identify the same directory without being
  // redirects. Inspect links before canonicalizing so realpath cannot hide one.
  const root = await realpath(requested);
  const after = await directoryChain(requested);
  const canonical = root === requested ? after : await directoryChain(root);
  if (before.dev !== after.dev || before.ino !== after.ino || before.dev !== canonical.dev || before.ino !== canonical.ino) throw new Error('PLAN_UNSAFE_ROOT');
  return root;
}
/** Read-only: no lock, staging directory, report, or other file is created. */
export async function createFilePlan(inputRoot, entries) {
  const root = await checkedRoot(inputRoot);
  if (!Array.isArray(entries)) throw new Error('PLAN_INVALID_ENTRIES');
  const seen = new Set(); const changes = [];
  for (const entry of entries) {
    if (!entry || (typeof entry.content !== 'string' && entry.content !== null)) throw new Error('PLAN_INVALID_CONTENT');
    relativePath(entry.path);
    const identity = entry.path.toLowerCase();
    if (seen.has(identity)) throw new Error(`PLAN_DUPLICATE_PATH: ${entry.path}`);
    seen.add(identity);
    const original = await inspect(root, entry.path);
    const beforeHash = original.bytes === null ? null : hash(original.bytes);
    const afterHash = entry.content === null ? null : hash(entry.content);
    const status = beforeHash === afterHash ? 'unchanged' : beforeHash === null ? 'create' : afterHash === null ? 'delete' : 'update';
    changes.push(Object.freeze({ path: entry.path, beforeHash, afterHash, content: entry.content, status }));
  }
  return Object.freeze({ version: 1, root, changes: Object.freeze(changes) });
}
async function precondition(root, change) {
  const current = await inspect(root, change.path);
  if ((current.bytes === null ? null : hash(current.bytes)) !== change.beforeHash) throw new Error(`PLAN_STALE: ${change.path}`);
  return current;
}
function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.changes)) throw new Error('PLAN_INVALID');
  const seen = new Set();
  for (const change of plan.changes) {
    relativePath(change.path);
    if (seen.has(change.path.toLowerCase())) throw new Error('PLAN_DUPLICATE_PATH');
    seen.add(change.path.toLowerCase());
    if (typeof change.content !== 'string' && change.content !== null) throw new Error('PLAN_INVALID_CONTENT');
    if (change.beforeHash !== null && !/^[a-f0-9]{64}$/.test(change.beforeHash)) throw new Error('PLAN_INVALID_HASH');
    if (change.afterHash !== (change.content === null ? null : hash(change.content))) throw new Error('PLAN_INVALID_HASH');
    const status = change.beforeHash === change.afterHash ? 'unchanged' : change.beforeHash === null ? 'create' : change.afterHash === null ? 'delete' : 'update';
    if (change.status !== status) throw new Error('PLAN_INVALID_STATUS');
  }
}
/** Cooperating tools share one lock. External editors are protected by per-write hash checks,
 * not a claim of a filesystem-wide transaction or compare-and-swap primitive. */
export async function applyFilePlan(plan, { beforeWrite } = {}) {
  plan = Object.freeze({ version: plan?.version, root: plan?.root, changes: Array.isArray(plan?.changes)
    ? Object.freeze(plan.changes.map(change => Object.freeze({ path: change.path, beforeHash: change.beforeHash, afterHash: change.afterHash, content: change.content, status: change.status }))) : undefined });
  validatePlan(plan);
  const root = await checkedRoot(plan.root); const lock = join(root, '.codex-authoring.lock');
  await mkdir(lock).catch(error => { if (error.code === 'EEXIST') throw new Error('PLAN_LOCKED: another authoring operation or unresolved recovery owns .codex-authoring.lock'); throw error; });
  const report = { status: 'applied', written: [], unchanged: [], rolledBack: [], preserved: [], remaining: [] };
  const applied = []; const originals = new Map();
  let retain = false;
  try {
    for (const [index, change] of plan.changes.entries()) {
      const original = await precondition(root, change); originals.set(change.path, original.bytes);
      if (original.bytes !== null) await writeFile(join(lock, `before-${index}`), original.bytes, { flag: 'wx' });
      if (change.content !== null) await writeFile(join(lock, `after-${index}`), change.content, { flag: 'wx' });
    }
    for (const [index, change] of plan.changes.entries()) {
      if (change.status === 'unchanged') { report.unchanged.push(change.path); continue; }
      await beforeWrite?.(change, index);
      const destination = await precondition(root, change);
      const parent = resolve(destination.path, '..');
      const contained = relative(root, parent);
      if (contained.startsWith('..') || isAbsolute(contained)) throw new Error('PLAN_UNSAFE_PATH');
      await mkdir(parent, { recursive: true });
      await precondition(root, change);
      if (change.status === 'create') await copyFile(join(lock, `after-${index}`), destination.path, constants.COPYFILE_EXCL);
      else if (change.status === 'delete') await unlink(destination.path);
      else await rename(join(lock, `after-${index}`), destination.path);
      applied.push(change); report.written.push(change.path);
    }
    return report;
  } catch (error) {
    report.status = 'failed';
    for (const change of applied.toReversed()) {
      try {
        const current = await inspect(root, change.path);
        if ((current.bytes === null ? null : hash(current.bytes)) !== change.afterHash) { report.preserved.push(change.path); retain = true; continue; }
        const original = originals.get(change.path);
        if (original === null) await unlink(current.path);
        else await writeFile(current.path, original, { flag: change.status === 'delete' ? 'wx' : 'w' });
        report.rolledBack.push(change.path);
      } catch { report.remaining.push(change.path); retain = true; }
    }
    if (retain) {
      report.recoveryPath = lock;
      await writeFile(join(lock, 'recovery.json'), JSON.stringify(report, null, 2)).catch(() => undefined);
    }
    const failure = new Error(error instanceof Error ? error.message : String(error), { cause: error });
    failure.report = report;
    throw failure;
  } finally { if (!retain) await rm(lock, { recursive: true, force: true }); }
}
