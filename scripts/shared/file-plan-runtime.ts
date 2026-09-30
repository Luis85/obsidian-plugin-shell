import { constants, type BigIntStats, type Stats } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { mapBounded } from './bounded-map.ts';
import { sha256 } from './hash.ts';
import type {
  ApplyFilePlanOptions,
  ApplyFilePlanReport,
  FilePlan,
  FilePlanChange,
  FilePlanEntry,
  FilePlanStatus,
} from './file-plan-types.ts';

type EntryShape = {
  path?: unknown;
  content?: unknown;
  encoding?: unknown;
  beforeHash?: unknown;
  afterHash?: unknown;
  status?: unknown;
};
type PlanShape = { version?: unknown; root?: unknown; changes?: unknown };
type InspectedFile = { path: string; bytes: Buffer | null };
type PlanFailure = Error & { report: ApplyFilePlanReport };

const protectedRoots = new Set([
  '.git', 'node_modules', '.worktrees', '.qualification', '.dev-vault',
  '.native-runner', '.codex-authoring.lock', '.shell-first-run.lock',
]);
const hash = (value: string | Uint8Array): string => sha256(value);

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function contentBytes(entry: EntryShape): string | Buffer | null {
  if (entry.encoding !== undefined && entry.encoding !== 'base64') throw new Error('PLAN_INVALID_ENCODING');
  if (entry.content === null) {
    if (entry.encoding) throw new Error('PLAN_INVALID_ENCODING');
    return null;
  }
  if (typeof entry.content !== 'string') throw new Error('PLAN_INVALID_CONTENT');
  if (!entry.encoding) return entry.content;
  const decoded = Buffer.from(entry.content, 'base64');
  if (decoded.toString('base64') !== entry.content) throw new Error('PLAN_INVALID_BASE64');
  return decoded;
}

function relativePath(path: unknown): string[] {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\')) throw new Error('PLAN_UNSAFE_PATH');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[<>:"|?*\u0000-\u001f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('PLAN_UNSAFE_PATH');
  if (protectedRoots.has(parts[0]!.toLowerCase())) throw new Error('PLAN_PROTECTED_PATH');
  return parts;
}

function captureEntry(value: unknown): FilePlanEntry {
  if (!value || typeof value !== 'object') throw new Error('PLAN_INVALID_CONTENT');
  const raw = value as EntryShape;
  contentBytes(raw);
  relativePath(raw.path);
  return {
    path: raw.path as string,
    content: raw.content as string | null,
    ...(raw.encoding !== undefined ? { encoding: raw.encoding as 'base64' } : {}),
  };
}

async function inspect(root: string, path: string): Promise<InspectedFile> {
  const parts = relativePath(path);
  let parent = root;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;
    const names = await readdir(parent);
    const matching = names.find(name => name.toLowerCase() === part.toLowerCase());
    if (matching && matching !== part) throw new Error(`PLAN_CASE_COLLISION: ${path}`);
    const current = join(parent, part);
    let entry: Stats;
    try { entry = await lstat(current); }
    catch (error) {
      if (errorCode(error) === 'ENOENT') return { path: join(root, ...parts), bytes: null };
      throw error;
    }
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

async function directoryChain(root: string): Promise<BigIntStats> {
  const ancestors: string[] = [];
  for (let path = root; ; path = dirname(path)) {
    ancestors.push(path);
    if (dirname(path) === path) break;
  }
  let identity: BigIntStats | undefined;
  for (const path of [...ancestors].reverse()) {
    const entry = await lstat(path, { bigint: true });
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('PLAN_UNSAFE_ROOT');
    identity = entry;
  }
  if (!identity) throw new Error('PLAN_UNSAFE_ROOT');
  return identity;
}

async function checkedRoot(input: string): Promise<string> {
  const requested = resolve(input);
  const before = await directoryChain(requested);
  const root = await realpath(requested);
  const after = await directoryChain(requested);
  const canonical = root === requested ? after : await directoryChain(root);
  if (before.dev !== after.dev || before.ino !== after.ino || before.dev !== canonical.dev || before.ino !== canonical.ino) {
    throw new Error('PLAN_UNSAFE_ROOT');
  }
  return root;
}

/** Read-only: no lock, staging directory, report, or other file is created. */
export async function createFilePlanRuntime(inputRoot: string, entries: unknown): Promise<FilePlan> {
  if (!Array.isArray(entries)) throw new Error('PLAN_INVALID_ENTRIES');
  const seen = new Set<string>();
  const captured = entries.map(captureEntry);
  for (const entry of captured) {
    const identity = entry.path.toLowerCase();
    if (seen.has(identity)) throw new Error(`PLAN_DUPLICATE_PATH: ${entry.path}`);
    seen.add(identity);
  }
  const root = await checkedRoot(inputRoot);
  const changes = await mapBounded(captured, 8, async (entry): Promise<Readonly<FilePlanChange>> => {
    const bytes = contentBytes(entry);
    const original = await inspect(root, entry.path);
    const beforeHash = original.bytes === null ? null : hash(original.bytes);
    const afterHash = bytes === null ? null : hash(bytes);
    const status: FilePlanStatus = beforeHash === afterHash ? 'unchanged'
      : beforeHash === null ? 'create'
      : afterHash === null ? 'delete'
      : 'update';
    return Object.freeze({
      path: entry.path,
      beforeHash,
      afterHash,
      content: entry.content,
      ...(entry.encoding ? { encoding: entry.encoding } : {}),
      status,
    });
  });
  return Object.freeze({ version: 1 as const, root, changes: Object.freeze(changes) });
}

async function precondition(root: string, change: Readonly<FilePlanChange>): Promise<InspectedFile> {
  const current = await inspect(root, change.path);
  if ((current.bytes === null ? null : hash(current.bytes)) !== change.beforeHash) throw new Error(`PLAN_STALE: ${change.path}`);
  return current;
}

function normalizePlan(plan: unknown): Readonly<PlanShape> {
  const source = plan && typeof plan === 'object' ? plan as PlanShape : undefined;
  const changes = Array.isArray(source?.changes)
    ? Object.freeze(source.changes.map(raw => {
        const change = raw as Record<string, unknown>;
        return Object.freeze({
          path: change.path,
          beforeHash: change.beforeHash,
          afterHash: change.afterHash,
          content: change.content,
          ...(change.encoding ? { encoding: change.encoding } : {}),
          status: change.status,
        });
      }))
    : undefined;
  return Object.freeze({ version: source?.version, root: source?.root, changes });
}

function validatePlan(plan: Readonly<PlanShape>): void {
  if (plan.version !== 1 || !Array.isArray(plan.changes)) throw new Error('PLAN_INVALID');
  const seen = new Set<string>();
  for (const raw of plan.changes) {
    if (!raw || typeof raw !== 'object') throw new Error('PLAN_INVALID');
    const change = raw as EntryShape;
    relativePath(change.path);
    const path = change.path as string;
    if (seen.has(path.toLowerCase())) throw new Error('PLAN_DUPLICATE_PATH');
    seen.add(path.toLowerCase());
    const bytes = contentBytes(change);
    if (change.beforeHash !== null && (typeof change.beforeHash !== 'string' || !/^[a-f0-9]{64}$/.test(change.beforeHash))) throw new Error('PLAN_INVALID_HASH');
    if (change.afterHash !== (bytes === null ? null : hash(bytes))) throw new Error('PLAN_INVALID_HASH');
    const status: FilePlanStatus = change.beforeHash === change.afterHash ? 'unchanged'
      : change.beforeHash === null ? 'create'
      : change.afterHash === null ? 'delete'
      : 'update';
    if (change.status !== status) throw new Error('PLAN_INVALID_STATUS');
  }
}

/** Cooperating tools share one lock. External editors are protected by per-write hash checks,
 * not a claim of a filesystem-wide transaction or compare-and-swap primitive. */
export async function applyFilePlanRuntime(plan: unknown, options: ApplyFilePlanOptions = {}): Promise<ApplyFilePlanReport> {
  const normalized = normalizePlan(plan);
  validatePlan(normalized);
  const typedPlan = normalized as unknown as FilePlan;
  const root = await checkedRoot(typedPlan.root);
  const lock = join(root, '.codex-authoring.lock');
  await mkdir(lock).catch((error: unknown) => {
    if (errorCode(error) === 'EEXIST') throw new Error('PLAN_LOCKED: another authoring operation or unresolved recovery owns .codex-authoring.lock');
    throw error;
  });
  const report: ApplyFilePlanReport = {
    status: 'applied', written: [], unchanged: [], rolledBack: [], preserved: [], remaining: [],
  };
  const applied: Readonly<FilePlanChange>[] = [];
  const originals = new Map<string, Buffer | null>();
  let retain = false;
  try {
    const checked = await mapBounded(typedPlan.changes, 8, change => precondition(root, change));
    for (const [index, change] of typedPlan.changes.entries()) {
      if (change.status === 'unchanged') continue;
      const original = checked[index]!;
      originals.set(change.path, original.bytes);
      if (original.bytes !== null) await writeFile(join(lock, `before-${index}`), original.bytes, { flag: 'wx' });
      if (change.content !== null) {
        await writeFile(join(lock, `after-${index}`), contentBytes(change) as string | Uint8Array, { flag: 'wx' });
      }
    }
    for (const [index, change] of typedPlan.changes.entries()) {
      if (change.status === 'unchanged') { report.unchanged.push(change.path); continue; }
      await options.beforeWrite?.(change, index);
      const destination = await precondition(root, change);
      const parent = resolve(destination.path, '..');
      const contained = relative(root, parent);
      if (contained.startsWith('..') || isAbsolute(contained)) throw new Error('PLAN_UNSAFE_PATH');
      await mkdir(parent, { recursive: true });
      await precondition(root, change);
      if (change.status === 'create') await copyFile(join(lock, `after-${index}`), destination.path, constants.COPYFILE_EXCL);
      else if (change.status === 'delete') await unlink(destination.path);
      else await rename(join(lock, `after-${index}`), destination.path);
      applied.push(change);
      report.written.push(change.path);
    }
    return report;
  } catch (error) {
    report.status = 'failed';
    for (const change of [...applied].reverse()) {
      try {
        const current = await inspect(root, change.path);
        if ((current.bytes === null ? null : hash(current.bytes)) !== change.afterHash) {
          report.preserved.push(change.path); retain = true; continue;
        }
        const original = originals.get(change.path);
        if (original === undefined) throw new Error('PLAN_ROLLBACK_STATE');
        if (original === null) await unlink(current.path);
        else await writeFile(current.path, original, { flag: change.status === 'delete' ? 'wx' : 'w' });
        report.rolledBack.push(change.path);
      } catch {
        report.remaining.push(change.path); retain = true;
      }
    }
    if (retain) {
      report.recoveryPath = lock;
      await writeFile(join(lock, 'recovery.json'), JSON.stringify(report, null, 2)).catch(() => undefined);
    }
    const failure = new Error(error instanceof Error ? error.message : String(error), { cause: error }) as PlanFailure;
    failure.report = report;
    throw failure;
  } finally {
    if (!retain) await rm(lock, { recursive: true, force: true });
  }
}
