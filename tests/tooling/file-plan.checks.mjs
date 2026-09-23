import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, readdir, rm, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
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
    assert.equal(error.message, 'non-Error failure'); assert.deepEqual(error.report.preserved, ['a.txt']); assert.equal(error.report.recoveryPath, join(root, '.codex-authoring.lock')); return true;
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
