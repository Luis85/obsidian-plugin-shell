/** Shared plumbing for coding-agent hooks (Claude Code command hooks and similar tools).
 * Hooks read one JSON document on stdin, must stay fast and must never print unbounded logs. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MAX_INPUT = 1_000_000;
/** Parse the hook's stdin JSON; a malformed or oversized document is an empty event, not a crash. */
export function parseHookInput(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_INPUT) return {};
  try { const value = JSON.parse(text); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
export async function readHookInput(stream = process.stdin) {
  if (stream.isTTY) return {};
  let text = '';
  for await (const chunk of stream) { text += chunk; if (text.length > MAX_INPUT) return {}; }
  return parseHookInput(text);
}
/** Nearest ancestor (including `start`) that holds this generated project's package.json and Vitest config. */
export function projectRootFor(start) {
  let current = resolve(start);
  for (;;) {
    if (existsSync(join(current, 'package.json')) && existsSync(join(current, 'vitest.project.config.mjs'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
export function packageScripts(root) {
  try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {}; } catch { return {}; }
}
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g');
/** Plain text, blank-line collapsed, keeping the end where failure summaries are. */
export function boundedOutput(text, limit = 4000) {
  const plain = String(text ?? '').replace(ansi, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return plain.length > limit ? `…(truncated)\n${plain.slice(-limit)}` : plain;
}
/** npm as a node script when the caller runs under npm (no shell needed), else the platform's npm. */
export function npmCommand(args, env = process.env, platform = process.platform) {
  const npm = env.npm_execpath;
  if (npm && /\.[cm]?js$/.test(npm)) return { command: process.execPath, args: [npm, ...args], shell: false };
  return { command: platform === 'win32' ? 'npm.cmd' : 'npm', args, shell: platform === 'win32' };
}
