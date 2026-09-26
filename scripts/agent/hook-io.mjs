/** Shared plumbing for coding-agent hooks (Claude Code command hooks and similar tools).
 * Hooks read one JSON document on stdin, must stay fast and must never print unbounded logs. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** PostToolUse events carry the edited file's content, so large edits need a generous bound. */
export const MAX_INPUT = 20 * 1024 * 1024;
/** Set on an event whose stdin could not be used; hooks must say so instead of silently doing nothing. */
const INPUT_PROBLEM = Symbol('hook input problem');
export function inputProblem(input) { return input?.[INPUT_PROBLEM] ?? null; }
const unusable = reason => ({ [INPUT_PROBLEM]: reason });
/** Parse the hook's stdin JSON. No input is an empty event; an oversized or malformed document is an
 * event marked with INPUT_PROBLEM (never a crash, never mistaken for "nothing to do"). */
export function parseHookInput(text, length = typeof text === 'string' ? text.length : 0) {
  if (length > MAX_INPUT) return unusable(`hook input exceeds ${MAX_INPUT / 1024 / 1024} MB`);
  if (typeof text !== 'string' || !text.trim()) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : unusable('hook input is not a JSON object');
  } catch { return unusable('hook input is not valid JSON'); }
}
export async function readHookInput(stream = process.stdin) {
  if (stream.isTTY) return {};
  let text = ''; let length = 0;
  // Keep draining an oversized document (the writer must not see a broken pipe) without retaining it.
  for await (const chunk of stream) { length += chunk.length; if (length <= MAX_INPUT) text += chunk; }
  return parseHookInput(length > MAX_INPUT ? '' : text, length);
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
