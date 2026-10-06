/** Read-only adapter for the official Obsidian CLI. No write/developer/plugin-management command is exposed. */
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import * as timers from 'node:timers';
import { isAbsolute, join } from 'node:path';
import { readConfiguration } from './files.ts';
import { readDocumentationSettings } from '../../documentation/adapters/settings.ts';
import { OperationError, requireThat, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { hasControls } from '../../domain/errors.ts';

const minimum = [1, 12, 7] as const;
const outputLimit = 4 * 1024 * 1024;
export interface ObsidianCliPort { run(args: readonly string[]): Promise<string> }
/** The process launcher; injectable so contract tests never need an installed Obsidian. */
export type ObsidianLaunch = (command: 'obsidian', args: string[], options: { cwd: string; shell: false; windowsHide: true; env: NodeJS.ProcessEnv; stdio: ['ignore', 'pipe', 'pipe'] }) => ChildProcessByStdio<null, Readable, Readable>;

function vaultSelector(request: Request): string {
  const value = stringOption(request.options, 'obsidian-vault');
  requireThat(value && value === value.trim() && value.length <= 200 && !value.includes('=') && !hasControls(value) && !value.startsWith('-'),
    'OBSIDIAN_VAULT_REQUIRED', 'Supply one explicit --obsidian-vault <name-or-id>; active-vault fallback is disabled.');
  return value;
}
function relativePath(value: string, kind: 'file'|'folder'): string {
  requireThat(value === value.trim() && value.length > 0 && value.length <= 1000 && !value.includes('\\') && !value.startsWith('/') &&
    !hasControls(value) && !value.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')),
    'OBSIDIAN_PATH_INVALID', 'Use a non-hidden vault-relative path without dot segments.');
  if (kind === 'file') requireThat(/\.md$/i.test(value), 'OBSIDIAN_PATH_INVALID', 'Only Markdown reads are exposed by this adapter.');
  return value;
}
function semanticVersion(text: string): string {
  const match = /(?:^|\D)(\d+)\.(\d+)\.(\d+)(?:\D|$)/.exec(text);
  requireThat(match, 'OBSIDIAN_VERSION_INVALID', 'The Obsidian CLI did not report a semantic version.');
  const actual = match.slice(1, 4).map(Number);
  const qualified = actual[0]! > minimum[0] || actual[0] === minimum[0] &&
    (actual[1]! > minimum[1] || actual[1] === minimum[1] && actual[2]! >= minimum[2]);
  requireThat(qualified, 'OBSIDIAN_VERSION_UNSUPPORTED', 'Obsidian CLI 1.12.7 or newer is required.');
  return actual.join('.');
}
function lines(text: string): string[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}
function integer(text: string, label: string): number {
  const value = Number(text.trim()); requireThat(Number.isSafeInteger(value) && value >= 0, 'OBSIDIAN_OUTPUT_INVALID', 'Invalid ' + label + ' count from Obsidian CLI.'); return value;
}
export function systemPort(context: Context, launch: ObsidianLaunch = spawn, timeoutMs = 30_000): ObsidianCliPort {
  return { run(args) {
    requireThat(args.length > 0 && args.length <= 16 && args.every(arg => typeof arg === 'string' && arg.length <= 4096 && !arg.includes('\0')),
      'OBSIDIAN_ARGUMENT_INVALID', 'Invalid Obsidian CLI argument.');
    return new Promise<string>((resolve, reject) => {
      const child = launch('obsidian', [...args], { cwd: context.root, shell: false, windowsHide: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = Buffer.alloc(0), stderrBytes = 0, settled = false, timedOut = false;
      const finish = (error?: Error, value?: string) => { if (settled) return; settled = true; timers.clearTimeout(timer); context.signal?.removeEventListener('abort', abort); if (error) reject(error); else resolve(value ?? ''); };
      const stop = () => { try { child.kill('SIGTERM'); } catch { /* process already closed */ } };
      const abort = () => { stop(); finish(new OperationError('CANCELLED', 'Obsidian CLI read cancelled.')); };
      const timer = timers.setTimeout(() => { timedOut = true; stop(); }, timeoutMs); timer.unref();
      context.signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length + chunk.length > outputLimit) { stop(); finish(new OperationError('OBSIDIAN_OUTPUT_LIMIT', 'Obsidian CLI output exceeded 4 MiB.')); return; }
        stdout = Buffer.concat([stdout, chunk]);
      });
      child.stderr.on('data', (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes > outputLimit) stop(); });
      child.once('error', (error: NodeJS.ErrnoException) => finish(new OperationError(error.code === 'ENOENT' ? 'OBSIDIAN_CLI_MISSING' : 'OBSIDIAN_CLI_FAILED',
        error.code === 'ENOENT' ? 'Official Obsidian CLI was not found on PATH. Enable Command line interface in Obsidian 1.12.7+.' : 'Obsidian CLI could not start.')));
      child.once('close', code => {
        if (settled) return;
        if (timedOut) return finish(new OperationError('OBSIDIAN_CLI_TIMEOUT', 'Obsidian CLI read timed out.'));
        if (code !== 0 || stderrBytes > outputLimit) return finish(new OperationError('OBSIDIAN_CLI_FAILED', 'Obsidian CLI read failed; raw stderr is not returned.'));
        try { finish(undefined, new TextDecoder('utf-8', { fatal: true }).decode(stdout)); }
        catch { finish(new OperationError('OBSIDIAN_OUTPUT_INVALID', 'Obsidian CLI returned invalid UTF-8.')); }
      });
      if (context.signal?.aborted) abort();
    });
  } };
}
async function qualified(port: ObsidianCliPort): Promise<string> { return semanticVersion(await port.run(['version'])); }
async function inVault(port: ObsidianCliPort, vault: string, command: string, ...args: string[]): Promise<string> {
  return port.run([`vault=${vault}`, command, ...args]);
}
function listedMarkdown(text: string): string[] {
  const unique = new Set<string>();
  for (const value of lines(text)) { const path = relativePath(value, 'file'); unique.add(path); }
  return [...unique].sort();
}
function under(path: string, root: string): boolean { return path === root || path.startsWith(root + '/'); }
function chunks<T>(values: T[], size: number): T[][] { const out:T[][]=[]; for(let i=0;i<values.length;i+=size) out.push(values.slice(i,i+size)); return out; }

const excluded = ['eval', 'dev:cdp', 'plugin:install', 'plugin:enable', 'restricted-mode changes'];
/** The vault path the CLI reports must be one bounded absolute path. */
function vaultLocation(text: string): string {
  const location = text.trim();
  requireThat(location.length > 0 && location.length <= 4096 && isAbsolute(location) && !hasControls(location),
    'OBSIDIAN_OUTPUT_INVALID', 'Selected vault path from Obsidian CLI is invalid.');
  return location;
}
async function statusRead(request: Request, port: ObsidianCliPort, vault: string, version: string) {
  const [name, path, files, folders] = await Promise.all([
    inVault(port, vault, 'vault', 'info=name'), inVault(port, vault, 'vault', 'info=path'),
    inVault(port, vault, 'files', 'total'), inVault(port, vault, 'folders', 'total'),
  ]);
  const location = vaultLocation(path);
  return result(request.command, { cli: { version, minimum: '1.12.7' }, vault: { selector: vault, name: name.trim(), path: location, files: integer(files, 'file'), folders: integer(folders, 'folder') },
    capabilities: { reads: ['vault', 'files', 'folders', 'read'], writes: [], excluded } });
}
async function filesRead(request: Request, port: ObsidianCliPort, vault: string, version: string) {
  const folder = stringOption(request.options, 'obsidian-folder');
  const args = [...(folder ? [`folder=${relativePath(folder, 'folder')}`] : []), 'ext=md'];
  return result(request.command, { cli: { version }, vault, folder: folder ?? null, files: listedMarkdown(await inVault(port, vault, 'files', ...args)) });
}
async function noteRead(request: Request, port: ObsidianCliPort, vault: string, version: string) {
  const path = stringOption(request.options, 'obsidian-path');
  requireThat(path, 'OBSIDIAN_PATH_REQUIRED', 'Supply --obsidian-path <note.md>.');
  const safe = relativePath(path, 'file');
  return result(request.command, { cli: { version }, vault, path: safe, content: await inVault(port, vault, 'read', `path=${safe}`) });
}
async function documentationRoots(context: Context): Promise<string[]> {
  const config = await readConfiguration(context.root);
  const protectedPaths = config ? [config.paths.codebaseFolder, config.paths.testsFolder, config.paths.testVaultFolder] : [];
  const { settings } = await readDocumentationSettings(context.root, protectedPaths);
  return [...new Set([settings.root, ...Object.values(settings.paths)])].map(root => relativePath(root, 'folder')).sort();
}
/** Reads each candidate once within the aggregate bound and classifies it as typed, untyped or invalid. */
async function classifyNotes(port: ObsidianCliPort, vault: string, candidates: string[]) {
  // The YAML-backed parser loads only for prepare, so the CLI catalog stays importable without installed packages.
  const { parseMarkdown } = await import('../../documentation/adapters/markdown.ts');
  const typed: string[] = [], untyped: string[] = [], invalid: string[] = []; let bytes = 0;
  for (const path of candidates) {
    const content = await inVault(port, vault, 'read', `path=${path}`); bytes += Buffer.byteLength(content);
    requireThat(bytes <= 16 * 1024 * 1024, 'OBSIDIAN_SCAN_LIMIT', 'Configured documentation scan exceeded 16 MiB.');
    try { (parseMarkdown(content, path) ? typed : untyped).push(path); } catch { invalid.push(path); }
  }
  return { typed, untyped, invalid };
}
async function prepareRead(request: Request, context: Context, port: ObsidianCliPort, vault: string, version: string) {
  const roots = await documentationRoots(context);
  const [vaultPathText, inventoryText] = await Promise.all([inVault(port, vault, 'vault', 'info=path'), inVault(port, vault, 'files', 'ext=md')]);
  const vaultPath = vaultLocation(vaultPathText);
  const candidates = listedMarkdown(inventoryText).filter(path => roots.some(root => under(path, root)));
  requireThat(candidates.length <= 500, 'OBSIDIAN_SCAN_LIMIT', 'Configured documentation paths contain more than 500 Markdown files; narrow the documentation settings.');
  const { typed, untyped, invalid } = await classifyNotes(port, vault, candidates);
  const imports = chunks(typed, 32).map(batch => ['node', 'bin/app', 'docs', 'import',
    ...batch.map(path => join(vaultPath, ...path.split('/'))), '--dry-run', '--json']);
  return result(request.command, { cli: { version, minimum: '1.12.7' }, vault: { selector: vault, path: vaultPath }, configuredRoots: roots,
    scan: { markdown: candidates.length, typed: typed.length, untyped: untyped.length, invalid: invalid.length, typedPaths: typed, invalidPaths: invalid },
    import: { operation: 'docs import', writesVault: false, reviewedPlanRequired: true, batches: imports,
      next: typed.length ? 'Run one proposed docs import command, review its plan, then apply that plan explicitly.' : 'No supported typed Markdown was found in the configured documentation paths.' },
    excluded });
}
const reads: Record<string, (request: Request, port: ObsidianCliPort, vault: string, version: string) => Promise<Result>> = { 'obsidian status': statusRead, 'obsidian files': filesRead, 'obsidian read': noteRead };
export async function obsidianRead(request: Request, context: Context, supplied?: ObsidianCliPort) {
  const port = supplied ?? systemPort(context), vault = vaultSelector(request), version = await qualified(port);
  if (Object.hasOwn(reads, request.command)) return reads[request.command]!(request, port, vault, version);
  requireThat(request.command === 'obsidian prepare', 'OBSIDIAN_COMMAND_DENIED', 'Only the documented read-only Obsidian adapter commands are allowed.');
  return prepareRead(request, context, port, vault, version);
}
