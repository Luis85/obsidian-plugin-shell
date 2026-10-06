/** Agent SessionStart hook (framework checkout and generated projects): report the toolchain, make cloud sessions usable.
 * Stdout becomes the agent's context, so it is a short plain-text status (at most 10 lines). It never fails the session:
 * every problem is reported as text and the exit code is always 0. When everything is fine it is read-only and fast.
 *  - Node/npm: actual versus the qualified ones from .nvmrc, package.json engines and packageManager. A qualified install in
 *    a well-known place (or the Workbench cache) is put on PATH for the session (CLAUDE_ENV_FILE). In cloud sessions
 *    (CLAUDE_CODE_REMOTE=true) a missing qualified Node is downloaded, checksum-verified and cached under the user's cache
 *    directory with its pinned npm (session-node.mjs); SHELL_SESSION_START_NODE=0 never, =1 also locally.
 *  - Dependencies: a missing node_modules is restored with `npm ci --ignore-scripts` using that toolchain, in cloud sessions
 *    or when SHELL_SESSION_START_INSTALL=1; SHELL_SESSION_START_INSTALL=0 never installs.
 *  - Browser: reported through the shared resolver; in cloud sessions an older installed Chromium is adopted via
 *    SHELL_CHROMIUM and labelled non-pinned. Never downloads a browser.
 *  `--provision-only` (environment setup scripts) opts in to Node provisioning and installation regardless of the session kind. */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathFor, shellPath } from '../../src/shared/platform/platform-path.mjs';
import { packageRootFor, readHookInput } from './hook-io.mjs';
import { browserLine, loadResolver } from './session-browser.mjs';
import { dependencyLine, installDependencies, stale } from './session-install.mjs';
import { cachedNodeBin, nodeProvisionDecision, pinNpm, provisionNode } from './session-node.mjs';
import { bundledNpm, realNodeIo } from './session-node-io.mjs';
import { exportPath, exportVariable, findQualifiedNode, pathNpm, toolLine } from './session-toolchain.mjs';
import { qualifiedToolchain, readText, sameVersion } from './session-version.mjs';

const MAX_LINES = 10;
/** Everything the hook does must end inside Claude Code's 600 s SessionStart timeout. */
const BUDGET_MS = 570_000;
const platformOf = deps => deps.platform ?? process.platform;
const pathPhrase = (deps, env, directory) => deps.exportPath(env, directory) ? 'put first on PATH for this session' : `run: export PATH="${shellPath(directory, platformOf(deps))}:$PATH"`;
/** The qualified Node's bin directory (found or provisioned) and the status line explaining how. */
async function resolveNode(qualified, env, deps) {
  const found = deps.findNode(qualified.node, { env, home: deps.home, platform: platformOf(deps) });
  if (found) return { directory: found, line: `Qualified Node ${qualified.node} found at ${found}; ${pathPhrase(deps, env, found)}.` };
  const hint = `No qualified Node ${qualified.node} found in known locations; install it (nvm install ${qualified.node}).`;
  const decision = nodeProvisionDecision(env);
  if (!decision.provision) return { directory: null, line: `${hint} Not downloading it (${decision.why}).` };
  const outcome = await deps.provisionNode(qualified, env);
  if (!outcome.ok) return { directory: null, line: `${hint} Provisioning failed, nothing is qualified: ${outcome.text}.` };
  return { directory: outcome.binDirectory, line: `Qualified Node ${qualified.node} provisioned at ${outcome.binDirectory} (${outcome.text}); ${pathPhrase(deps, env, outcome.binDirectory)}.` };
}
/** npm inside the Workbench cache is ours to pin (a download with an unpinned npm, or an earlier failed pin); any other npm is never touched. */
function pinPrivateNpm(qualified, env, deps, directory) {
  const cache = directory && qualified.npm ? deps.cacheBin(qualified.node, env) : '';
  const { resolve: resolvePath } = pathFor(platformOf(deps));
  const ours = Boolean(cache) && resolvePath(directory) === resolvePath(cache);
  if (!ours || !nodeProvisionDecision(env).provision || sameVersion(deps.npmVersion(directory), qualified.npm)) return null;
  const outcome = deps.pinNpm(qualified, env, directory);
  return outcome.ok ? null : `npm: ${outcome.text}.`;
}
/** Build the status text. `deps` carries every side effect so tests can fake the file system, processes and environment. */
export async function sessionStatus(root, env, deps) {
  const qualified = qualifiedToolchain(root, deps.read, platformOf(deps));
  const lines = [`Session toolchain (${root}):`];
  let directory = null;
  lines.push(toolLine('Node', deps.nodeVersion, qualified.node, qualified.nodeRange));
  if (qualified.node && !sameVersion(deps.nodeVersion, qualified.node)) {
    const resolved = await resolveNode(qualified, env, deps);
    directory = resolved.directory;
    lines.push(resolved.line);
  }
  const pinNote = pinPrivateNpm(qualified, env, deps, directory ?? (qualified.node && sameVersion(deps.nodeVersion, qualified.node) ? deps.nodeBin : null));
  if (pinNote) lines.push(pinNote);
  lines.push(toolLine(directory ? 'npm (with the qualified Node)' : 'npm', deps.npmVersion(directory), qualified.npm, qualified.npmRange));
  const budget = (deps.remaining ?? (() => BUDGET_MS))() - 10_000;
  for (const line of [dependencyLine(root, env, directory, deps, budget), browserLine(deps.resolveBrowser, root, env, deps.exportVariable)]) if (line) lines.push(line);
  return lines.slice(0, MAX_LINES).join('\n');
}
async function realDeps(root, deadline = Date.now() + BUDGET_MS) {
  const home = homedir();
  const remaining = () => deadline - Date.now();
  const provision = (qualified, env) => provisionNode({ version: qualified.node, npm: qualified.npm, env, home, platform: process.platform, arch: process.arch, distBase: env.SHELL_NODE_DIST || undefined, remaining, token: `${process.pid}-${Date.now()}` }, realNodeIo({ env }));
  const pin = (qualified, env, directory) => pinNpm(directory, dirname(directory), { npm: qualified.npm, env, remaining, platform: process.platform }, realNodeIo({ env }));
  return { platform: process.platform, read: readText, nodeVersion: process.versions.node, nodeBin: dirname(process.execPath), cacheBin: (version, env) => cachedNodeBin(version, { env, home }) ?? '', pinNpm: pin, npmVersion: directory => directory ? bundledNpm(directory) : bundledNpm(dirname(process.execPath)) ?? pathNpm(), home, exists: existsSync, stale,
    findNode: findQualifiedNode, exportPath, exportVariable, install: installDependencies, provisionNode: provision, remaining,
    resolveBrowser: await loadResolver(resolve(dirname(fileURLToPath(import.meta.url)), '../..')) };
}
/** Environment setup scripts: provision and install regardless of the session kind, unless explicitly switched off. */
export const provisionEnvironment = env => ({ ...env, SHELL_SESSION_START_NODE: env.SHELL_SESSION_START_NODE ?? '1', SHELL_SESSION_START_INSTALL: env.SHELL_SESSION_START_INSTALL ?? '1' });
export async function runSessionStart(input, env = process.env, makeDeps = realDeps) {
  try {
    const start = typeof input?.cwd === 'string' ? input.cwd : env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const root = packageRootFor(env.CLAUDE_PROJECT_DIR ?? start) ?? packageRootFor(start);
    if (!root) return 'Session toolchain: no package.json found; nothing to check.';
    return await sessionStatus(root, env, await makeDeps(root));
  } catch (error) {
    return `Session toolchain: the start-up check itself failed (${error?.message ?? error}); the session continues.`;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const provisionOnly = process.argv.includes('--provision-only');
  const input = provisionOnly ? {} : await readHookInput().catch(() => ({}));
  process.stdout.write(`${await runSessionStart(input, provisionOnly ? provisionEnvironment(process.env) : process.env)}\n`);
  process.exitCode = 0;
}
