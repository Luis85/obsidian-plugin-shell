/** Agent Stop hook: the turn may end only when the fast gate passes for the uncommitted work
 * (`npm run -s check -- --fast --base HEAD`; a long-lived branch diff belongs to `check --plan` and CI, not to every stop).
 * Exit 2 blocks the stop and hands the bounded failure summary (stderr) back to the agent.
 * When the agent is already continuing because of this hook (`stop_hook_active`), a second failure no
 * longer blocks: it is reported to the user as a systemMessage so an unfixable state cannot loop.
 * A check that exceeds the time budget is reported, never blocking: an unfinished run is not a failure to fix. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedOutput, inputProblem, npmCommand, packageRootFor, packageScripts, projectRootFor, readHookInput } from './hook-io.mjs';
import { hookTimeout, runInProcessGroup } from './process-group.mjs';
import { qualifiedEnv } from './session-toolchain.mjs';

const TIMEOUT_MS = 300_000;
const CHECK_ARGS = ['run', '-s', 'check', '--', '--fast', '--base', 'HEAD'];
const LABEL = 'npm run check -- --fast --base HEAD';
export function stopOutcome(input, run, timeoutMs = TIMEOUT_MS) {
  // Unreadable input may have lost stop_hook_active: never block (no loop), but still run and report.
  const problem = inputProblem(input);
  const notice = problem ? `Stop hook input could not be read (${problem}); the fast check ran without blocking. ` : '';
  if (!run.error && !run.signal && run.status === 0) return { code: 0, stdout: notice ? JSON.stringify({ systemMessage: `${notice}It passed.` }) : '', stderr: '' };
  const detail = run.error || run.signal ? `did not finish (${run.error?.code ?? run.error?.message ?? run.signal})` : `failed (exit ${run.status})`;
  const summary = `${LABEL} ${detail}:\n${boundedOutput(`${run.stdout ?? ''}\n${run.stderr ?? ''}`)}`;
  if (run.error?.code === 'ETIMEDOUT') {
    return { code: 0, stdout: JSON.stringify({ systemMessage: `${notice}The fast check did not finish within ${timeoutMs / 1000}s, so this stop was not gated. Run ${LABEL} (or node bin/app check --plan) before handing over.\n${summary}` }), stderr: '' };
  }
  if (input?.stop_hook_active === true || problem) {
    return { code: 0, stdout: JSON.stringify({ systemMessage: `${notice || 'The fast check still fails after one retry; stopping anyway.\n'}${summary}` }), stderr: '' };
  }
  return { code: 2, stdout: '', stderr: `Do not finish yet. ${summary}\nFix the failures (or explain precisely why they are unrelated to this change), then re-run ${LABEL}.` };
}
/** A generated project (vitest config present), else the framework checkout itself: nearest package.json that defines `check`. */
function hookRoot(input, env) {
  const starts = [typeof input?.cwd === 'string' ? input.cwd : process.cwd(), env.CLAUDE_PROJECT_DIR ?? process.cwd()];
  const project = starts.map(start => projectRootFor(start)).find(Boolean);
  if (project) return project;
  return starts.map(start => packageRootFor(start)).find(root => root && packageScripts(root).check) ?? null;
}
async function runHook(input, env = process.env) {
  const root = hookRoot(input, env);
  if (!root || !packageScripts(root).check) return { code: 0, stdout: '', stderr: '' };
  const toolchain = qualifiedEnv(root, env);
  const npm = npmCommand(CHECK_ARGS, toolchain);
  const timeout = hookTimeout(env, 'SHELL_STOP_CHECK_TIMEOUT_MS', TIMEOUT_MS);
  // Own process group: on timeout the whole npm tree ends, not only npm.
  const run = await runInProcessGroup(npm.command, npm.args, { cwd: root, timeout, shell: npm.shell, env: { ...toolchain, FORCE_COLOR: '0' } });
  return stopOutcome(input, run, timeout);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outcome = await runHook(await readHookInput());
  if (outcome.stdout) process.stdout.write(`${outcome.stdout}\n`);
  if (outcome.stderr) process.stderr.write(`${outcome.stderr}\n`);
  process.exitCode = outcome.code;
}
