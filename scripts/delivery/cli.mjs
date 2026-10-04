/**
 * Shared command line of ready.mjs and done.mjs: arguments, configuration, the repository snapshot, the
 * report views and the exit code (0 ready/done/exempt, 1 not ready/not done, 2 usage, config or base error).
 */
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { checkPlanGates, repositorySnapshot } from './repository.mjs';
import { exemption, runDone, runReady } from './run.mjs';
import { readyRules } from './rules-ready.mjs';
import { doneRules } from './rules-done.mjs';
import { humanReport, jsonReport, refinementMarkdown, summaryMarkdown } from './report.mjs';
import { safeRelative } from './paths.mjs';

const usageError = message => Object.assign(new Error(`DELIVERY_USAGE: ${message}`), { code: 'DELIVERY_USAGE' });
const flags = new Set(['--json', '--write', '--no-plan', '--help']);
const values = new Set(['--handoff', '--base', '--summary', '--out']);

function usage(gate) {
  const script = gate === 'ready' ? 'ready' : 'done';
  return `node scripts/delivery/${script}.mjs [--handoff docs/increments/<slug>.md] [--base origin/main] [--json] [--summary <file>] [--out <dir>] [--write]${gate === 'done' ? ' [--no-plan]' : ''}
Checks the increment handoff ${gate === 'ready' ? 'before implementation (Definition of Ready)' : 'against the implemented diff (Definition of Done)'}.
  --base     ref to diff against (merge base with HEAD); default origin/main
  --handoff  the handoff to check; default: a "Handoff: <path>" line in DELIVERY_PR_BODY, else the one handoff in the diff
  --summary  append the Markdown report to this file (for $GITHUB_STEP_SUMMARY)
  --out      write generated files there instead of the checkout (CI artifact)
  --write    ${gate === 'ready' ? 'add missing sections from the template to the handoff' : 'write the Completion record, CHANGELOG entries, docs index rows and status: Done'}
Environment: DELIVERY_HEAD_REF, DELIVERY_ACTOR (exemptions), DELIVERY_PR_BODY, PR_LABELS (comma-separated).
Exit codes: 0 ${gate === 'ready' ? 'ready' : 'done'} or exempt, 1 not ${gate === 'ready' ? 'ready' : 'done'}, 2 usage, configuration or base error.`;
}

function parseArguments(args) {
  const options = {}; const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw usageError(`duplicate ${flag}`);
    seen.add(flag);
    if (flags.has(flag)) { options[flag.slice(2).replace('no-plan', 'noPlan')] = true; continue; }
    if (!values.has(flag)) throw usageError(`unknown argument ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith('--')) throw usageError(`${flag} needs a value`);
    options[flag.slice(2)] = value;
  }
  if (options.handoff && !safeRelative(options.handoff)) throw usageError('--handoff must be a repository-relative path');
  return options;
}

function writeOut(root, out, files) {
  const written = [];
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, out, path);
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); written.push(join(out, path));
  }
  return written;
}

/** Runs one gate and returns { result, exitCode }. Never throws for expected failures. */
async function runGate(gate, args, { root = process.cwd(), env = process.env } = {}) {
  let options;
  try {
    options = parseArguments(args);
    if (options.help) return { help: usage(gate), exitCode: 0 };
    const definitions = gate === 'ready' ? readyRules : doneRules;
    const config = await loadConfig(root, gate, definitions);
    if (gate === 'done') config.ready = (await loadConfig(root, 'ready', readyRules)).rules;
    const notice = exemption(config.delivery, { headRef: env.DELIVERY_HEAD_REF ?? '', actor: env.DELIVERY_ACTOR ?? '' });
    if (notice) return { result: { gate, status: 'exempt', notices: [notice], rules: [], generated: {} }, exitCode: 0, options };
    const baseRef = options.base ?? 'origin/main';
    const labelsEnv = gate === 'done' ? config.rules['DOD-10'].params.env : 'PR_LABELS';
    const snap = () => repositorySnapshot(root, baseRef, { env, labelsEnv });
    const io = { write: (path, text) => writeFileSync(join(root, path), text), refresh: snap,
      template: () => readFileSync(join(root, config.delivery.handoff.template), 'utf8'),
      gates: () => options.noPlan ? null : checkPlanGates(root, baseRef) };
    const result = gate === 'ready' ? runReady(config, snap(), options, io) : runDone(config, snap(), options, io);
    if (options.out) {
      const files = gate === 'done' ? (options.write ? {} : result.generated.files ?? {})
        : { ...(result.refinement ? { 'refinement-brief.md': refinementMarkdown(result) } : {}), ...(result.generated.scaffolded?.length && !options.write ? { [result.handoff]: result.generated.handoffText } : {}) };
      result.generated.out = writeOut(root, options.out, files);
    }
    return { result, exitCode: ['ready', 'done'].includes(result.status) ? 0 : 1, options };
  } catch (error) {
    if (!['DELIVERY_USAGE', 'DELIVERY_CONFIG_INVALID', 'DELIVERY_BASE_UNRESOLVED'].includes(error.code)) throw error;
    return { result: { gate, status: 'error', error: error.message, rules: [], generated: {} }, exitCode: 2, options: options ?? {}, usage: error.code === 'DELIVERY_USAGE' ? usage(gate) : null };
  }
}

/** Process entry: prints the report, appends the summary and sets the exit code. */
export async function main(gate, args = process.argv.slice(2)) {
  const outcome = await runGate(gate, args);
  if (outcome.help) { console.log(outcome.help); return; }
  const { result, options } = outcome;
  const printable = { ...result, generated: { ...result.generated, files: undefined, handoffText: undefined } };
  if (options.json) console.log(JSON.stringify(jsonReport(printable), null, 2));
  else (outcome.exitCode === 2 ? console.error : console.log)(humanReport(printable) + (outcome.usage ? `\n\n${outcome.usage}` : ''));
  if (options.summary) appendFileSync(options.summary, summaryMarkdown(printable) + '\n');
  process.exitCode = outcome.exitCode;
}
