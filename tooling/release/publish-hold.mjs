/**
 * The release pull request's own CI (`ci.yml`, `pull_request`) fails its "CI result" until "Release result" is
 * green on the head. When that run happened before the Release tier finished, nothing re-runs it: Publish marks
 * the pull request ready with GITHUB_TOKEN, which starts no workflows. Publish re-runs that stale hold itself.
 */
const holdCheckName = 'CI result';
const holdWorkflow = '.github/workflows/ci.yml';
const coded = (code, message) => Object.assign(new Error(message ? `${code}: ${message}` : code), { code });
export const defaultHoldWait = Object.freeze({ intervalMs: 15000, attempts: 40, sleep: ms => new Promise(done => setTimeout(done, ms)) });

/** The `pull_request` run of ci.yml whose latest "CI result" on `sha` is not green, or null. */
export async function staleHold(gh, sha) {
  const runs = (await gh.pages(`/commits/${sha}/check-runs?check_name=${encodeURIComponent(holdCheckName)}`, 'check_runs')).filter(item => item?.name === holdCheckName);
  const latest = new Map();
  for (const item of runs) {
    const suite = item.check_suite?.id;
    if (Number.isSafeInteger(suite) && Number.isSafeInteger(item.id) && !(latest.get(suite)?.id > item.id)) latest.set(suite, item);
  }
  for (const [suite, item] of [...latest].sort((a, b) => a[0] - b[0])) {
    if (item.status === 'completed' && item.conclusion === 'success') continue;
    const run = (await gh.api('GET', `/actions/runs?check_suite_id=${suite}`))?.workflow_runs?.find(entry => entry?.check_suite_id === suite);
    if (!run || run.path !== holdWorkflow || run.event !== 'pull_request' || run.head_sha !== sha) continue;
    if (!Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt)) throw coded('GITHUB_API_RESPONSE_INVALID');
    if (run.status === 'completed' && run.conclusion === 'success') continue; // the run itself is authoritative over a lagging check
    return { runId: run.id, attempt: run.run_attempt, running: run.status !== 'completed' };
  }
  return null;
}

/** Polls a workflow run until it completes at `minAttempt` or later; null when the wait budget ends first. */
export async function awaitRun(gh, runId, minAttempt, { intervalMs, attempts, sleep } = defaultHoldWait) {
  for (let tries = 0; tries < attempts; tries++) {
    const run = await gh.api('GET', `/actions/runs/${runId}`);
    if (run?.status === 'completed' && run.run_attempt >= minAttempt) return run;
    if (tries < attempts - 1) await sleep(intervalMs);
  }
  return null;
}

/** The wait budget from PUBLISH_HOLD_WAIT_SECONDS (whole seconds, default 600); 0 checks the run once. */
export function holdWaitFromEnvironment(value) {
  if (value === undefined || value === '') return defaultHoldWait;
  if (!/^\d{1,5}$/.test(value)) throw new Error('INVALID_HOLD_WAIT: PUBLISH_HOLD_WAIT_SECONDS must be whole seconds.');
  return { ...defaultHoldWait, attempts: Math.floor(Number(value) * 1000 / defaultHoldWait.intervalMs) + 1 };
}
