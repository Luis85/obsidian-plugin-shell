/** Browser readiness for the session status. Never downloads. Only in cloud sessions, a Chromium of another revision than
 * the pinned one is adopted (SHELL_CHROMIUM through CLAUDE_ENV_FILE), and the line says so: that evidence is not pinned. */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadResolver(root) {
  try { return (await import(pathToFileURL(join(root, 'src/cli/tooling/testing/browser-executable.mjs')).href)).resolveBrowserExecutable; } catch { return null; }
}
function mismatchLine(result, env, exportVariable) {
  const prefix = `Browser: REVISION MISMATCH (expects r${result.expectedRevision}, has ${result.availableRevisions.join(',')})`;
  const candidate = result.candidateExecutable;
  if (env.CLAUDE_CODE_REMOTE !== 'true' || !candidate) {
    return `${prefix}; browser suites report not-run. Opt in to the older build: SHELL_CHROMIUM=${candidate}`;
  }
  const adopted = exportVariable(env, 'SHELL_CHROMIUM', candidate);
  return adopted ? `${prefix}; SHELL_CHROMIUM=${candidate} exported for this session, so browser evidence uses a NON-PINNED Chromium (not the qualified revision).`
    : `${prefix}; browser suites report not-run. Cloud session without an env file: export SHELL_CHROMIUM=${candidate} to use the older, non-pinned build.`;
}
/** Browser readiness line; silent when the project has no Playwright dependency to resolve. */
export function browserLine(resolveBrowser, root, env, exportVariable) {
  if (!resolveBrowser) return null;
  const result = resolveBrowser({ env, root });
  if (result.reason === 'playwright-not-installed') return null;
  if (result.status === 'pinned') return `Browser: pinned Chromium r${result.expectedRevision} ready.`;
  if (result.status === 'override') return `Browser: SHELL_CHROMIUM override ${result.executablePath}.`;
  if (result.status === 'revision-mismatch') return mismatchLine(result, env, exportVariable);
  return `Browser: NOT READY. ${result.hint}`;
}
