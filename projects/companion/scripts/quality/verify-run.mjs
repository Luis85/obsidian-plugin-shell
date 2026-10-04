/** Sequential step executor with fail-fast or keep-going semantics. The executor is injected. */
const captureLimit = 65_536;

/** Bounded tail of everything a step wrote; the end of the output is what explains a failure. */
function createCapture(forward) {
  let text = '';
  return { write(chunk) { text = (text + chunk).slice(-captureLimit); forward?.(chunk); }, text: () => text };
}
const round = ms => Math.round(ms);
const base = step => ({ id: step.id, command: step.display });
const notRun = (step, reason) => ({ ...base(step), status: 'not-run', durationMs: 0, exitCode: null, reason });
const skipped = (step, reason) => ({ ...base(step), status: 'skipped', durationMs: 0, exitCode: null, reason });

async function runOne(step, { execute, clock, tail, forward }) {
  const capture = createCapture(forward), started = clock();
  try {
    await execute(step, capture.write);
    return { ...base(step), status: 'passed', durationMs: round(clock() - started), exitCode: 0 };
  } catch (error) {
    const exitCode = typeof error?.exitCode === 'number' ? error.exitCode : null;
    const reason = error instanceof Error ? error.message : String(error);
    return { ...base(step), status: 'failed', durationMs: round(clock() - started), exitCode, reason, outputTail: tail(capture.text() || reason) };
  }
}
async function decide({ step, action, reason }, state, options) {
  if (action === 'skip') return skipped(step, reason);
  if (options.isCancelled()) return notRun(step, 'cancelled');
  if (state.firstFailure && !options.keepGoing) return notRun(step, `not reached: ${state.firstFailure} failed (use --keep-going to run independent steps)`);
  const dependency = step.needs.find(id => state.blocked.has(id));
  if (dependency) return skipped(step, `dependency ${dependency} did not pass`);
  options.onStart?.(step);
  return runOne(step, options);
}
/** A failed step, or one skipped because a dependency did not pass, blocks its dependents; a --skip never does. */
function record(state, { step, action }, outcome) {
  if (outcome.status === 'failed') state.firstFailure ??= step.id;
  if (outcome.status === 'failed' || (outcome.status === 'skipped' && action === 'run')) state.blocked.add(step.id);
}
/**
 * plan: output of planSteps. Steps unselected by --only get no outcome (the result records them under
 * data.selection). Statuses: passed | failed | skipped (--skip, or a dependency did not pass) | not-run
 * (not reached after a fail-fast stop, or cancelled).
 */
export async function runPlan(plan, { execute, keepGoing = false, clock = () => performance.now(), tail = text => text, forward, isCancelled = () => false, onStart }) {
  const outcomes = [], state = { blocked: new Set(), firstFailure: null };
  const options = { execute, keepGoing, clock, tail, forward, isCancelled, onStart };
  for (const item of plan.filter(entry => entry.action !== 'unselected')) {
    const outcome = await decide(item, state, options);
    record(state, item, outcome);
    outcomes.push(outcome);
  }
  return outcomes;
}
