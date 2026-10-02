import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { args, need, readBytes, noLinks, sha256, isMain, cli } from './lib/io.mjs';

// Runs local repository code. Only point --repo at the trusted, inspected checkout.
// No dependency installation, CLI apply, native host, or live vault is involved.
export function validateProject(directory, input, timeout = 120000) {
  const repo = noLinks(directory);
  const source = noLinks(input);
  const bytes = readBytes(source, 4_000_000);
  const reader = path.join(repo, 'scripts/companion/generate.mjs');
  const app = path.join(repo, 'bin/app');
  readBytes(reader); readBytes(app);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'prototype-contract-'));
  const vault = path.join(scratch, 'vault');
  fs.mkdirSync(vault);
  const candidate = path.join(scratch, 'candidate.json');
  fs.writeFileSync(candidate, bytes, { flag: 'wx', mode: 0o600 });
  // The reader keeps its explicit placement flags; the launcher previews `new <absent-dir> --from <json>`.
  const target = path.join(vault, 'candidate');
  const argv = { reader: ['--input', candidate, '--vault', vault, '--target', 'candidate'],
    app: ['new', target, '--from', candidate, '--json'] };
  const display = { reader: '--input <scratch-copy> --vault <scratch-vault> --target candidate',
    app: 'new <scratch-vault>/candidate --from <scratch-copy> --json' };
  const report = { kind: 'prototype-project-validation', schemaVersion: 1,
    inputSha256: sha256(bytes), status: 'failed', checks: [],
    limitations: ['No apply, generated build, companion UI round-trip or native acceptance performed.'] };
  function run(name, script) {
    const kind = script === app ? 'app' : 'reader';
    const result = spawnSync(process.execPath, [script, ...argv[kind]], {
      cwd: repo, encoding: null, timeout, maxBuffer: 30_000_000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    const record = { name, command: `node ${path.relative(repo, script).split(path.sep).join('/')} ${display[kind]}`,
      exitCode: result.status, status: result.status === 0 && !result.error ? 'passed' : 'failed',
      stderr: result.stderr?.toString('utf8') ?? '', error: result.error?.message ?? null };
    report.checks.push(record);
    return { result, record };
  }
  try {
    const echo = run('actual-byte-exact-reader', reader);
    if (echo.record.status !== 'passed') return report;
    if (!echo.result.stdout.equals(bytes)) {
      echo.record.status = 'failed'; echo.record.error = 'Reader did not return original bytes';
      return report;
    }
    const plan = run('actual-generator-plan', app);
    return finishPlan(plan, report, target, source, bytes);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}
function finishPlan(plan, report, target, source, bytes) {
  if (plan.record.status !== 'passed') return report;
  let envelope;
  try { envelope = JSON.parse(plan.result.stdout.toString('utf8')); }
  catch { plan.record.status = 'failed'; plan.record.error = 'Generator did not emit a JSON plan'; return report; }
  if (!envelope || typeof envelope !== 'object' || envelope.status !== 'planned') {
    plan.record.status = 'failed'; plan.record.error = 'Generator did not return a planned result'; return report;
  }
  report.plan = envelope.data;
  if (!report.plan || Array.isArray(report.plan) || typeof report.plan !== 'object' ||
      typeof report.plan.planHash !== 'string' || !report.plan.planHash) {
    plan.record.status = 'failed'; plan.record.error = 'Generator plan is missing planHash'; return report;
  }
  if (Array.isArray(report.plan.conflicts) && report.plan.conflicts.length) {
    plan.record.status = 'failed'; plan.record.error = 'Generator reported conflicts'; return report;
  }
  if (fs.existsSync(target)) {
    plan.record.status = 'failed'; plan.record.error = 'Read-only plan unexpectedly created target'; return report;
  }
  if (sha256(readBytes(source, 4_000_000)) !== sha256(bytes)) {
    plan.record.status = 'failed'; plan.record.error = 'Original input changed during verification'; return report;
  }
  report.status = 'passed-reader-and-plan-only';
  return report;
}
if (isMain(import.meta.url)) cli(() => {
  const options = args(process.argv.slice(2), ['--repo', '--input'], ['--help']);
  if (options.help) return console.log('Usage: node validate-project.mjs --repo <trusted-checkout> --input <full-project.json>');
  const report = validateProject(need(options, 'repo'), need(options, 'input'));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed-reader-and-plan-only') process.exitCode = 1;
});
