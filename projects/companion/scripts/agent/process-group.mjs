/** Run a hook's command in its own process group so a timeout ends the whole tree, not just the direct child.
 * `spawnSync` with a timeout kills only the process it started: an npm run's grandchildren (test runners, servers) would
 * keep running for minutes. POSIX children are detached (own group) and the group is signalled; Windows uses
 * `taskkill /T /F`. The result mirrors spawnSync (`status`, `signal`, `error`, `stdout`, `stderr`) so callers keep their logic.
 * When the hook itself is terminated (its own timeout in Claude Code), the group is killed too. */
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const GRACE_MS = 2000;
const HOOK_SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP'];
/** A positive integer milliseconds override from the environment (test seam), else the default. */
export function hookTimeout(env, name, fallback) {
  const value = Number(env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
/** Signal every process of the child's group/tree. Returns false when nothing could be signalled. */
function terminateTree(child, signal, platform = process.platform) {
  if (!child.pid) return false;
  if (platform === 'win32') {
    spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).once('error', () => child.kill(signal));
    return true;
  }
  try { process.kill(-child.pid, signal); return true; } catch { return child.kill(signal); }
}
/** Kill the group when this process exits or is signalled while the child runs; returns the undo function. */
function guardTermination(child) {
  const onExit = () => terminateTree(child, 'SIGKILL');
  const handlers = HOOK_SIGNALS.map(name => [name, () => { release(); onExit(); process.kill(process.pid, name); }]);
  function release() { process.off('exit', onExit); for (const [name, handler] of handlers) process.off(name, handler); }
  process.once('exit', onExit);
  for (const [name, handler] of handlers) process.once(name, handler);
  return release;
}
const keepTail = (text, chunk, limit) => (text + chunk).slice(-limit);
/** @returns {Promise<{status:number|null, signal:string|null, error?:Error, stdout:string, stderr:string}>} */
export function runInProcessGroup(command, args, { cwd, env, timeout, shell = false, maxBuffer = 16 * 1024 * 1024 }) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env, shell, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const release = guardTermination(child);
    const timers = [];
    let stdout = ''; let stderr = ''; let error = null; let settled = false;
    const finish = (status, signal) => {
      if (settled) return;
      settled = true; release(); timers.forEach(clearTimeout);
      resolve({ status, signal, ...(error ? { error } : {}), stdout, stderr });
    };
    const later = (action, ms) => timers.push(setTimeout(action, ms));
    later(() => {
      error = Object.assign(new Error(`spawn ${command} ETIMEDOUT`), { code: 'ETIMEDOUT' });
      terminateTree(child, 'SIGTERM');
      later(() => { terminateTree(child, 'SIGKILL'); later(() => finish(null, 'SIGTERM'), GRACE_MS); }, GRACE_MS);
    }, timeout);
    for (const [stream, append] of [[child.stdout, chunk => { stdout = keepTail(stdout, chunk, maxBuffer); }], [child.stderr, chunk => { stderr = keepTail(stderr, chunk, maxBuffer); }]]) {
      stream.setEncoding('utf8'); stream.on('data', append);
    }
    child.once('error', failure => { error = failure; finish(null, null); });
    child.once('close', (status, signal) => {
      // Pipes close once the tree is gone; a final group kill removes stragglers that ignored SIGTERM.
      if (error?.code === 'ETIMEDOUT') terminateTree(child, 'SIGKILL');
      finish(status, signal);
    });
  });
}
