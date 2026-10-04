/** Scoped .test-vault writer. Preview and approval are separate; foreign/edited files fail closed. */
import { lstat, readFile, mkdir, writeFile, rename, unlink, rmdir, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createFixtureEngine } from './engine.mjs';
const receiptName = '.shell-fixtures.json', lockName = '.shell-fixtures-lock';
const digest = value => createHash('sha256').update(value).digest('hex');
async function stat(path) { try { return await lstat(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function safePath(path) {
  if (typeof path !== 'string' || path.length > 240 || /[\\:\x00-\x1f]/.test(path)) return false;
  const parts = path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return false;
  if (parts[0] === '.fixtures') return parts.length === 3 && /^[a-z][a-z0-9-]{0,59}$/.test(parts[1]) && /^[a-z][a-z0-9-]{0,59}-(input|output)\.json$/.test(parts[2]);
  return parts.length > 1 && parts.slice(0, -1).every(p => /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(p)) && /^fixture-[a-z0-9-]+-\d{4}\.md$/.test(parts.at(-1));
}
async function targetRoot(root) {
  root = resolve(root);
  // Inspect every component: a realpath string comparison mistakes Windows 8.3 and drive-letter aliases for links.
  for (let path = root; ; path = dirname(path)) {
    if ((await stat(path))?.isSymbolicLink()) throw new Error('Project root must be a real, non-symlink directory.');
    if (dirname(path) === path) break;
  }
  if (!(await stat(root))?.isDirectory()) throw new Error('Project root must be a real, non-symlink directory.');
  return join(root, '.test-vault');
}
async function checked(root, relative) {
  const allowed = relative === receiptName || safePath(relative);
  if (!allowed) throw new Error('Target is outside the reserved test-fixture paths.');
  const target = await targetRoot(root), parts = ['.test-vault', ...relative.split('/')]; let path = resolve(root);
  for (const [index, part] of parts.entries()) {
    const parentStat = await stat(path);
    if (parentStat) {
      const match = (await readdir(path)).find(name => name.toLowerCase() === part.toLowerCase() && name !== part);
      if (match) throw new Error('Case-insensitive fixture path collision.');
    }
    path = join(path, part); const entry = await stat(path), last = index === parts.length - 1;
    if (entry?.isSymbolicLink() || entry && (last ? !entry.isFile() || entry.nlink !== 1 : !entry.isDirectory())) throw new Error('Symlink, hardlink or nonregular fixture target.');
  }
  return { path, target };
}
async function read(root, path) {
  const target = await checked(root, path);
  const info = await stat(target.path); if (!info) return null;
  if (info.size > 5000000) throw new Error('Existing test fixture exceeds the 5 MB safety bound.');
  return readFile(target.path);
}
async function receipt(root) {
  const raw = await read(root, receiptName); if (!raw) return { raw: null, files: {} };
  const value = JSON.parse(raw.toString('utf8'));
  if (value?.schema !== 1 || value.target !== '.test-vault' || !value.files || Array.isArray(value.files) || Object.keys(value.files).length > 3000) throw new Error('Invalid ownership receipt; no files changed.');
  if (!Object.entries(value.files).every(([p, h]) => safePath(p) && /^[0-9a-f]{64}$/.test(h))) throw new Error('Unsafe ownership receipt; no files changed.');
  const folded = Object.keys(value.files).map(p => p.toLowerCase());
  if (new Set(folded).size !== folded.length) throw new Error('Ambiguous ownership receipt.');
  return { raw, files: value.files };
}
export async function planFixtures(root, manifest, { reset = false, ignoreLock = false, ...options } = {}) {
  const engine = createFixtureEngine(); engine.validate(manifest);
  const target = await targetRoot(root), entry = await stat(target);
  if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) throw new Error('The test vault is not a safe directory.');
  if (!ignoreLock && await stat(join(target, lockName))) throw new Error('A fixture operation or recovery is already in progress.');
  const retained = await receipt(root), output = reset ? { files: [], bytes: 0, provider: 'reset' } : engine.generate(manifest, options);
  const desired = new Map(output.files.map(f => [f.path, f.content])), paths = [...new Set([...desired.keys(), ...Object.keys(retained.files)])].sort();
  const changes = [];
  for (const path of paths) {
    const current = await read(root, path), before = current === null ? null : digest(current), after = desired.has(path) ? digest(desired.get(path)) : null;
    let status = 'retain';
    if (reset) status = before === null ? 'absent' : retained.files[path] === before ? 'remove' : 'conflict';
    else if (desired.has(path)) status = before === null ? 'create' : retained.files[path] !== before ? 'conflict' : after === before ? 'unchanged' : 'update';
    changes.push({ path, before, after, status });
  }
  const identity = { schema: 1, mode: reset ? 'reset' : 'seed', target: '.test-vault', manifest, provider: output.provider, receipt: retained.raw === null ? null : digest(retained.raw), changes };
  return { target, mode: identity.mode, approval: digest(JSON.stringify(identity)), changes, bytes: output.bytes, blockers: changes.filter(c => c.status === 'conflict').map(c => c.path), desired, retained };
}
async function atomicWrite(root, path, bytes, expected) {
  let target = await checked(root, path);
  await mkdir(dirname(target.path), { recursive: true }); target = await checked(root, path);
  const temp = join(dirname(target.path), '.fixture-stage-' + randomBytes(8).toString('hex'));
  try {
    await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
    const current = await read(root, path);
    if ((current === null ? null : digest(current)) !== expected) throw new Error('Target changed after review; preserving the current file.');
    await checked(root, path); await rename(temp, target.path);
  } finally { if (await stat(temp)) await unlink(temp); }
}
export async function applyFixtures(root, manifest, approval, options = {}) {
  const preview = await planFixtures(root, manifest, options);
  if (preview.approval !== approval) throw new Error('Stale or missing approval. Review a fresh plan.');
  if (preview.blockers.length) throw new Error('Foreign or edited fixtures are preserved. Resolve conflicts before applying.');
  if (preview.mode === 'reset' && preview.retained.raw === null) return { written: 0, unchanged: true };
  await mkdir(preview.target, { recursive: true }); await checked(root, receiptName);
  const lock = join(preview.target, lockName); await mkdir(lock); let preserveLock = false;
  const completed = [], backups = new Map();
  try {
    const plan = await planFixtures(root, manifest, { ...options, ignoreLock: true });
    if (plan.approval !== approval || plan.blockers.length) throw new Error('Test fixtures changed before the lock was acquired.');
    for (const c of plan.changes) {
      if (!['create', 'update', 'remove'].includes(c.status)) continue;
      const current = await read(root, c.path);
      if ((current === null ? null : digest(current)) !== c.before) throw new Error('Fixture changed since the approved plan.');
      backups.set(c.path, current);
      if (c.status === 'remove') await unlink((await checked(root, c.path)).path);
      else await atomicWrite(root, c.path, plan.desired.get(c.path), c.before);
      completed.push(c);
    }
    const files = { ...plan.retained.files };
    for (const c of plan.changes) {
      if (['create', 'update', 'unchanged'].includes(c.status)) files[c.path] = c.after;
      else if (['remove', 'absent'].includes(c.status)) delete files[c.path];
    }
    const beforeReceipt = plan.retained.raw === null ? null : digest(plan.retained.raw);
    if (plan.mode === 'reset') {
      const current = await read(root, receiptName);
      if (current === null || digest(current) !== beforeReceipt) throw new Error('Ownership receipt changed during reset.');
      await unlink((await checked(root, receiptName)).path);
    } else {
      const value = JSON.stringify({ schema: 1, target: '.test-vault', engine: manifest.engine, sourceHash: digest(JSON.stringify(manifest)), files }, null, 2) + '\n';
      if (digest(value) !== beforeReceipt) await atomicWrite(root, receiptName, value, beforeReceipt);
    }
    return { written: completed.length, unchanged: completed.length === 0, retained: plan.changes.filter(c => c.status === 'retain').length };
  } catch (error) {
    const recovery = [];
    for (const c of [...completed].reverse()) {
      try {
        const current = await read(root, c.path), expected = c.status === 'remove' ? null : c.after;
        if ((current === null ? null : digest(current)) !== expected) throw new Error('Edited after write.');
        const previous = backups.get(c.path);
        if (previous === null) await unlink((await checked(root, c.path)).path);
        else await atomicWrite(root, c.path, previous, expected);
      } catch { recovery.push({ path: c.path, previousBase64: backups.get(c.path)?.toString('base64') ?? null }); }
    }
    if (recovery.length) {
      preserveLock = true; await writeFile(join(lock, 'recovery.json'), JSON.stringify(recovery, null, 2), { flag: 'wx', mode: 0o600 });
      throw new Error('Fixture recovery required. Current files preserved; backups retained in the test-vault lock directory.');
    }
    throw error;
  } finally { if (!preserveLock) await rmdir(lock); }
}
