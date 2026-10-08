/** Local filesystem/process adapters. Subprocess output is withheld from diagnostics. */
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { identity, MemoryError, object, requireThat, type Identity, type JsonObject } from './policy.ts';
export interface Paths { home: string; state: string; config: string; venv: string; python: string; runtime: string; installer: string }
export function paths(home = homedir()): Paths {
  const state = join(home, '.hindsight', 'obsidian-shell'); const venv = join(state, 'venv'); const runtime = join(state, 'runtime');
  return { home, state, config: join(home, '.hindsight', 'coding-agent.json'), venv, python: join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), runtime, installer: join(runtime, 'node_modules/@vectorize-io/hindsight-coding-agents/dist/installer.js') };
}
export function run(command: string, args: string[], options: { cwd?: string; input?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}): string {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: false, timeout: options.timeout ?? 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, ...options });
  requireThat(!result.error && result.status === 0, 'PROCESS_FAILED', 'A required subprocess failed or timed out. Check prerequisites locally; raw output is withheld to protect credentials.');
  return result.stdout;
}
export function git(root: string, args: string[]): string {
  return run('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-C', root, ...args], { env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }).trim();
}
export function repository(cwd: string): Identity {
  const root = realpathSync(git(cwd, ['rev-parse', '--show-toplevel']));
  const common = realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  let remote = ''; try { remote = git(root, ['remote', 'get-url', 'origin']); } catch { /* local repository */ }
  const list = run('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z']); const main = list.split('\0')[0]?.replace(/^worktree /, '');
  return { ...identity(root, common, remote), mainRoot: main ? realpathSync(main) : root };
}
export function noSymlink(path: string): void {
  let current = resolve(path);
  while (true) {
    try { requireThat(!lstatSync(current).isSymbolicLink(), 'UNSAFE_PATH', 'Refusing a symlink in a managed configuration path.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const parent = dirname(current); if (parent === current) return; current = parent;
  }
}
export function readText(path: string): string | null {
  noSymlink(path); if (!existsSync(path)) return null;
  requireThat(lstatSync(path).isFile() && lstatSync(path).size <= 1024 * 1024, 'CONFIG_INVALID', 'Expected a regular configuration file below 1 MiB.');
  return readFileSync(path, 'utf8');
}
export function readConfig(path: string): { data: JsonObject; original: string | null } {
  const original = readText(path); if (original === null) return { data: {}, original };
  try { return { data: object(JSON.parse(original)), original }; }
  catch (error) { if (error instanceof MemoryError) throw error; throw new MemoryError('CONFIG_INVALID', 'Existing JSON is invalid and was preserved.'); }
}
export function saveText(path: string, text: string, expected: string | null): void {
  noSymlink(path); requireThat(readText(path) === expected, 'CONFIG_CHANGED', 'Configuration changed while planning; re-plan.');
  if (text === expected) return;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.shell-tmp-${randomUUID()}`; const fd = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(fd, text);
    if (expected !== null) writeFileSync(`${path}.shell-backup-${randomUUID()}`, expected, { flag: 'wx', mode: 0o600 });
    closeSync(fd); requireThat(readText(path) === expected, 'CONFIG_CHANGED', 'Concurrent edit detected; existing config was preserved.'); renameSync(temporary, path);
  } catch (error) { try { closeSync(fd); } catch { /* closed */ } if (existsSync(temporary)) unlinkSync(temporary); throw error; }
}
export function saveConfig(path: string, data: JsonObject, expected: string | null): void { saveText(path, `${JSON.stringify(data, null, 2)}\n`, expected); }
export function locked<T>(state: string, operation: () => T): T {
  noSymlink(state); mkdirSync(state, { recursive: true, mode: 0o700 }); const path = join(state, 'operation.lock'); let fd: number;
  try { fd = openSync(path, 'wx', 0o600); } catch { throw new MemoryError('BUSY', 'Another memory operation is running. Verify no operation is active before removing a stale lock.'); }
  try { writeFileSync(fd, String(process.pid)); return operation(); } finally { closeSync(fd); unlinkSync(path); }
}
export function backend(p: Paths, command: string, payload: JsonObject = {}): JsonObject {
  requireThat(existsSync(p.python), 'NOT_INSTALLED', 'Install the optional Python environment first.');
  const script = fileURLToPath(new URL('./embedded.py', import.meta.url));
  const settings = readConfig(join(p.state, 'provider.json')).data;
  const result = spawnSync(p.python, [script, command], { input: JSON.stringify({ ...payload, settings }), encoding: 'utf8', shell: false, windowsHide: true, timeout: command === 'probe' ? 10000 : 600000, maxBuffer: 4 * 1024 * 1024 });
  requireThat(!result.error, 'BACKEND_TIMEOUT', 'The Python adapter could not finish; check the local profile.');
  let data: JsonObject;
  try { data = object(JSON.parse(result.stdout)); } catch { throw new MemoryError('BACKEND_PROTOCOL', 'The Python adapter did not return valid JSON.'); }
  requireThat(result.status === 0 && data.ok === true, typeof data.code === 'string' && /^[A-Z_]+$/.test(data.code) ? data.code : 'BACKEND_FAILED', 'Memory backend failed. Run memory doctor; no provider error text is exported.');
  return data;
}
export function npmCommand(args: string[]): { command: string; args: string[] } {
  if (process.env.npm_execpath?.endsWith('npm-cli.js')) return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  if (process.platform !== 'win32') return { command: 'npm', args };
  const cli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'); requireThat(existsSync(cli), 'NPM_NOT_FOUND', 'Use npm run memory on Windows so npm is available.');
  return { command: process.execPath, args: [cli, ...args] };
}
