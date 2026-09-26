/** Run, list or check responsibility-named test suites declared in tests/suites.json. */
import { spawnSync } from 'node:child_process';
import { accessSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { checkSuites, globToRegExp, selectSuites } from './suite-manifest.mjs';

const usage = `Usage: node scripts/testing/suites.mjs <suite...|tooling> [--dry-run] [--json] [-- extra runner args]
       node scripts/testing/suites.mjs --list [--json]
       node scripts/testing/suites.mjs --check [--json]
Suites are declared in tests/suites.json; docs/testing/TEST-SUITES.md describes them.
"tooling" selects every suite verify runs in its node --test tooling step.`;

function parseArguments(argv) {
  const options = { names: [], list: false, check: false, json: false, dryRun: false, help: false, extra: [] };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--') { options.extra = argv.slice(index + 1); break; }
    if (value === '--list') options.list = true;
    else if (value === '--check') options.check = true;
    else if (value === '--json') options.json = true;
    else if (value === '--dry-run') options.dryRun = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else if (value.startsWith('-')) throw new Error(`UNKNOWN_OPTION: ${value}`);
    else options.names.push(value);
  }
  if (options.list && options.check) throw new Error('CONFLICTING_OPTIONS: --list and --check');
  if ((options.list || options.check) && options.names.length) throw new Error('CONFLICTING_OPTIONS: suite names with --list/--check');
  if (!options.help && !options.list && !options.check && !options.names.length) throw new Error('NO_SUITE_SELECTED');
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

/** Exact argv lists a suite executes; runner-specific extra arguments keep their position. */
function suiteCommands(root, suite, extra = []) {
  const runner = suite.runner;
  switch (runner.type) {
    case 'node-test': return [[process.execPath, '--test', '--test-concurrency=1', ...extra, ...suite.files]];
    case 'vitest': return [[process.execPath, 'node_modules/vitest/vitest.mjs', 'run', '--config', runner.config, ...extra]];
    case 'playwright': return [[process.execPath, 'node_modules/@playwright/test/cli.js', 'test', ...extra]];
    case 'npm-script': return [[process.execPath, process.env.npm_execpath ?? 'npm-cli.js', 'run', runner.script, ...(extra.length ? ['--', ...extra] : [])]];
    case 'manual': return [];
    default: return runner.commands.flatMap(command => Array.isArray(command) ? [expand(command)]
      : eachFiles(root, command.each).map(file => expand(command.argv, file)));
  }
}

function probe(root, definition) {
  if (definition.env) return Boolean(process.env[definition.env]);
  if (definition.file) { try { accessSync(resolve(root, definition.file)); return true; } catch { return false; } }
  const [command, ...args] = expand(definition.probe);
  const result = spawnSync(command, args, { cwd: root, stdio: 'ignore', timeout: 30000 });
  return !result.error && result.status === 0;
}
function missingPrerequisites(root, manifest, suite) {
  return (suite.prerequisites ?? []).filter(name => !probe(root, manifest.prerequisites[name]))
    .map(name => ({ name, hint: manifest.prerequisites[name].hint }));
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
  if (missing.length && !options.dryRun)
    return { name: suite.name, status: 'not-run', reason: `missing prerequisites: ${missing.map(item => item.name).join(', ')}`, durationMs: 0 };
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

function describe(suite) {
  return { name: suite.name, purpose: suite.purpose, runner: suite.runner.type, verify: suite.verify,
    prerequisites: suite.prerequisites ?? [], npmScript: suite.npmScript ?? null, workflows: suite.workflows ?? [],
    optional: Boolean(suite.optional), fileCount: suite.files.length, files: suite.files };
}
function printList(result) {
  const rows = result.suites.map(suite => [suite.name, String(suite.files.length), suite.runner.type, suite.verify,
    (suite.prerequisites ?? []).join(',') || '-', suite.npmScript ? `npm run ${suite.npmScript}` : '-']);
  const header = ['suite', 'files', 'runner', 'verify', 'prerequisites', 'command'];
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map(row => row[column].length)));
  for (const row of [header, ...rows]) console.log(row.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd());
  console.log(`\n${result.helpers.length} helper modules; ${result.suites.reduce((sum, suite) => sum + suite.files.length, 0)} test files classified.`);
}

async function evidenceInventory(root) {
  const { suiteInventory } = await import('./evidence-identity.mjs');
  return () => suiteInventory(root, 'tooling');
}

async function main(argv, root = process.cwd()) {
  const options = parseArguments(argv);
  if (options.help) { console.log(usage); return 0; }
  const result = await checkSuites(root, options.check ? { evidenceInventory: await evidenceInventory(root) } : {});
  if (result.failures.length) {
    if (options.json) console.log(JSON.stringify({ status: 'failed', failures: result.failures }, null, 2));
    for (const failure of result.failures) console.error(failure);
    return 1;
  }
  if (options.check) {
    const summary = { status: 'passed', suites: result.suites.length, testFiles: result.suites.reduce((sum, suite) => sum + suite.files.length, 0), helpers: result.helpers.length };
    console.log(options.json ? JSON.stringify(summary) : `Suite manifest check passed: ${summary.testFiles} test files in ${summary.suites} suites, ${summary.helpers} helpers.`);
    return 0;
  }
  if (options.list) {
    if (options.json) console.log(JSON.stringify({ schemaVersion: 1, suites: result.suites.map(describe), helpers: result.helpers }, null, 2));
    else printList(result);
    return 0;
  }
  const names = selectSuites(result.manifest, options.names);
  const outcomes = names.map(name => runSuite(root, result.manifest, result.suites.find(suite => suite.name === name), options));
  if (options.json) console.log(JSON.stringify({ schemaVersion: 1, dryRun: options.dryRun, outcomes }, null, 2));
  else {
    console.log('\nSuite summary:');
    for (const outcome of outcomes) console.log(`  ${outcome.status.padEnd(8)} ${outcome.name.padEnd(24)} ${(outcome.durationMs / 1000).toFixed(1)}s${outcome.reason ? `  (${outcome.reason})` : ''}`);
  }
  return outcomes.every(outcome => ['passed', 'planned'].includes(outcome.status)) ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); console.error(usage); process.exitCode = 2; }
}
