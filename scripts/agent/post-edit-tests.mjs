/** Agent PostToolUse hook for Edit/Write: run only the project tests related to the edited file.
 * Exit 0 = passed or nothing to run (silent). Exit 2 = related tests failed; stderr is the bounded
 * failure summary, which Claude Code shows to the agent (the edit itself already happened).
 * Exit 1 = the hook could not run (missing dependencies, timeout); a non-blocking notice. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedOutput, inputProblem, projectRootFor, readHookInput } from './hook-io.mjs';
import { codeRoots } from '../shared/project-roots.mjs';

const code = /\.(?:[cm]?[jt]s|vue)$/;
const TIMEOUT_MS = 120_000;
/** src/ and tests/ plus the product roots named in tsconfig.project.json (custom generated folders). */
export function watchedRoots(root) {
  return codeRoots(root);
}
/** The project-relative path to test for this hook event, or null when the hook has nothing to do. */
export function editedTarget(input) {
  const path = input?.tool_input?.file_path;
  if (typeof path !== 'string' || !code.test(path)) return null;
  const file = isAbsolute(path) ? path : resolve(typeof input.cwd === 'string' ? input.cwd : process.cwd(), path);
  const root = projectRootFor(dirname(file));
  if (!root) return null;
  const local = relative(root, file).split(sep).join('/');
  if (!local || local.startsWith('../') || local.split('/').some(part => part === 'node_modules' || part.startsWith('.'))) return null;
  if (!watchedRoots(root).some(base => local === base || local.startsWith(`${base}/`))) return null;
  return { root, file: local };
}
export function relatedArguments(file) {
  return ['node_modules/vitest/vitest.mjs', 'related', file, '--run', '--config', 'vitest.project.config.mjs', '--passWithNoTests', '--reporter=agent'];
}
/** Map a finished Vitest run to the hook's exit code and message. */
export function postEditOutcome(target, run) {
  if (run.error || run.signal) return { code: 1, message: `Related tests for ${target.file} did not finish (${run.error?.code ?? run.error?.message ?? run.signal}). Run: npx vitest related ${target.file} --run --config vitest.project.config.mjs` };
  if (run.status === 0) return { code: 0, message: '' };
  return { code: 2, message: `Tests related to ${target.file} fail after this edit (vitest related, exit ${run.status}). Fix the code or the test before continuing:\n${boundedOutput(`${run.stdout ?? ''}\n${run.stderr ?? ''}`)}` };
}
/** Unusable hook input is reported, never mistaken for "no related tests" (exit 0 keeps the edit flowing). */
function unreadableInputOutcome(problem) {
  const message = `Related tests were NOT run: ${problem}. Run npm run check -- --fast to cover this edit.`;
  return { code: 0, message, stdout: JSON.stringify({ systemMessage: message, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message } }) };
}
async function runHook(input) {
  const problem = inputProblem(input);
  if (problem) return unreadableInputOutcome(problem);
  const target = editedTarget(input);
  if (!target) return { code: 0, message: '' };
  if (!existsSync(join(target.root, 'node_modules/vitest/vitest.mjs'))) return { code: 1, message: 'Vitest is not installed in this project; run npm ci.' };
  const run = spawnSync(process.execPath, relatedArguments(target.file), { cwd: target.root, encoding: 'utf8', timeout: TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } });
  return postEditOutcome(target, run);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outcome = await runHook(await readHookInput());
  if (outcome.stdout) process.stdout.write(`${outcome.stdout}\n`);
  if (outcome.message) process.stderr.write(`${outcome.message}\n`);
  process.exitCode = outcome.code;
}
