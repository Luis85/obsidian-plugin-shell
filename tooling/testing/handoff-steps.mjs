/** The steps of the project handoff qualification. Each takes the shared context and returns `{status, detail}` (or nothing for passed). */
import { existsSync, mkdirSync, readFileSync, readlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { auditTracked, parseIndex } from './handoff-audit.mjs';
import { applyEnvFile } from './handoff-options.mjs';
import { failure, run, tail } from './handoff-run.mjs';

const MINUTE = 60_000;
const notRun = detail => ({ status: 'not-run', detail });
const gitIn = (cwd, args, env) => run('git', args, { cwd, env, timeout: 5 * MINUTE });
const versionOf = text => /(\d+\.\d+\.\d+)/.exec(String(text ?? ''))?.[1] ?? null;

export function generate(context) {
  const created = run(process.execPath, [join(context.frameworkRoot, 'bin/app'), 'new', context.origin, '--starter', context.options.starter, '--yes'], { cwd: context.workDir, env: context.baseEnv, timeout: 10 * MINUTE });
  const bad = failure(created, 'bin/app new');
  if (bad) return { status: 'failed', detail: bad };
  const dirty = gitIn(context.origin, ['status', '--porcelain', '--ignored'], context.baseEnv).stdout.trim();
  if (dirty) return { status: 'failed', detail: `the generated project is not fully committed or generates ignored files:\n${tail(dirty)}` };
  return { detail: tail(created.stdout.split('\n').filter(line => /Starter|Files|Plan hash/.test(line)).join('\n')) };
}
/** The framework target: the committed HEAD of this checkout stands in for a pushed repository. */
export function frameworkSource(context) {
  const head = gitIn(context.frameworkRoot, ['rev-parse', 'HEAD'], context.baseEnv).stdout.trim();
  const dirty = gitIn(context.frameworkRoot, ['status', '--porcelain'], context.baseEnv).stdout.trim() !== '';
  return { detail: `clone of committed HEAD ${head.slice(0, 12)}${dirty ? ' (the working tree has uncommitted changes that are NOT part of this run)' : ''}` };
}
export function cloneOrigin(context) {
  const source = context.options.target === 'framework' ? context.frameworkRoot : context.origin;
  const cloned = gitIn(context.workDir, ['clone', '--quiet', '--no-hardlinks', source, context.clone], context.baseEnv);
  return failure(cloned, 'git clone') ? { status: 'failed', detail: failure(cloned, 'git clone') } : { detail: `${gitIn(context.clone, ['ls-files'], context.baseEnv).stdout.split('\n').filter(Boolean).length} tracked files` };
}
const readTracked = root => path => {
  try { return lstatSync(join(root, path)).isSymbolicLink() ? Buffer.from(readlinkSync(join(root, path))) : readFileSync(join(root, path)); } catch { return null; }
};
export function audit(context) {
  const entries = parseIndex(gitIn(context.clone, ['ls-files', '-s'], context.baseEnv).stdout);
  const forbidden = context.options.target === 'framework' ? [context.workDir] : [context.frameworkRoot, context.workDir];
  // A generated project copies framework files under the same paths; their existing text is not a generation leak.
  const original = context.options.target === 'framework' ? undefined : readTracked(context.frameworkRoot);
  const findings = auditTracked(entries, { read: readTracked(context.clone), forbidden, original });
  if (findings.length === 0) return { detail: `${entries.length} tracked files, no findings` };
  return { status: 'failed', detail: findings.slice(0, 12).map(item => `${item.check}${item.path ? ` ${item.path}` : ''}: ${item.detail}`).join('\n') + (findings.length > 12 ? `\n...and ${findings.length - 12} more` : '') };
}
/** SessionStart as a cloud session runs it; the exports it writes are replayed into the environment every later step uses. */
export function sessionStart(context) {
  if (context.offline) return notRun('offline: the hook downloads Node and the dependencies');
  mkdirSync(context.cacheDir, { recursive: true });
  const started = run('node', ['tooling/agent/session-start.mjs'], { cwd: context.clone, env: context.sessionEnv, input: '{}', timeout: 12 * MINUTE });
  const bad = failure(started, 'session-start');
  if (bad || started.stderr.trim()) return { status: 'failed', detail: bad ?? `session-start wrote to stderr: ${tail(started.stderr)}` };
  const exported = existsSync(context.envFile) ? readFileSync(context.envFile, 'utf8') : '';
  context.toolEnv = applyEnvFile(exported, context.sessionEnv);
  return { detail: `${tail(started.stdout)}\n[env file] ${exported.trim().split('\n').filter(Boolean).map(line => line.replace(/^export /, '').replace(/="?(.{0,60}).*$/, '=$1...')).join(' | ') || '(nothing exported)'}` };
}
const needsSession = context => context.toolEnv ? null : notRun('the session start did not run');
export function dependencies(context) {
  const missing = needsSession(context);
  if (missing) return missing;
  const present = existsSync(join(context.clone, 'node_modules/.package-lock.json'));
  return present ? { detail: 'node_modules restored by the session start' } : { status: 'failed', detail: 'node_modules is missing after the session start (npm ci did not complete)' };
}
export function toolchain(context) {
  const missing = needsSession(context);
  if (missing) return missing;
  const read = name => run(name, ['--version'], { cwd: context.clone, env: context.toolEnv, timeout: MINUTE });
  const actual = { node: versionOf(read('node').stdout), npm: versionOf(read('npm').stdout) };
  const wrong = ['node', 'npm'].filter(name => actual[name] !== context.expected[name]);
  const text = `node ${actual.node} (qualified ${context.expected.node}), npm ${actual.npm} (qualified ${context.expected.npm})`;
  return wrong.length ? { status: 'failed', detail: `not qualified: ${text}` } : { detail: text };
}
function command(label, args, minutes) {
  return context => {
    const missing = needsSession(context) ?? (context.toolEnv && !existsSync(join(context.clone, 'node_modules')) ? notRun('no node_modules') : null);
    if (missing) return missing;
    const result = run(args[0], args.slice(1), { cwd: context.clone, env: context.toolEnv, timeout: minutes * MINUTE });
    const bad = failure(result, label);
    if (bad) return { status: 'failed', detail: bad };
    return { detail: tail(result.stdout, 300) };
  };
}
export const check = command('npm run check', ['npm', 'run', '-s', 'check'], 30);
export const frameworkCheck = command('npm run check --fast', ['npm', 'run', '-s', 'check', '--', '--fast', '--base', 'HEAD'], 30);
/** `--json` commands must exit 0 and print one JSON document. */
export function jsonCommand(label, args) {
  return context => {
    const missing = needsSession(context);
    if (missing) return missing;
    const result = run('node', args, { cwd: context.clone, env: context.toolEnv, timeout: 5 * MINUTE });
    const bad = failure(result, label);
    if (bad) return { status: 'failed', detail: bad };
    try { JSON.parse(result.stdout); } catch { return { status: 'failed', detail: `${label} did not print JSON: ${tail(result.stdout, 300)}` }; }
    return { detail: `exit 0, ${result.stdout.length} bytes of JSON` };
  };
}
export function e2e(context) {
  const missing = needsSession(context);
  if (missing) return missing;
  if (context.options.skipE2e) return notRun('skipped by --skip-e2e');
  const browser = run('node', ['src/cli/tooling/testing/browser-executable.mjs', '--json'], { cwd: context.clone, env: context.toolEnv, timeout: MINUTE });
  if (browser.status !== 0) return notRun(`no usable browser: ${tail(browser.stdout, 400)}`);
  const kind = context.toolEnv.SHELL_CHROMIUM ? `SHELL_CHROMIUM ${context.toolEnv.SHELL_CHROMIUM} (non-pinned unless it is the pinned revision)` : 'the pinned Playwright Chromium';
  const result = run('npm', ['run', '-s', 'test:e2e'], { cwd: context.clone, env: context.toolEnv, timeout: 30 * MINUTE });
  const bad = failure(result, 'npm run test:e2e');
  return bad ? { status: 'failed', detail: bad } : { detail: `passed with ${kind}` };
}
/** A tracked tree stays clean after every earlier step, e2e included. */
export function cleanTree(context) {
  const status = gitIn(context.clone, ['status', '--porcelain'], context.baseEnv).stdout.trim();
  return status ? { status: 'failed', detail: `the commands left changes behind:\n${tail(status)}` } : { detail: 'git status --porcelain is empty' };
}
