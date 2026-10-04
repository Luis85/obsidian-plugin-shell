import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const errorRecord = error => ({ name: error?.name ?? 'Unknown', message: error?.message ?? String(error),
  code: error?.code ?? null, syscall: error?.syscall ?? null, path: error?.path ?? null,
  ...(error instanceof AggregateError ? { errors: error.errors.map(errorRecord) } : {}),
  ...(error?.commandOutcome ? { commandOutcome: error.commandOutcome } : {}),
});

/** Preserve command receipts and both failures; this does not change timeout or child termination semantics. */
export async function archiveCommandFixture(work, {
  parent = tmpdir(), outputRoot = resolve('reports/analyzer-archive'), cleanup = path => rm(path, { recursive: true, force: true }),
} = {}) {
  const scratch = await mkdtemp(join(resolve(parent), 'analyzer-archive-'));
  const output = join(outputRoot, randomUUID());
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), scratch, status: 'running',
    workStatus: 'running', bodyCompleted: false, cleanupStatus: 'pending', commands: [], failures: [] };
  const saveReport = () => writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  let value; let reportingReady = false; const failures = [];
  const command = (file, args, cwd, env, { timeout = 60000, maxBuffer = 12 * 1024 * 1024 } = {}) => {
    assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 60000);
    assert.ok(Number.isSafeInteger(maxBuffer) && maxBuffer > 0 && maxBuffer <= 12 * 1024 * 1024);
    const id = String(report.commands.length + 1).padStart(2, '0');
    const started = { file, args, cwd, timeoutMs: timeout, maxBufferBytes: maxBuffer, startedAt: new Date().toISOString() };
    const entry = { started: `${id}-started.json`, result: `${id}-result.json` };
    writeFileSync(join(output, entry.started), JSON.stringify(started, null, 2) + '\n', { flag: 'wx' });
    report.commands.push(entry); saveReport();
    const before = performance.now();
    const run = spawnSync(file, args, { cwd, env, encoding: 'utf8', timeout, maxBuffer, windowsHide: true });
    const result = { finishedAt: new Date().toISOString(), durationMs: performance.now() - before,
      pid: run.pid, status: run.status, signal: run.signal, error: run.error ? errorRecord(run.error) : null,
      stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
    let commandError;
    try { assert.ifError(run.error); } catch (error) { commandError = error; }
    try { writeFileSync(join(output, entry.result), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); }
    catch (error) {
      const failure = commandError ? new AggregateError([commandError, error], 'Command and receipt both failed') : error;
      failure.commandOutcome = { command: started, result }; throw failure;
    }
    if (commandError) throw commandError;
    return run;
  };
  try {
    assert.equal(dirname(scratch), resolve(parent));
    await mkdir(output, { recursive: true }); saveReport(); reportingReady = true;
    value = await work({ scratch, output, command }); report.workStatus = 'passed'; report.bodyCompleted = true;
  }
  catch (error) { report.workStatus = 'failed'; failures.push(error); report.failures.push({ phase: 'work', ...errorRecord(error) }); }
  report.cleanupStatus = 'running';
  try { if (reportingReady) saveReport(); }
  catch (error) { failures.push(error); report.failures.push({ phase: 'receipt', ...errorRecord(error) }); }
  try { await cleanup(scratch); report.cleanupStatus = 'passed'; }
  catch (error) { report.cleanupStatus = 'failed'; failures.push(error); report.failures.push({ phase: 'cleanup', ...errorRecord(error) }); report.scratchPreserved = true; }
  report.status = failures.length ? 'failed' : 'passed'; report.finishedAt = new Date().toISOString();
  try { if (reportingReady) saveReport(); }
  catch (error) { failures.push(error); }
  if (failures.length > 1) throw new AggregateError(failures, `Archive fixture failures; inspect ${output}`);
  if (failures.length) throw failures[0];
  return value;
}
