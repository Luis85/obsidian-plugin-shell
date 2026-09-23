import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maintainabilityInventory } from './maintainability-inventory.mjs';
import { healthReport, duplicationReport, suppressionReport } from './maintainability-reports.mjs';
import { sha256 } from '../testing/source-inputs.mjs';
import { duplicateArguments, measureCorpus, assertCorpus, checkCorpus } from './maintainability-corpus.mjs';

const policy = { version: 1, cyclomatic: 10, cognitive: 15, duplication: 3, minTokens: 50, minLines: 5,
  mode: 'mild', ignoreImports: true, production: 'every src JS/TS/Vue file, including generated consumers' };
async function execute(tool, stage, args, output) {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('FALLOW_')));
  environment.FALLOW_TELEMETRY_DISABLED = '1';
  const command = ['--root', stage, '--no-cache', '--no-production', '--threads', '1', '--max-file-size', '0', '--format', 'json', ...args];
  const run = spawnSync(process.execPath, [tool, ...command], { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, env: environment });
  await writeFile(`${output}.json`, run.stdout ?? '');
  await writeFile(`${output}.stderr.txt`, run.stderr ?? '');
  if (run.error || ![0, 1].includes(run.status)) throw new Error(`METRIC_TOOL_FAILED: ${run.error?.message ?? run.status}`);
  let report;
  try { report = JSON.parse(run.stdout); } catch { throw new Error('METRIC_REPORT_JSON'); }
  return { report, exit: run.status, command, rawHash: sha256(run.stdout) };
}
function failureList(views) {
  const production = views.production;
  if (!production.health.functions) throw new Error('METRIC_EMPTY_PRODUCTION_MEASUREMENT');
  const failures = production.health.findings.map(finding => `${finding.path}:${finding.line} ${finding.name} ${finding.cyclomatic}/${finding.cognitive}`);
  if (production.duplication.duplication_percentage > policy.duplication) failures.push('PRODUCTION_DUPLICATION_ABOVE_3_PERCENT');
  return failures;
}
async function toolIdentity(tool) {
  const packageRoot = dirname(dirname(tool));
  const manifest = await readFile(join(packageRoot, 'package.json'));
  if (JSON.parse(manifest).version !== '3.28.0') throw new Error('METRIC_TOOL_VERSION');
  return { name: 'fallow', version: '3.28.0', node: process.version,
    packageSha256: sha256(manifest), launcherSha256: sha256(await readFile(tool)),
    outputContractSha256: sha256(await readFile(join(packageRoot, 'types/output-contract.d.ts'))) };
}
export async function checkMaintainability(root, output) {
  const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
  const current = await maintainabilityInventory(root);
  if (report.schema !== 'plugin-maintainability/v1' || JSON.stringify(report.policy) !== JSON.stringify(policy)) throw new Error('METRIC_REPORT_SCHEMA');
  if (JSON.stringify(report.inventory) !== JSON.stringify(current)) throw new Error('METRIC_STALE_INVENTORY');
  if (JSON.stringify(report.tool) !== JSON.stringify(await toolIdentity(join(root, 'node_modules/fallow/bin/fallow')))) throw new Error('METRIC_TOOL_CHANGED');
  for (const view of ['production', 'tooling', 'fixtures', 'templates']) {
    const result = report.views?.[view];
    const expected = current.files.filter(file => file.view === view).map((file, index) => ({ ...file, staged: `input-${index}.${file.extension}` }));
    if (!result || JSON.stringify(result.inputs) !== JSON.stringify(expected)) throw new Error('METRIC_OMITTED_INPUT');
    if (!expected.length) { if (result.status !== 'empty') throw new Error('METRIC_EMPTY_VIEW'); continue; }
    for (const [kind, validate, field] of [['health', healthReport, 'health'], ['dupes', duplicationReport, 'duplication'], ['suppressions', suppressionReport, 'suppressions']]) {
      const raw = await readFile(join(output, `${view}-${kind}.json`), 'utf8');
      const execution = result.execution?.[kind];
      if (sha256(raw) !== execution?.sha256 || ![0, 1].includes(execution?.exit)) throw new Error('METRIC_RAW_IDENTITY');
      const measured = validate(JSON.parse(raw), expected);
      if (JSON.stringify(measured) !== JSON.stringify(result[field])) throw new Error('METRIC_REPORT_DATA');
    }
    await checkCorpus(join(output, `${view}-inputs`), result.corpus, expected, result.duplication);
  }
  const failures = failureList(report.views);
  if (JSON.stringify(failures) !== JSON.stringify(report.failures) || report.status !== (failures.length ? 'failed' : 'passed')) throw new Error('METRIC_FALSE_STATUS');
  return { report, output };
}
export async function measureMaintainability(root = process.cwd(), options = {}) {
  const tool = options.tool ?? join(root, 'node_modules/fallow/bin/fallow');
  const output = options.output ?? join(root, 'reports/maintainability', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(output, { recursive: true });
  const before = await maintainabilityInventory(root);
  const toolVersion = await toolIdentity(tool);
  const views = {};
  for (const view of ['production', 'tooling', 'fixtures', 'templates']) {
    const inputs = before.files.filter(file => file.view === view).map((file, index) => ({ ...file, staged: `input-${index}.${file.extension}` }));
    if (!inputs.length) { views[view] = { status: 'empty', inputs: [] }; continue; }
    const stage = await mkdtemp(join(tmpdir(), 'plugin-maintainability-'));
    try {
      await writeFile(join(stage, '.fallowrc.json'), JSON.stringify({ duplicates: { ignoreDefaults: false }, rules: { 'boundary-violation': 'off', 'policy-violation': 'off' } }));
      await symlink(dirname(dirname(dirname(tool))), join(stage, 'node_modules'), 'junction');
      for (const input of inputs) {
        const data = await readFile(join(root, input.path));
        if (sha256(data) !== input.sha256) throw new Error('METRIC_SOURCE_CHANGED');
        await writeFile(join(stage, input.staged), data);
      }
      const suppressions = await execute(tool, stage, ['suppressions'], join(output, `${view}-suppressions`));
      const suppressionInventory = suppressionReport(suppressions.report);
      const health = await execute(tool, stage, ['health', '--complexity', '--max-cyclomatic', '10', '--max-cognitive', '15'], join(output, `${view}-health`));
      const dupes = await execute(tool, stage, duplicateArguments, join(output, `${view}-dupes`));
      views[view] = { inputs, suppressions: suppressionInventory, health: healthReport(health.report, inputs), duplication: duplicationReport(dupes.report, inputs),
        execution: { health: { exit: health.exit, command: health.command, sha256: health.rawHash }, dupes: { exit: dupes.exit, command: dupes.command, sha256: dupes.rawHash }, suppressions: { exit: suppressions.exit, command: suppressions.command, sha256: suppressions.rawHash } } };
      views[view].corpus = await measureCorpus(tool, stage, inputs, join(output, `${view}-inputs`), execute);
      assertCorpus(views[view].corpus, inputs, views[view].duplication);
    } finally {
      if (!resolve(stage).startsWith(`${resolve(tmpdir())}${sep}plugin-maintainability-`)) throw new Error('METRIC_STAGE_ESCAPE');
      await rm(stage, { recursive: true, force: true });
    }
  }
  const after = await maintainabilityInventory(root);
  if (before.digest !== after.digest) throw new Error('METRIC_SOURCE_CHANGED');
  const failures = failureList(views);
  const report = { schema: 'plugin-maintainability/v1', status: failures.length ? 'failed' : 'passed', policy,
    tool: toolVersion, inventory: before, views, failures,
    scope: 'Production thresholds block. Tooling, fixtures and removal templates are separate measured diagnostic views; CSS/markup/data are inventoried without function/clone qualification.' };
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return { report, output };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--help' && args.length === 1) {
      console.log('Measure full production 10/15 complexity and 3% duplication (50 tokens/5 lines), plus diagnostic tooling/fixture/template views.\nUsage: node scripts/quality/check-maintainability.mjs [--check REPORT_DIRECTORY]\nReports are data only; --check validates current inputs and never executes report commands.');
    } else {
    if (args.length && !(args.length === 2 && args[0] === '--check')) throw new Error('Usage: check-maintainability.mjs [--check REPORT_DIRECTORY]');
    const { report, output } = args.length ? await checkMaintainability(process.cwd(), resolve(args[1])) : await measureMaintainability();
    console.log(JSON.stringify({ status: report.status, output, failures: report.failures }, null, 2));
    if (report.status !== 'passed') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
