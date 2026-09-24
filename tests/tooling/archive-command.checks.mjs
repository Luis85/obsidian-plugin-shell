import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'archive-command-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parent = join(root, 'scratch'); await mkdir(parent);
  return { parent, outputRoot: join(root, 'receipts') };
}
const read = async path => JSON.parse(await readFile(path, 'utf8'));

test('archive command receipts retain actual timeout metadata before successful scratch cleanup', async t => {
  const options = await fixture(t); let captured;
  await assert.rejects(archiveCommandFixture(context => {
    captured = context;
    context.command(process.execPath, ['-e', 'process.stderr.write("fixture started\\n");setTimeout(()=>{},30000)'], context.scratch,
      process.env, { timeout: 1500 });
  }, options), /ETIMEDOUT/);
  const report = await read(join(captured.output, 'report.json'));
  assert.equal(report.status, 'failed'); assert.equal(report.scratchPreserved, undefined);
  assert.equal(report.workStatus, 'failed'); assert.equal(report.cleanupStatus, 'passed');
  assert.equal(report.bodyCompleted, false);
  assert.deepEqual(report.failures.map(entry => entry.phase), ['work']);
  const start = await read(join(captured.output, report.commands[0].started));
  assert.equal(start.file, process.execPath); assert.equal(start.cwd, captured.scratch);
  assert.equal(start.timeoutMs, 1500); assert.equal(start.maxBufferBytes, 12 * 1024 * 1024);
  const result = await read(join(captured.output, report.commands[0].result));
  assert.equal(result.error.code, 'ETIMEDOUT'); assert.equal(result.status, null);
  assert.match(result.stderr, /fixture started/); assert.ok(result.durationMs >= 1500);
  await assert.rejects(access(captured.scratch), { code: 'ENOENT' });
});

test('archive fixture retains original command failure and independent cleanup error without replacement', async t => {
  const options = await fixture(t); let captured; let primary;
  const cleanupError = Object.assign(new Error('Controlled cleanup refusal'), { code: 'EBUSY' });
  let caught;
  try {
    await archiveCommandFixture(context => {
      captured = context;
      const run = context.command(process.execPath, ['-e', 'process.stdout.write("kept output");process.stderr.write("kept error");process.exitCode=7'], context.scratch, process.env);
      try { assert.equal(run.status, 0, 'Actual controlled command exited 7'); }
      catch (error) { primary = error; throw error; }
    }, { ...options, cleanup: async () => { throw cleanupError; } });
  } catch (error) { caught = error; }
  assert.ok(caught instanceof AggregateError); assert.deepEqual(caught.errors, [primary, cleanupError]);
  const report = await read(join(captured.output, 'report.json'));
  assert.equal(report.status, 'failed'); assert.equal(report.scratchPreserved, true);
  assert.equal(report.workStatus, 'failed'); assert.equal(report.cleanupStatus, 'failed');
  assert.deepEqual(report.failures.map(entry => entry.phase), ['work', 'cleanup']);
  assert.equal(report.failures[1].code, 'EBUSY'); await access(captured.scratch);
  const start = await read(join(captured.output, report.commands[0].started));
  assert.equal(start.timeoutMs, 60000); assert.equal(start.maxBufferBytes, 12 * 1024 * 1024);
  const result = await read(join(captured.output, report.commands[0].result));
  assert.equal(result.status, 7); assert.equal(result.stdout, 'kept output'); assert.equal(result.stderr, 'kept error');
});

test('archive fixture preserves expected nonzero commands and still fails on cleanup alone', async t => {
  const options = await fixture(t); let captured;
  const cleanupError = Object.assign(new Error('Controlled cleanup-only failure'), { code: 'EBUSY' });
  await assert.rejects(archiveCommandFixture(context => {
    captured = context;
    const run = context.command(process.execPath, ['-e', 'process.exitCode=2'], context.scratch, process.env);
    assert.equal(run.status, 2);
  }, { ...options, cleanup: async () => { throw cleanupError; } }), error => error === cleanupError);
  const report = await read(join(captured.output, 'report.json'));
  assert.deepEqual(report.failures.map(entry => entry.phase), ['cleanup']);
  assert.equal(report.workStatus, 'passed'); assert.equal(report.cleanupStatus, 'failed');
  assert.equal(report.bodyCompleted, true);
  assert.equal(report.scratchPreserved, true);
});

test('archive receipt failure retains the actual timed-out command and both errors', async t => {
  const options = await fixture(t); let captured; let caught;
  try {
    await archiveCommandFixture(async context => {
      captured = context;
      await mkdir(join(context.output, '01-result.json'));
      context.command(process.execPath, ['-e', 'process.stdout.write("timeout output");setTimeout(()=>{},30000)'], context.scratch, process.env, { timeout: 1500 });
    }, options);
  } catch (error) { caught = error; }
  assert.ok(caught instanceof AggregateError); assert.equal(caught.errors.length, 2);
  assert.match(caught.errors[0].message, /ETIMEDOUT/);
  assert.equal(caught.errors[1].code, 'EEXIST');
  assert.equal(caught.commandOutcome.result.error.code, 'ETIMEDOUT');
  assert.equal(caught.commandOutcome.result.stdout, 'timeout output');
  const report = await read(join(captured.output, 'report.json'));
  assert.equal(report.bodyCompleted, false); assert.equal(report.cleanupStatus, 'passed');
  assert.equal(report.failures[0].errors.length, 2);
  assert.equal(report.failures[0].commandOutcome.result.error.code, 'ETIMEDOUT');
  await assert.rejects(access(captured.scratch), { code: 'ENOENT' });
});

test('archive reporting initialization failure still cleans the acquired scratch without running the body', async t => {
  const options = await fixture(t); let cleaned; let ran = false;
  await writeFile(options.outputRoot, 'Preserved blocking file');
  await assert.rejects(archiveCommandFixture(() => { ran = true; }, { ...options,
    cleanup: async path => { cleaned = path; await rm(path, { recursive: true, force: true }); },
  }));
  assert.equal(ran, false); assert.ok(cleaned);
  await assert.rejects(access(cleaned), { code: 'ENOENT' });
  assert.equal(await readFile(options.outputRoot, 'utf8'), 'Preserved blocking file');
});
