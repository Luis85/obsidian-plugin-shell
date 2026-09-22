/** Finite verification of what is executable NOW. Does not initialize or certify the plugin. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validatePlan, acceptanceEvidence, releaseDecision } from './test-plan.mjs';
import { sourceInputs } from './source-inputs.mjs';
import { runNodeTests } from './run-node-tests.mjs';
import { assertRepeatable, outcomeDigest, xmlReport } from './report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export async function verify({ repeat, profile = 'baseline' } = {}) {
  const plan = validatePlan(JSON.parse(await readFile(resolve(root, 'docs/testing/test-plan.json'), 'utf8')));
  const count = repeat ?? plan.repeat;
  if (!Number.isInteger(count) || count < 2 || count > 10) throw new Error('REPEAT_MUST_BE_2_TO_10');
  if (!['baseline', 'release'].includes(profile)) throw new Error('UNKNOWN_PROFILE');
  const input = await sourceInputs(root);
  const runs = []; const violations = input.files.filter((f) => f.limit && f.lines > f.limit);
  const baselineSuites = plan.suites.filter((s) => s.state === 'executable' && ['node-baseline','http-specimen'].includes(s.mode));
  // Detect added/removed test files, not just individual test titles.
  const discovered = input.files.filter((f) => f.path.endsWith('.test.mjs')).map((f) => f.path).sort();
  if (JSON.stringify(discovered) !== JSON.stringify(baselineSuites.map((s) => s.file).sort()))
    throw new Error('UNREGISTERED_TEST_FILE');
  let status = 'blocked'; let reason = profile === 'release' ? 'RELEASE_NOT_IMPLEMENTED' : null;
  if (profile === 'baseline') {
    if (violations.length) { status = 'failed'; reason = 'SOURCE_LINE_LIMIT'; }
    else {
      for (let i = 0; i < count; i++) {
        const results = [];
        for (const suite of baselineSuites) results.push({ id: suite.id, mode: suite.mode,
          scope: suite.scope, ...await runNodeTests(root, [suite.file], suite.testIds) });
        runs.push(results);
      }
      try { assertRepeatable(runs); status = 'passed'; }
      catch (error) { status = 'failed'; reason = error.message; }
    }
  }
  const after = await sourceInputs(root);
  if (after.digest !== input.digest) { status = 'failed'; reason = 'SOURCE_CHANGED_DURING_RUN'; }
  const results = runs[0] ?? [];
  const acceptedResults = status === 'passed' ? results : [];
  const report = { schemaVersion: 1, scope: 'fixture-and-verification-baseline', profile, status, reason,
    checkedAt: new Date().toISOString(), environment: { node: process.version, platform: process.platform,
      architecture: process.arch, timezone: 'UTC' }, inputDigest: input.digest, inputs: input.files,
    coverage: { measured: false, reason: 'No qualified production Vitest coverage project exists yet.' },
    repeatability: { repetitions: runs.length, retries: 0, outcomeDigests: runs.map(outcomeDigest) },
    violations, runs, acceptance: acceptanceEvidence(plan, acceptedResults), release: releaseDecision(plan, acceptedResults),
    pending: plan.suites.filter((s) => !baselineSuites.includes(s)).map((s) => ({ id: s.id,
      status: 'not-run', reason: s.state === 'planned' ? 'IMPLEMENTATION_PENDING' : 'SEPARATE_BROWSER_COMMAND' })) };
  const folder = resolve(root, 'reports/verification', `run-${Date.now()}-${randomUUID()}`);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (runs.length) await writeFile(resolve(folder, 'junit.xml'), xmlReport(runs.flatMap((run, index) => run.map((r) => ({ ...r, id: `${r.id}/run-${index + 1}` })))), { flag: 'wx' });
  const states = (name) => report.acceptance.filter((r) => r.state === name).length;
  const summary = `# Baseline verification\n\nStatus: **${status}**. Release: **blocked**.\n\n` +
    `Scope: ${report.scope}. Code coverage: not measured.\n\n` +
    `Acceptance: ${states('verified')} verified within declared scope; ${states('partial')} partial; ${states('not-run')} not run.\n\n` +
    `Repeated executions: ${runs.length}; retries: zero. Input digest: \`${input.digest}\`.\n\n` +
    `This result does not certify Vue, native Obsidian, mobile, setup/makers or releases.\n`;
  await writeFile(resolve(folder, 'summary.md'), summary, { flag: 'wx' });
  return { status, reason, report: relative(root, resolve(folder, 'report.json')).split('\\').join('/'),
    testsPerRun: results.reduce((n, r) => n + (r.counts?.tests ?? 0), 0), repetitions: runs.length,
    acceptance: { verified: states('verified'), partial: states('partial'), notRun: states('not-run') }, release: 'blocked' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); const options = {}; let json = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--json') json = true;
      else if (args[i] === '--repeat') options.repeat = Number(args[++i]);
      else if (args[i] === '--profile') options.profile = args[++i];
      else if (args[i] === '--help') { console.log('node scripts/testing/verify-baseline.mjs [--repeat 2..10] [--profile baseline|release] [--json]'); process.exit(0); }
      else throw new Error('UNKNOWN_ARGUMENT');
    }
    const result = await verify(options);
    console.log(json ? JSON.stringify(result) : `${result.status}: ${result.testsPerRun} tests × ${result.repetitions} runs. Release blocked.\n${result.report}`);
    process.exitCode = result.status === 'passed' ? 0 : result.status === 'blocked' ? 2 : 1;
  } catch (error) { console.error(JSON.stringify({ status: 'infrastructure-error', reason: error.message })); process.exitCode = 2; }
}
