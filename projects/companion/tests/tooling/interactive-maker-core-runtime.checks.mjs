import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { resultEnvelope } from '../../scripts/contracts/result-runtime.mjs';
import { OperationError, requireThat } from '../../scripts/contracts/errors.ts';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { mapBounded } from '../../scripts/shared/bounded-map.ts';
import { NodeProcessFailure, runNodeProcess } from '../../scripts/shared/process.ts';

async function scratch() {
  return realpath(await mkdtemp(join(tmpdir(), 'maker-core-runtime-')));
}

test('maker core runtime covers result and error contracts', () => {
  assert.deepEqual(resultEnvelope('core', { ready: true }, 'planned', [{ code: 'INFO', message: 'planned' }]), {
    protocolVersion: 1, command: 'core', status: 'planned', data: { ready: true },
    diagnostics: [{ code: 'INFO', message: 'planned' }],
  });
  requireThat(true, 'UNUSED', 'not thrown');
  assert.throws(() => requireThat(false, 'CORE_REFUSAL', 'refused'), error => {
    assert.ok(error instanceof OperationError); assert.equal(error.code, 'CORE_REFUSAL'); return true;
  });
});

test('maker core runtime covers bounded scheduling and refusal', async () => {
  assert.deepEqual(await mapBounded([3, 1, 2], 2, async value => value * 2), [6, 2, 4]);
  const started = [];
  await assert.rejects(() => mapBounded([1, 2, 3], 1, async value => {
    started.push(value); if (value === 2) throw new Error('stop'); return value;
  }), /stop/);
  assert.deepEqual(started, [1, 2]);
  await assert.rejects(() => mapBounded([1], 0, async value => value), /INVALID_CONCURRENCY/);
});

test('maker core runtime covers file-plan create update delete binary stale and rollback paths', async () => {
  const root = await scratch();
  try {
    const created = await createFilePlan(root, [{ path: 'note.txt', content: 'one\n' }]);
    assert.equal(created.changes[0].status, 'create');
    assert.deepEqual((await applyFilePlan(created)).written, ['note.txt']);

    const unchanged = await createFilePlan(root, [{ path: 'note.txt', content: 'one\n' }]);
    assert.equal(unchanged.changes[0].status, 'unchanged');
    assert.deepEqual((await applyFilePlan(unchanged)).unchanged, ['note.txt']);

    const updated = await createFilePlan(root, [{ path: 'note.txt', content: 'two\n' }]);
    assert.equal(updated.changes[0].status, 'update');
    await applyFilePlan(updated);
    assert.equal(await readFile(join(root, 'note.txt'), 'utf8'), 'two\n');

    const binary = Buffer.from([0, 1, 2, 255]);
    await applyFilePlan(await createFilePlan(root, [{ path: 'bytes.bin', content: binary.toString('base64'), encoding: 'base64' }]));
    assert.deepEqual(await readFile(join(root, 'bytes.bin')), binary);

    const deleted = await createFilePlan(root, [{ path: 'note.txt', content: null }]);
    assert.equal(deleted.changes[0].status, 'delete');
    await applyFilePlan(deleted);
    await assert.rejects(readFile(join(root, 'note.txt')), error => error.code === 'ENOENT');

    await assert.rejects(() => createFilePlan(root, [{ path: '../escape.txt', content: 'x' }]), /PLAN_UNSAFE_PATH/);
    await assert.rejects(() => createFilePlan(root, [{ path: 'bad.bin', content: '***', encoding: 'base64' }]), /PLAN_INVALID_BASE64/);
    await assert.rejects(() => createFilePlan(root, [{ path: 'dup.txt', content: 'a' }, { path: 'DUP.txt', content: 'b' }]), /PLAN_DUPLICATE_PATH/);

    await writeFile(join(root, 'stale.txt'), 'before\n');
    const stale = await createFilePlan(root, [{ path: 'stale.txt', content: 'planned\n' }]);
    await writeFile(join(root, 'stale.txt'), 'external\n');
    await assert.rejects(() => applyFilePlan(stale), /PLAN_STALE/);
    assert.equal(await readFile(join(root, 'stale.txt'), 'utf8'), 'external\n');

    await writeFile(join(root, 'rollback.txt'), 'before\n');
    const rollback = await createFilePlan(root, [
      { path: 'rollback.txt', content: 'after\n' },
      { path: 'second.txt', content: 'second\n' },
    ]);
    await assert.rejects(() => applyFilePlan(rollback, {
      beforeWrite: (_change, index) => { if (index === 1) throw new Error('interrupt'); },
    }), error => {
      assert.equal(error.report.status, 'failed');
      assert.deepEqual(error.report.rolledBack, ['rollback.txt']);
      return true;
    });
    assert.equal(await readFile(join(root, 'rollback.txt'), 'utf8'), 'before\n');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('maker core runtime covers shared Node process success exit timeout abort and output limits', async () => {
  const root = await scratch();
  try {
    const child = join(root, 'child.mjs');
    await writeFile(child, `
      const mode = process.argv[2];
      if (mode === 'ok') process.stdout.write('ok');
      else if (mode === 'fail') { process.stdout.write('bad'); process.exitCode = 7; }
      else if (mode === 'spam') process.stdout.write('x'.repeat(200));
      else if (mode === 'progress') { process.stdout.write('progress'); setInterval(() => {}, 1000); }
      else if (mode === 'hang') setInterval(() => {}, 1000);
    `);

    const ok = await runNodeProcess(child, ['ok'], { captureOutput: true, timeoutMs: 5000 });
    assert.equal(ok.stdout, 'ok'); assert.equal(ok.exitCode, 0);

    await assert.rejects(() => runNodeProcess(child, ['fail'], { captureOutput: true, timeoutMs: 5000 }), error => {
      assert.ok(error instanceof NodeProcessFailure); assert.equal(error.kind, 'exit'); assert.equal(error.exitCode, 7); return true;
    });

    const spam = await runNodeProcess(child, ['spam'], { captureOutput: true, outputLimit: 20, timeoutMs: 5000 });
    assert.equal(spam.truncated, true); assert.ok(spam.stdout.length <= 20);

    await assert.rejects(() => runNodeProcess(child, ['hang'], { captureOutput: true, timeoutMs: 50 }), error => {
      assert.ok(error instanceof NodeProcessFailure); assert.equal(error.kind, 'timeout'); return true;
    });

    const controller = new AbortController(); controller.abort();
    await assert.rejects(() => runNodeProcess(child, ['hang'], { captureOutput: true, abortSignal: controller.signal, timeoutMs: 5000 }), error => {
      assert.ok(error instanceof NodeProcessFailure); assert.equal(error.kind, 'cancelled'); return true;
    });

    await assert.rejects(() => runNodeProcess(child, ['progress'], {
      captureOutput: true, timeoutMs: 5000, onOutput: () => { throw new Error('consumer failed'); },
    }), error => {
      assert.ok(error instanceof NodeProcessFailure); assert.equal(error.kind, 'progress'); return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
