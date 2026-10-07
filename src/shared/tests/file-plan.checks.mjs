import { test } from 'node:test';
import { mapBounded } from '../platform/bounded-map.ts';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, readdir, rm, symlink, access, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilePlan, applyFilePlan } from '../platform/file-plan.ts';
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'template-file-plan-'));
  try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}
test('[PLAN-03-01] read-only planning and exact unchanged replay preserve original files', () => fixture(async root => {
  await writeFile(join(root, 'existing.txt'), 'before');
  const plan = await createFilePlan(root, [{ path: 'existing.txt', content: 'after' }, { path: 'nested/new.txt', content: 'new' }]);
  assert.deepEqual(await readdir(root), ['existing.txt']);
  assert.equal(await readFile(join(root, 'existing.txt'), 'utf8'), 'before');
  assert.deepEqual(plan.changes.map(change => change.status), ['update', 'create']);
  const applied = await applyFilePlan(plan); assert.deepEqual(applied.written, ['existing.txt', 'nested/new.txt']);
  const replay = await createFilePlan(root, plan.changes); assert.ok(replay.changes.every(change => change.status === 'unchanged'));
  assert.deepEqual((await applyFilePlan(replay)).written, []);
  await assert.rejects(access(join(root, '.codex-authoring.lock')));
}));
test('[PLAN-03-02] traversal, reserved, protected, case and symlink destinations are rejected', () => fixture(async root => {
  for (const path of ['../outside', '/absolute', 'C:/drive', 'a\\b', 'a//b', 'CON.txt', 'a/..', '.git/config', 'node_modules/file', '.dev-vault/note.md', 'trailing.']) await assert.rejects(createFilePlan(root, [{ path, content: 'x' }]));
  await writeFile(join(root, 'Original.txt'), 'original');
  await assert.rejects(createFilePlan(root, [{ path: 'original.txt', content: 'x' }]), /CASE_COLLISION/);
  await mkdir(join(root, 'target')); await symlink(join(root, 'target'), join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createFilePlan(root, [{ path: 'link/file.txt', content: 'x' }]), /SYMLINK/);
  await assert.rejects(createFilePlan(root, [{ path: 'target', content: 'x' }]), /FILE_CONFLICT/);
  await assert.rejects(createFilePlan(root, [{ path: 'Original.txt/child', content: 'x' }]), /PARENT_CONFLICT/);
  await assert.rejects(createFilePlan(root, [{ path: 'same', content: 'x' }, { path: 'Same', content: 'x' }]), /DUPLICATE/);
}));
test('[PLAN-03-03] stale plans and shared lock conflicts never clobber concurrent edits', () => fixture(async root => {
  await writeFile(join(root, 'file.txt'), 'before');
  const plan = await createFilePlan(root, [{ path: 'file.txt', content: 'generated' }]);
  await writeFile(join(root, 'file.txt'), 'user edit');
  await assert.rejects(applyFilePlan(plan), /PLAN_STALE/);
  assert.equal(await readFile(join(root, 'file.txt'), 'utf8'), 'user edit');
  await mkdir(join(root, '.codex-authoring.lock'));
  await assert.rejects(applyFilePlan(plan), /PLAN_LOCKED/);
}));
test('[PLAN-03-04] rollback restores only owned bytes; a concurrent edit survives with recovery', () => fixture(async root => {
  await writeFile(join(root, 'a.txt'), 'original');
  const plan = await createFilePlan(root, [{ path: 'a.txt', content: 'generated' }, { path: 'b.txt', content: 'second' }]);
  await assert.rejects(applyFilePlan(plan, { beforeWrite(_change, index) { if (index === 1) throw new Error('injected failure'); } }), error => {
    assert.deepEqual(error.report.rolledBack, ['a.txt']); assert.deepEqual(error.report.preserved, []); return true;
  });
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'original');
  await assert.rejects(applyFilePlan(plan, { async beforeWrite(_change, index) { if (index === 1) { await writeFile(join(root, 'a.txt'), 'concurrent edit'); throw 'non-Error failure'; } } }), error => {
    assert.equal(error.message, 'non-Error failure'); assert.deepEqual(error.report.preserved, ['a.txt']); assert.equal(error.report.recoveryPath, join(plan.root, '.codex-authoring.lock')); return true;
  });
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'concurrent edit');
  assert.equal(JSON.parse(await readFile(join(root, '.codex-authoring.lock/recovery.json'), 'utf8')).status, 'failed');
}));
test('[PLAN-03-05] mutable external plans cannot alter validated staged writes', () => fixture(async root => {
  const original = await createFilePlan(root, [{ path: 'safe.txt', content: 'safe' }]);
  const mutable = structuredClone(original);
  await applyFilePlan(mutable, { beforeWrite() { mutable.changes[0].path = '../escape'; mutable.changes[0].content = 'changed'; } });
  assert.equal(await readFile(join(root, 'safe.txt'), 'utf8'), 'safe');
  await assert.rejects(applyFilePlan({ ...original, changes: [{ ...original.changes[0], afterHash: 'invalid' }] }), /INVALID_HASH/);
}));
test('[PLAN-03-06] deletion plans and failed new-file writes retain recoverable ownership', () => fixture(async root => {
  await writeFile(join(root, 'delete.txt'), 'keep on rollback');
  const plan = await createFilePlan(root, [{ path: 'delete.txt', content: null }, { path: 'later.txt', content: 'x' }]);
  await assert.rejects(applyFilePlan(plan, { beforeWrite(_change, index) { if (index === 1) throw new Error('stop'); } }));
  assert.equal(await readFile(join(root, 'delete.txt'), 'utf8'), 'keep on rollback');
  const newFiles = await createFilePlan(root, [{ path: 'a.txt', content: 'first' }, { path: 'b.txt', content: 'second' }]);
  await assert.rejects(applyFilePlan(newFiles, { beforeWrite(_change, index) { if (index === 1) throw new Error('stop'); } }));
  await assert.rejects(access(join(root, 'a.txt')));
}));

test('[PLAN-03-07] root and ancestor directory links cannot be normalized into trusted roots', () => fixture(async root => {
  const target = join(root, 'real'); await mkdir(join(target, 'repository'), { recursive: true });
  const link = join(root, 'redirect'); await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createFilePlan(link, [{ path: 'outside.txt', content: 'never' }]), /PLAN_UNSAFE_ROOT/);
  await assert.rejects(createFilePlan(join(link, 'repository'), [{ path: 'outside.txt', content: 'never' }]), /PLAN_UNSAFE_ROOT/);
  await assert.rejects(access(join(target, 'outside.txt'))); await assert.rejects(access(join(target, 'repository/outside.txt')));
}));

test('[PLAN-03-08] apply rejects an ancestor replaced by a junction after review', () => fixture(async root => {
  const parent = join(root, 'parent'); const repository = join(parent, 'repository'); await mkdir(repository, { recursive: true });
  const plan = await createFilePlan(repository, [{ path: 'new.txt', content: 'never' }]);
  const moved = join(root, 'moved'); await rename(parent, moved);
  await symlink(moved, parent, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(applyFilePlan(plan), /PLAN_UNSAFE_ROOT/);
  await assert.rejects(access(join(moved, 'repository/new.txt')));
}));


test('unchanged preimages are checked but never staged as redundant backups', () => fixture(async root => {
  const entries = Array.from({ length: 32 }, (_, i) => ({ path: `same-${i}.txt`, content: `keep ${i}` }));
  for (const entry of entries) await writeFile(join(root, entry.path), entry.content);
  await writeFile(join(root, 'change.txt'), 'before');
  entries.push({ path: 'absent.txt', content: null }, { path: 'change.txt', content: 'after' });
  const plan = await createFilePlan(root, entries); let observed = false;
  const report = await applyFilePlan(plan, { async beforeWrite(change, index) {
    observed = true; assert.equal(change.path, 'change.txt'); assert.equal(index, 33);
    assert.deepEqual((await readdir(join(root, '.codex-authoring.lock'))).sort(), ['after-33', 'before-33']);
    assert.equal(await readFile(join(root, '.codex-authoring.lock/before-33'), 'utf8'), 'before');
  } });
  assert.equal(observed, true); assert.equal(report.unchanged.length, 33);
  assert.deepEqual(report.written, ['change.txt']);
  // No-op entries remain approval preconditions, not an excuse to ignore edits.
  const stale = await createFilePlan(root, entries);
  await writeFile(join(root, 'same-1.txt'), 'external');
  await assert.rejects(applyFilePlan(stale), /PLAN_STALE/);
  assert.equal(await readFile(join(root, 'same-1.txt'), 'utf8'), 'external');
  await assert.rejects(access(join(root, '.codex-authoring.lock')));
}));

test('planning snapshots mutable inputs before asynchronous reads and preserves input order', () => fixture(async root => {
  const entries = [{ path: 'safe.txt', content: 'safe' }];
  const pending = createFilePlan(root, entries);
  entries[0].path = '../escape'; entries[0].content = 'changed'; entries.push({ path: 'extra.txt', content: 'extra' });
  const plan = await pending; assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].path, 'safe.txt'); assert.equal(plan.changes[0].content, 'safe');
  for (const encoding of ['', 'hex']) await assert.rejects(createFilePlan(root, [{ path: 'bad', content: '', encoding }]), /PLAN_INVALID_ENCODING/);
  const many = Array.from({ length: 40 }, (_, i) => ({ path: `nested/${40-i}.txt`, content: String(i) }));
  assert.deepEqual((await createFilePlan(root, many)).changes.map(c => c.path), many.map(c => c.path));
}));

test('bounded reads retain result order, reject invalid concurrency and drain failures', async () => {
  const input = [0, 1, 2, 3, 4, 5], released = []; let active = 0, peak = 0;
  const result = await mapBounded(input, 3, async value => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, (6-value)*2));
    active--; return value * 2;
  });
  assert.equal(peak, 3); assert.equal(active, 0); assert.deepEqual(result, input.map(v => v*2));
  let release; const gate = new Promise(resolve => { release = resolve; });
  const failure = new Error('read failed'); let settled = false;
  const work = mapBounded(input, 2, async value => {
    if (value === 0) throw failure;
    await gate; released.push(value); return value;
  });
  work.catch(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
  release(); await assert.rejects(work, error => error === failure);
  assert.deepEqual(released, [1]); assert.equal(settled, true);
  for (const value of [0, -1, 1.5, Infinity]) await assert.rejects(mapBounded([], value, async v => v), /INVALID_CONCURRENCY/);
  assert.deepEqual(await mapBounded([], 2, async v => v), []);
});
