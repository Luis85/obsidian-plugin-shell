/** Argument parsing and step selection for `npm run verify`. Pure: no I/O, no process state. */
export class UsageError extends Error {
  constructor(message, next) { super(message); this.name = 'UsageError'; this.next = next; }
}
const flags = new Set(['--json', '--keep-going', '--list', '--help']);
const valued = new Set(['--only', '--skip', '--report-dir']);

function splitIds(value, name) {
  const ids = value.split(',').map(id => id.trim()).filter(Boolean);
  if (!ids.length) throw new UsageError(`${name} needs a comma-separated list of step ids.`, 'Run: npm run verify -- --list');
  return ids;
}
function takeValue(argv, index, name) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new UsageError(`${name} needs a value.`, 'Run: npm run verify -- --help');
  return value;
}
function assign(options, name, value) {
  if (name === '--report-dir') options.reportDir = value;
  else options[name === '--only' ? 'only' : 'skip'].push(...splitIds(value, name));
}
/** Accepts `--only a,b` and `--only=a,b`; unknown options are errors, never silently ignored. */
export function parseVerifyArgs(argv) {
  const options = { json: false, keepGoing: false, list: false, help: false, only: [], skip: [], reportDir: 'reports/verify' };
  for (let index = 0; index < argv.length; index++) {
    const [name, inline] = argv[index].split(/=(.*)/s, 2);
    if (flags.has(name) && inline === undefined) { options[name === '--keep-going' ? 'keepGoing' : name.slice(2)] = true; continue; }
    if (!valued.has(name)) throw new UsageError(`Unknown option: ${argv[index]}`, 'Run: npm run verify -- --help');
    let value = inline;
    if (value === undefined) { value = takeValue(argv, index, name); index++; }
    assign(options, name, value);
  }
  return options;
}
function requireKnown(ids, byId, name) {
  const unknown = ids.filter(id => !byId.has(id));
  if (!unknown.length) return;
  const valid = [...byId.keys()].join(', ');
  throw new UsageError(`Unknown step id${unknown.length > 1 ? 's' : ''} in ${name}: ${unknown.join(', ')}. Valid ids: ${valid}.`, 'Run: npm run verify -- --list');
}
/** `--only` also selects every transitive dependency, because a dependent step is meaningless without its inputs. */
function withDependencies(ids, byId) {
  const chosen = new Set();
  const visit = id => { if (!chosen.has(id)) { chosen.add(id); byId.get(id).needs.forEach(visit); } };
  ids.forEach(visit);
  return chosen;
}
/**
 * Returns [{ step, action: 'run' | 'skip' | 'unselected', reason?, added? }] in table order.
 * A step excluded by `--skip` is reported `skipped`; it does not block dependents, because the caller
 * explicitly took responsibility for its output (for example an existing build).
 */
export function planSteps(steps, { only = [], skip = [] } = {}) {
  const byId = new Map(steps.map(step => [step.id, step]));
  requireKnown(only, byId, '--only');
  requireKnown(skip, byId, '--skip');
  const selected = only.length ? withDependencies(only, byId) : new Set(byId.keys());
  const skipped = new Set(skip);
  return steps.map(step => {
    if (!selected.has(step.id)) return { step, action: 'unselected' };
    if (skipped.has(step.id)) return { step, action: 'skip', reason: 'excluded by --skip' };
    return { step, action: 'run', ...(only.length && !only.includes(step.id) ? { added: true } : {}) };
  });
}
export const usage = `Usage: npm run verify -- [options]
  --json             print the versioned JSON result on stdout (step output goes to stderr)
  --keep-going       after a failure keep running independent steps; dependents are skipped
  --only a,b         run only these step ids plus the steps they depend on
  --skip a,b         do not run these step ids (dependents still run)
  --list             print step ids, commands and dependencies without executing
  --report-dir <dir> where summary.json and summary.md are written (default reports/verify)
  --help             show this text
Default: fail fast; the first failing step stops the run and later steps are reported not-run.`;
