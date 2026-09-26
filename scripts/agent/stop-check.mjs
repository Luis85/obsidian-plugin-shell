/** Agent Stop hook: the turn may end only when the fast project gate passes (`npm run -s check -- --fast`).
 * Exit 2 blocks the stop and hands the bounded failure summary (stderr) back to the agent.
 * When the agent is already continuing because of this hook (`stop_hook_active`), a second failure no
 * longer blocks: it is reported to the user as a systemMessage so an unfixable state cannot loop. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedOutput, npmCommand, packageScripts, projectRootFor, readHookInput } from './hook-io.mjs';

const TIMEOUT_MS = 300_000;
const CHECK_ARGS = ['run', '-s', 'check', '--', '--fast'];
export function stopOutcome(input, run) {
  if (!run.error && !run.signal && run.status === 0) return { code: 0, stdout: '', stderr: '' };
  const detail = run.error || run.signal ? `did not finish (${run.error?.code ?? run.error?.message ?? run.signal})` : `failed (exit ${run.status})`;
  const summary = `npm run check -- --fast ${detail}:\n${boundedOutput(`${run.stdout ?? ''}\n${run.stderr ?? ''}`)}`;
  if (input?.stop_hook_active === true) {
    return { code: 0, stdout: JSON.stringify({ systemMessage: `The fast check still fails after one retry; stopping anyway.\n${summary}` }), stderr: '' };
  }
  return { code: 2, stdout: '', stderr: `Do not finish yet. ${summary}\nFix the failures (or explain precisely why they are unrelated to this change), then re-run npm run check -- --fast.` };
}
function runHook(input, env = process.env) {
  const root = projectRootFor(typeof input?.cwd === 'string' ? input.cwd : process.cwd()) ?? projectRootFor(env.CLAUDE_PROJECT_DIR ?? process.cwd());
  if (!root || !packageScripts(root).check) return { code: 0, stdout: '', stderr: '' };
  const npm = npmCommand(CHECK_ARGS, env);
  const run = spawnSync(npm.command, npm.args, { cwd: root, encoding: 'utf8', timeout: TIMEOUT_MS, shell: npm.shell,
    maxBuffer: 16 * 1024 * 1024, env: { ...env, FORCE_COLOR: '0' } });
  return stopOutcome(input, run);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outcome = runHook(await readHookInput());
  if (outcome.stdout) process.stdout.write(`${outcome.stdout}\n`);
  if (outcome.stderr) process.stderr.write(`${outcome.stderr}\n`);
  process.exitCode = outcome.code;
}
