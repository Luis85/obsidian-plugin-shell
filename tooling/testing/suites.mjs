/** Run, list or check responsibility-named test suites declared in tests/suites.json. */
import { spawnSync } from 'node:child_process';
import { accessSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { checkSuites, globToRegExp, selectSuites } from '../../src/cli/tooling/testing/suite-manifest.mjs';
import { e2ePolicyFailures, pyramidReport, removedExampleFiles, resolveLevels, selectByLevel } from './test-levels.mjs';
import { projectConfigPath, projectConfigs } from '../../src/shared/platform/project-configs.mjs';
import { resolveBrowserExecutable } from '../../src/cli/tooling/testing/browser-executable.mjs';

const usage = `Usage: node tooling/testing/suites.mjs <suite...|tooling> [--dry-run] [--json] [-- extra runner args]
       node tooling/testing/suites.mjs --level <level[,level...]> [--dry-run] [--json] [-- extra runner args]
       node tooling/testing/suites.mjs --list [--json]
       node tooling/testing/suites.mjs --check [--json]
       node tooling/testing/suites.mjs --pyramid [--json]
Suites and test-pyramid levels are declared in tests/suites.json; docs/testing/TEST-SUITES.md describes them.
"tooling" selects every suite verify runs in its node --test tooling step (the maker suite runs in its own coverage step).`;

function parseArguments(argv) {
  const options = { names: [], levels: [], list: false, check: false, pyramid: false, json: false, dryRun: false, help: false, extra: [] };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--') { options.extra = argv.slice(index + 1); break; }
    if (value === '--list') options.list = true;
    else if (value === '--check') options.check = true;
    else if (value === '--pyramid') options.pyramid = true;
    else if (value === '--level') options.levels.push(...(argv[++index] ?? '').split(',').filter(Boolean));
    else if (value === '--json') options.json = true;
    else if (value === '--dry-run') options.dryRun = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else if (value.startsWith('-')) throw new Error(`UNKNOWN_OPTION: ${value}`);
    else options.names.push(value);
  }
  const modes = ['list', 'check', 'pyramid'].filter(mode => options[mode]);
  if (modes.length > 1) throw new Error(`CONFLICTING_OPTIONS: --${modes.join(' and --')}`);
  if (argv.includes('--level') && !options.levels.length) throw new Error('LEVEL_REQUIRED: --level needs one or more comma-separated levels');
  if ((modes.length || options.levels.length) && options.names.length) throw new Error('CONFLICTING_OPTIONS: suite names with --list/--check/--pyramid/--level');
  if (modes.length && options.levels.length) throw new Error(`CONFLICTING_OPTIONS: --level with --${modes[0]}`);
  if (!options.help && !modes.length && !options.levels.length && !options.names.length) throw new Error('NO_SUITE_SELECTED');
  return options;
}

const placeholders = { '{node}': () => process.execPath, '{python}': () => process.env.PYTHON || 'python3' };
function expand(argv, file) {
  return argv.map(part => part === '{file}' ? file : placeholders[part]?.() ?? part);
}
function eachFiles(root, pattern) {
  const regex = globToRegExp(pattern);
  const directory = pattern.slice(0, pattern.lastIndexOf('/'));
  const files = readdirSync(resolve(root, directory)).sort().map(name => `${directory}/${name}`).filter(path => regex.test(path));
  if (!files.length) throw new Error(`SUITE_EACH_EMPTY: ${pattern} matches no files`);
  return files;
}

/** A project generated before configs/<concern>/ keeps its retired root config until it regenerates. */
function runnerConfig(root, config) {
  const kind = Object.keys(projectConfigs).find(key => projectConfigs[key].path === config);
  return kind ? projectConfigPath(root, kind) ?? config : config;
}
/** Exact argv lists a suite executes; runner-specific extra arguments keep their position. */
function suiteCommands(root, suite, extra = []) {
  const runner = suite.runner;
  switch (runner.type) {
    case 'node-test': return [[process.execPath, '--test', `--test-concurrency=${runner.concurrency ?? 1}`, ...extra, ...suite.files]];
    // A level selection narrows Vitest to its files with positional filters.
    case 'vitest': return [[process.execPath, 'node_modules/vitest/vitest.mjs', 'run', '--config', runnerConfig(root, runner.config), ...extra, ...(suite.narrowed ? suite.files : [])]];
    case 'playwright': return [[process.execPath, 'node_modules/@playwright/test/cli.js', 'test', '--config', 'configs/testing/playwright.config.ts', ...extra]];
    case 'npm-script': return [[process.execPath, process.env.npm_execpath ?? 'npm-cli.js', 'run', runner.script, ...(extra.length ? ['--', ...extra] : [])]];
    case 'manual': return [];
    default: return runner.commands.flatMap(command => Array.isArray(command) ? [expand(command)]
      : eachFiles(root, command.each).map(file => expand(command.argv, file)));
  }
}

/** The browser prerequisite is judged by the shared resolver so a Chromium revision mismatch is reported explicitly. */
function browserProblem(root) {
  const result = resolveBrowserExecutable({ root });
  return ['pinned', 'override'].includes(result.status) ? null : { reason: result.reason, hint: result.hint };
}
function probe(root, definition) {
  if (definition.env) return Boolean(process.env[definition.env]);
  if (definition.file) { try { accessSync(resolve(root, definition.file)); return true; } catch { return false; } }
  const [command, ...args] = expand(definition.probe);
  const result = spawnSync(command, args, { cwd: root, stdio: 'ignore', timeout: 30000 });
  return !result.error && result.status === 0;
}
function missingPrerequisites(root, manifest, suite) {
  return (suite.prerequisites ?? []).flatMap(name => {
    const definition = manifest.prerequisites[name];
    if (definition.browser) { const problem = browserProblem(root); return problem ? [{ name, ...problem }] : []; }
    return probe(root, definition) ? [] : [{ name, hint: definition.hint }];
  });
}
/** A browser revision mismatch keeps its own reason code and the exact override hint; other gaps list the prerequisites. */
function notRunOutcome(suite, missing) {
  const mismatch = missing.find(item => item.reason === 'browser-revision-mismatch');
  if (mismatch) return { name: suite.name, status: 'not-run', reason: mismatch.reason, hint: mismatch.hint, durationMs: 0 };
  return { name: suite.name, status: 'not-run', reason: `missing prerequisites: ${missing.map(item => item.name).join(', ')}`, durationMs: 0 };
}
function unavailable(root, suite) {
  if (suite.runner.type === 'manual') return `manual suite without an automated runner; follow ${suite.runner.instructions}`;
  if (suite.runner.type === 'npm-script') {
    const scripts = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts ?? {};
    if (!scripts[suite.runner.script]) return `package.json has no "${suite.runner.script}" script in this checkout`;
    if (!process.env.npm_execpath) return `run it through npm (npm run ${suite.runner.script}) so the npm CLI is known`;
  }
  if (suite.optional && !suite.files.length) return 'optional suite has no test files in this checkout';
  return null;
}

function runSuite(root, manifest, suite, options) {
  const label = `${suite.name} (${suite.files.length} file${suite.files.length === 1 ? '' : 's'}, ${suite.runner.type})`;
  const reason = unavailable(root, suite);
  if (reason) { console.error(`✗ suite ${label}: not run — ${reason}`); return { name: suite.name, status: 'not-run', reason, durationMs: 0 }; }
  const missing = missingPrerequisites(root, manifest, suite);
  for (const item of missing) console.error(`${options.dryRun ? '!' : '✗'} suite ${label}: missing prerequisite "${item.name}". ${item.hint}`);
  if (missing.length && !options.dryRun) return notRunOutcome(suite, missing);
  const commands = suiteCommands(root, suite, options.extra);
  // With --json, stdout carries only the final JSON document; progress and child output go to stderr.
  const log = options.json ? console.error : console.log;
  log(`\n▶ suite: ${label}`);
  if (options.dryRun) {
    for (const command of commands) log(`  ${command.join(' ')}`);
    return { name: suite.name, status: 'planned', files: suite.files, commands, missingPrerequisites: missing.map(item => item.name), durationMs: 0 };
  }
  const started = performance.now();
  for (const [command, ...args] of commands) {
    const result = spawnSync(command, args, { cwd: root, stdio: options.json ? ['inherit', 2, 'inherit'] : 'inherit' });
    if (result.error || result.status !== 0) {
      const durationMs = Math.round(performance.now() - started);
      return { name: suite.name, status: 'failed', reason: result.error?.message ?? `exit ${result.status ?? result.signal}`, durationMs };
    }
  }
  return { name: suite.name, status: 'passed', durationMs: Math.round(performance.now() - started) };
}

/** Levels of a suite's files ("unit+integration" when mixed), or its declared level for a suite without files. */
function levelLabel(suite, levels) {
  const found = [...new Set(levels.files.filter(file => file.suite === suite.name).map(file => file.level))];
  return (found.length ? found : [suite.level ?? '-']).join('+');
}
function describe(suite, levels) {
  const fileLevels = Object.fromEntries(levels.files.filter(file => file.suite === suite.name).map(file => [file.path, file.level]));
  return { name: suite.name, purpose: suite.purpose, level: suite.level ?? null, fileLevels, runner: suite.runner.type, verify: suite.verify,
    prerequisites: suite.prerequisites ?? [], npmScript: suite.npmScript ?? null, workflows: suite.workflows ?? [],
    optional: Boolean(suite.optional), fileCount: suite.files.length, files: suite.files };
}
function printList(result, levels) {
  const rows = result.suites.map(suite => [suite.name, levelLabel(suite, levels), String(suite.files.length), suite.runner.type, suite.verify,
    (suite.prerequisites ?? []).join(',') || '-', suite.npmScript ? `npm run ${suite.npmScript}` : '-']);
  const header = ['suite', 'level', 'files', 'runner', 'verify', 'prerequisites', 'command'];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map(row => row[column].length)));
  for (const row of [header, ...rows]) console.log(row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd());
  console.log(`\n${result.helpers.length} helper modules; ${result.suites.reduce((sum, suite) => sum + suite.files.length, 0)} test files classified.`);
}
function printPyramid(report) {
  const widest = Math.max(1, ...report.levels.map(row => row.files));
  console.log('Test pyramid: test files per level, top of the pyramid first.');
  for (const row of [...report.levels].reverse()) {
    const measured = row.measuredSuites.length ? `  (measured ${row.measuredSeconds} s over ${row.measuredSuites.length} single-level suite${row.measuredSuites.length === 1 ? '' : 's'})` : '';
    console.log(`  ${row.level.padEnd(12)} ${String(row.files).padStart(4)}  ${'#'.repeat(Math.round(row.files / widest * 40))}${measured}`);
  }
  console.log(`  ${'total'.padEnd(12)} ${String(report.total).padStart(4)}`);
  if (report.mixedSuites.length) console.log(`Mixed-level suites (their measured time is not split by level): ${report.mixedSuites.map(item => `${item.suite} (${item.levels.join('+')})`).join(', ')}`);
  for (const warning of report.warnings) console.error(`warning: ${warning}`);
}

async function evidenceInventory(root) {
  const { suiteInventory } = await import('./evidence-identity.mjs');
  return () => suiteInventory(root, 'tooling');
}
/** The default verify step table; a checkout without it leaves every suite that names a verify step unaccounted. */
async function verifyStepTable() {
  try { return (await import('../quality/verify-steps.mjs')).verifySteps({}); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return null; throw error; }
}
/** The e2e opt-in policy's classifier; a distributed kit without the repository policy checks only the verify mode. */
async function e2eKinds() {
  try { return (await import('../quality/e2e-policy.mjs')).e2eKinds; }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return null; throw error; }
}
/** Durations from the suite guide's Measured column, through the reader `check --plan` uses; none in a kit without it. */
async function measuredDurations(root) {
  try { return await (await import('../../src/cli/adapters/framework/gate-sources.ts')).loadDurations(root); } catch { return {}; }
}
function failed(options, failures) {
  if (options.json) console.log(JSON.stringify({ status: 'failed', failures }, null, 2));
  for (const failure of failures) console.error(failure);
  return 1;
}
function runOutcomes(root, result, names, options) {
  const outcomes = names.map(name => runSuite(root, result.manifest, result.suites.find(suite => suite.name === name), options));
  if (options.json) console.log(JSON.stringify({ schemaVersion: 1, dryRun: options.dryRun, outcomes }, null, 2));
  else {
    console.log('\nSuite summary:');
    for (const outcome of outcomes) console.log(`  ${outcome.status.padEnd(8)} ${outcome.name.padEnd(24)} ${(outcome.durationMs / 1000).toFixed(1)}s${outcome.reason ? `  (${outcome.reason}${outcome.hint ? `: ${outcome.hint}` : ''})` : ''}`);
  }
  return outcomes.every(outcome => ['passed', 'planned'].includes(outcome.status)) ? 0 : 1;
}
/** `--level`: every suite with files at those levels; node --test and Vitest suites run only those files. */
function runLevels(root, result, levels, options) {
  const unknown = options.levels.filter(level => !levels.levels.some(item => item.name === level));
  if (unknown.length) throw new Error(`UNKNOWN_LEVEL: ${unknown.join(', ')}. Known: ${levels.levels.map(item => item.name).join(', ')}`);
  const { selected, skipped } = selectByLevel(result.suites, levels, options.levels);
  for (const item of skipped) console.error(`- suite ${item.name}: not selected; it ${item.reason}.`);
  if (!selected.length) throw new Error(`NO_SUITE_SELECTED: no suite has ${options.levels.join(', ')} test files it can run on their own`);
  const suites = result.suites.map(suite => { const pick = selected.find(item => item.suite === suite); return pick ? { ...suite, files: pick.files, narrowed: pick.narrowed } : suite; });
  return runOutcomes(root, { ...result, suites }, selected.map(item => item.suite.name), options);
}

async function main(argv, root = process.cwd()) {
  const options = parseArguments(argv);
  if (options.help) { console.log(usage); return 0; }
  const result = await checkSuites(root, options.check ? { evidenceInventory: await evidenceInventory(root), verifySteps: verifyStepTable } : {});
  if (result.failures.length) return failed(options, result.failures);
  const levels = resolveLevels(result.manifest, result.suites, { removed: removedExampleFiles(root) });
  if (options.check || options.pyramid || options.levels.length) {
    const failures = [...levels.failures, ...(options.check ? e2ePolicyFailures(result.manifest, await e2eKinds()) : [])];
    if (failures.length) return failed(options, failures);
  }
  if (options.check) {
    const summary = { status: 'passed', suites: result.suites.length, testFiles: result.suites.reduce((sum, suite) => sum + suite.files.length, 0), helpers: result.helpers.length, levels: levels.levels.length };
    console.log(options.json ? JSON.stringify(summary) : `Suite manifest check passed: ${summary.testFiles} test files in ${summary.suites} suites, ${summary.helpers} helpers; every test file has one of ${summary.levels} test levels.`);
    return 0;
  }
  if (options.pyramid) {
    const report = pyramidReport(result.manifest, levels, await measuredDurations(root));
    if (options.json) console.log(JSON.stringify({ schemaVersion: 1, ...report }, null, 2));
    else printPyramid(report);
    return 0;
  }
  if (options.list) {
    if (options.json) console.log(JSON.stringify({ schemaVersion: 1, suites: result.suites.map(suite => describe(suite, levels)), helpers: result.helpers }, null, 2));
    else printList(result, levels);
    return 0;
  }
  if (options.levels.length) return runLevels(root, result, levels, options);
  return runOutcomes(root, result, selectSuites(result.manifest, options.names), options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); console.error(usage); process.exitCode = 2; }
}
