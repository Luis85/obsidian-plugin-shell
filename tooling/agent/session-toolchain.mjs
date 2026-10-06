/** Finding and exposing the qualified toolchain for the session hooks (status lines, PATH and variable export). */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { pathFor, shellPath, withPathFirst } from '../../src/shared/platform/platform-path.mjs';
import { npmCommand } from './hook-io.mjs';
import { cachedNodeBin } from './session-node.mjs';
import { probeNode } from './session-node-io.mjs';
import { qualifiedToolchain, readText, satisfies, sameVersion, version } from './session-version.mjs';

/** One status line per tool: matches, satisfies only the engines range, or is outside it. */
export function toolLine(label, actual, qualified, range) {
  if (!actual) return `${label}: not found${qualified ? ` (qualified ${qualified})` : ''}.`;
  if (qualified && sameVersion(actual, qualified)) return `${label} ${actual}: qualified.`;
  const inRange = satisfies(actual, range);
  if (inRange === false) return `${label} ${actual}: UNQUALIFIED, outside engines ${range}${qualified ? ` (qualified ${qualified})` : ''}.`;
  if (qualified) return `${label} ${actual}: not the qualified ${qualified}${inRange ? ` (satisfies engines ${range})` : ''}; results may differ from the qualified toolchain.`;
  return `${label} ${actual}: no qualified version declared.`;
}
function unixCandidates(qualified, { env, home, platform }) {
  const { join } = pathFor(platform);
  return [`/opt/node${version(qualified)?.[0]}/bin`, cachedNodeBin(qualified, { env, home, platform }), join(env.NVM_DIR ?? join(home, '.nvm'), 'versions', 'node', `v${qualified}`, 'bin'),
    `/usr/local/n/versions/node/${qualified}/bin`, join(home, '.volta', 'tools', 'image', 'node', qualified, 'bin')];
}
/** Windows Node distributions keep node.exe at the root of the install, there is no `bin` directory. */
function windowsCandidates(qualified, { env, home, platform }) {
  const { join } = pathFor(platform);
  const volta = env.VOLTA_HOME || join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Volta');
  return [env.NVM_HOME && join(env.NVM_HOME, `v${qualified}`), join(env.ProgramFiles || 'C:\\Program Files', 'nodejs'), join(volta, 'tools', 'image', 'node', qualified)];
}
/** Directories that commonly hold another Node install, most specific first (the Workbench cache included). */
function nodeCandidates(qualified, context) {
  const known = context.platform === 'win32' ? windowsCandidates(qualified, context) : unixCandidates(qualified, context);
  return [context.env.SHELL_NODE_BIN, ...known].filter(Boolean);
}
/** A directory holding a node that is exactly the qualified version (`bin` on Unix, the install root on Windows), else null. */
export function findQualifiedNode(qualified, { env, home, platform = process.platform, exists = existsSync, probe = directory => probeNode(directory, spawnSync, platform) }) {
  if (!version(qualified)) return null;
  return nodeCandidates(qualified, { env, home, platform }).find(directory => exists(directory) && probe(directory) === qualified) ?? null;
}
/** Double-quote escaping for a path inside `export NAME="..."`. */
const quoted = text => text.replace(/[\\"$`]/g, '\\$&');
function appendEnvLine(env, line, append) {
  if (!env.CLAUDE_ENV_FILE) return false;
  try { append(env.CLAUDE_ENV_FILE, `${line}\n`); return true; } catch { return false; }
}
/** Persist the qualified Node for the session's later shell commands; false when no env file is offered. */
export const exportPath = (env, directory, append = appendFileSync, platform = process.platform) => appendEnvLine(env, `export PATH="${quoted(shellPath(directory, platform))}:$PATH"`, append);
/** Persist one variable (for example SHELL_CHROMIUM) for the session's later shell commands. */
export const exportVariable = (env, name, value, append = appendFileSync) => appendEnvLine(env, `export ${name}="${quoted(value)}"`, append);
/** npm as the PATH resolves it. */
export function pathNpm(run = spawnSync) {
  const npm = npmCommand(['--version'], {});
  const result = run(npm.command, npm.args, { encoding: 'utf8', timeout: 10000, shell: npm.shell });
  return result.status === 0 ? result.stdout.trim() : null;
}
/** The environment a hook should run project commands in: PATH led by the qualified Node when this process runs another one
 * and a qualified install exists. Hooks do not receive CLAUDE_ENV_FILE exports, so they look it up themselves. */
export function qualifiedEnv(root, env, running = process.versions.node, find = findQualifiedNode, home = env.HOME ?? env.USERPROFILE ?? '', platform = process.platform, read = readText) {
  const { node } = qualifiedToolchain(root, read, platform);
  if (!node || sameVersion(running, node)) return env;
  const directory = find(node, { env, home, platform });
  return directory ? withPathFirst(env, directory, platform) : env;
}
