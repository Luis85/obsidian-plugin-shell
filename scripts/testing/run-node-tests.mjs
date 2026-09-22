/** Bounded child runner for the temporary dependency-free baseline, not a new test framework. */
import { spawn } from 'node:child_process';
import { resolve, relative } from 'node:path';

export function evaluateRecords(text, code, expected) {
  const rows = text.trim() ? text.trim().split('\n').map((line) => JSON.parse(line)) : [];
  if (rows.some((r) => r.schemaVersion !== 1 || !['case', 'summary'].includes(r.kind)))
    throw new Error('REPORT_SCHEMA');
  const summaries = rows.filter((r) => r.kind === 'summary');
  if (summaries.length !== 1) throw new Error('REPORT_MISSING_SUMMARY');
  const summary = summaries[0];
  const counts = summary.counts;
  if (!counts || ['tests', 'failed', 'passed', 'cancelled', 'skipped', 'todo'].some(
    (key) => !Number.isSafeInteger(counts[key]) || counts[key] < 0)) throw new Error('REPORT_COUNTS');
  const cases = rows.filter((r) => r.kind === 'case' && r.type === 'test');
  const actual = cases.map((r) => /^\[([A-Z]+-\d+)\]/.exec(r.name)?.[1]);
  const discovered = new Set(actual);
  if (!expected.length || actual.some((id) => !id) || discovered.size !== actual.length ||
      actual.length !== expected.length || expected.some((id) => !discovered.has(id)))
    throw new Error('TEST_INVENTORY_MISMATCH');
  if (counts.tests !== cases.length) throw new Error('REPORT_COUNTS');
  const ok = code === 0 && summary.success === true && counts.passed === expected.length &&
    counts.failed + counts.cancelled + counts.skipped + counts.todo === 0 &&
    cases.every((r) => r.status === 'passed') && rows.every((r) => r.status !== 'failed');
  return { status: ok ? 'passed' : 'failed', counts, cases };
}

export async function runNodeTests(root, files, expected, { timeoutMs = 60000 } = {}) {
  const reporter = resolve(root, 'scripts/testing/node-reporter.mjs');
  return await new Promise((done) => {
    const args = ['--unhandled-rejections=strict', '--test', '--test-concurrency=1',
      `--test-reporter=${reporter}`, ...files];
    const env = { ...process.env, TZ: 'UTC', LANG: 'C.UTF-8', FORCE_COLOR: '0', NODE_OPTIONS: '' };
    // A negative-fixture subprocess is a new runner, not its parent's Node test worker.
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, { cwd: root, env,
      detached: process.platform !== 'win32', shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false; let overLimit = false;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
        killer.on('error', () => child.kill());
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const append = (channel, chunk) => {
      if (stdout.length + stderr.length + chunk.length > 2_000_000) {
        overLimit = true; stop(); return;
      }
      if (channel === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', (chunk) => append('stdout', chunk.toString()));
    child.stderr.on('data', (chunk) => append('stderr', chunk.toString()));
    child.on('error', (error) => { clearTimeout(timer); done({ status: 'infrastructure-error',
      reason: error.code ?? 'SPAWN_ERROR', exitCode: null, cases: [] }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      try {
        if (timedOut || overLimit) throw new Error(timedOut ? 'TEST_TIMEOUT' : 'OUTPUT_LIMIT');
        const result = evaluateRecords(stdout, code, expected);
        result.cases = result.cases.map((r) => ({ ...r,
          file: r.file ? relative(root, r.file).split('\\').join('/') : null }));
        done({ ...result, exitCode: code, signal, command: [process.execPath, ...args], stderr });
      } catch (error) {
        done({ status: 'infrastructure-error', reason: error.message,
          exitCode: code, signal, cases: [], stderr });
      }
    });
  });
}
