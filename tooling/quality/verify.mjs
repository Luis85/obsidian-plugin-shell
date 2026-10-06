import { runNodeProcess } from '../../src/shared/platform/process.ts';
import { runVerifyCli } from './verify-cli.mjs';
import { verifySteps } from './verify-steps.mjs';
// Step order, ids and dependencies live in verify-steps.mjs; semantics are documented in
// docs/development/QUALITY-ASSURANCE.md. Child output is streamed and also kept as a bounded tail.
const outputLimit = 64 * 1024 * 1024;
async function runScript(path, args, write) {
  try { await runNodeProcess(path, args, { captureOutput: true, outputLimit, onOutput: write, forwardParentSignals: true, spawnOptions: { cwd: process.cwd() } }); }
  catch (error) {
    const exited = error?.kind === 'exit';
    const failure = new Error(exited ? `Command failed (${error.exitCode ?? error.signal}): ${path}` : error.message);
    failure.exitCode = error?.exitCode ?? null;
    throw failure;
  }
}
// tests/suites.json owns tooling classification; every group runs even after a
// failure so one run still reports the complete tooling set, as before grouping.
async function runToolingSuites(write) {
  const { toolingGroups } = await import('../../src/cli/tooling/testing/suite-manifest.mjs');
  const failed = [];
  for (const { name, files, concurrency } of await toolingGroups(process.cwd())) {
    write(`\n▶ tooling suite: ${name} (${files.length} files)\n`);
    try { await runScript('--test', [`--test-concurrency=${concurrency}`, ...files], write); } catch { failed.push(name); }
  }
  if (failed.length) throw new Error(`Tooling suites failed: ${failed.join(', ')}`);
}
let cancelled = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { cancelled = true; });
const run = (step, write) => step.kind === 'tooling-suites' ? runToolingSuites(write) : runScript(step.entry, step.args, write);
process.exitCode = await runVerifyCli({ argv: process.argv.slice(2), steps: verifySteps(), execute: run, isCancelled: () => cancelled });
