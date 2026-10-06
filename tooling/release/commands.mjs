/** Injectable process runner shared by release branch, cut and publish tooling. No shell is involved. */
import { spawnSync } from 'node:child_process';

/** run(command, args, { cwd, input }) => { status, stdout, stderr, error }; status is null when it could not start. */
export function createRunner({ spawn = spawnSync, cwd = process.cwd(), env = process.env } = {}) {
  return (command, args, options = {}) => {
    const result = spawn(command, args, { cwd: options.cwd ?? cwd, input: options.input, env, encoding: 'utf8',
      windowsHide: true, timeout: options.timeout ?? 300000, maxBuffer: 64 * 1024 * 1024 });
    return { status: result.error ? null : result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.code };
  };
}

/** First stderr line with any URL credentials removed; enough to diagnose without echoing secrets. */
export function safeDetail(result) {
  const line = String(result?.stderr ?? '').split('\n').find(item => item.trim()) ?? result?.error ?? '';
  return line.replace(/https?:\/\/[^\s/@]+@/g, 'https://***@').replace(/\b(gh[pousr]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,})\b/g, '***').slice(0, 300);
}

export function gitText(run, args, code = 'GIT_COMMAND_FAILED') {
  const result = run('git', args);
  if (result.status !== 0) throw Object.assign(new Error(`${code}: git ${args[0]} ${safeDetail(result)}`.trim()), { result });
  return result.stdout.trim();
}
export function gitSucceeds(run, args) { return run('git', args).status === 0; }
