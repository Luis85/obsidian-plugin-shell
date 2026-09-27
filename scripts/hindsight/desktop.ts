/** Reviewed native MCP registration; preserves unrelated user settings and TOML text. */
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, object, requireThat, type Identity, type JsonObject } from './policy.ts';
import { launcherPlan, stageLauncher, type LauncherPlan } from './launcher.ts';
import { readText, readConfig, saveText, run, type Paths } from './io.ts';
export const CLIENTS = ['claude-code', 'codex', 'claude-desktop'] as const;
export type DesktopClient = typeof CLIENTS[number];
export function desktopClient(value: string): DesktopClient {
  requireThat(CLIENTS.some(c => c === value), 'CLIENT_REQUIRED', 'Choose --client claude-code, codex, or claude-desktop.'); return value as DesktopClient;
}
function configPath(p: Paths, client: DesktopClient, platform = process.platform): string {
  if (client === 'claude-code') return join(p.home, '.claude.json');
  if (client === 'codex') return join(process.env.CODEX_HOME || join(p.home, '.codex'), 'config.toml');
  requireThat(platform === 'darwin' || platform === 'win32', 'DESKTOP_PLATFORM', 'Claude Desktop chat configuration is supported on macOS/Windows; use the Code client on other systems.');
  return platform === 'darwin' ? join(p.home, 'Library/Application Support/Claude/claude_desktop_config.json') : join(process.env.APPDATA || join(p.home, 'AppData/Roaming'), 'Claude/claude_desktop_config.json');
}
export function mcpEntry(repo: Identity, client: DesktopClient, p: Paths): JsonObject {
  const script = join(launcherPlan(p).directory, 'cli.ts');
  const agent = client === 'codex' ? 'codex' : 'claude-code';
  return { command: process.execPath, args: ['--experimental-strip-types', script, 'mcp', '--agent', agent, ...(client === 'claude-desktop' ? ['--root', repo.root] : [])] };
}
function owned(value: unknown, p: Paths, expected: JsonObject): boolean {
  if (!value) return true;
  const entry = object(value);
  if (Object.keys(entry).some(key => !['command', 'args', 'type', 'env', 'startup_timeout_sec', 'tool_timeout_sec'].includes(key))) return false;
  if (entry.type !== undefined && entry.type !== 'stdio') return false;
  const env = object(entry.env ?? {});
  if (Object.keys(env).some(key => key !== 'HINDSIGHT_MCP_HARNESS')) return false;
  const oldNode = entry.command === 'node' || entry.command === process.execPath;
  const args = entry.args;
  if (!oldNode || !Array.isArray(args)) return false;
  if (isDeepStrictEqual(args, expected.args)) return true;
  if ([5, 7].includes(args.length) && args[0] === '--experimental-strip-types' && typeof args[1] === 'string'
      && args[2] === 'mcp' && args[3] === '--agent' && ['claude-code', 'codex'].includes(String(args[4]))) {
    const path = relative(join(p.state, 'launchers'), resolve(args[1])).replaceAll('\\', '/');
    if (/^[a-f0-9]{64}\/cli\.ts$/.test(path) && (args.length === 5 || (args[5] === '--root' && typeof args[6] === 'string'))) return true;
  }
  return args.length === 1 && [join(dirname(p.installer), 'mcp-server.js'), join(p.home, '.hindsight/coding-agents/dist/mcp-server.js')].includes(String(args[0]));
}
export function parseToml(text: string, python: string): JsonObject {
  return object(JSON.parse(run(python, ['-c', 'import json,sys,tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))'], { input: text })));
}
/** Removes only canonical owned MCP tables, verifies full semantic preservation by reparsing. */
export function replaceToml(text: string, name: string, entry: JsonObject | null, parse: (text: string) => JsonObject): string {
  const original = parse(text); const all = object(original.mcp_servers ?? {});
  const lines = text.split(/\r?\n/); let removing = false; let found = false;
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {
      removing = new RegExp(`^\\[mcp_servers\\.${name}(?:\\.[a-zA-Z0-9_-]+)*\\]\\s*(?:#.*)?$`).test(line.trim());
      if (removing) found = true;
    }
    if (!removing) kept.push(line);
  }
  requireThat(!Object.hasOwn(all, name) || found, 'CONFIG_CONFLICT', 'Noncanonical Codex MCP table syntax; preserve it and reconcile manually.');
  let addition = '';
  if (entry) addition = `\n[mcp_servers.${name}]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\nstartup_timeout_sec = 120\ntool_timeout_sec = 180\n`;
  const next = kept.join('\n').replace(/\n*$/, '\n') + addition;
  const wanted = structuredClone(original); const servers = { ...all };
  if (entry) servers[name] = { ...entry, startup_timeout_sec: 120, tool_timeout_sec: 180 }; else delete servers[name];
  if (Object.keys(servers).length) wanted.mcp_servers = servers; else delete wanted.mcp_servers;
  const actual = parse(next);
  if (actual.mcp_servers && !Object.keys(object(actual.mcp_servers)).length) delete actual.mcp_servers;
  requireThat(isDeepStrictEqual(actual, wanted), 'CONFIG_CONFLICT', 'Codex edit would change unrelated settings; no file was written.');
  return text.includes('\r\n') ? next.replace(/\n/g, '\r\n') : next;
}
export interface Connection { path: string; original: string | null; next: string; plan: JsonObject; launcher?: LauncherPlan; paths: Paths }
export function connection(repo: Identity, p: Paths, client: DesktopClient, remove = false, platform = process.platform): Connection {
  const path = configPath(p, client, platform); const original = readText(path); const entry = mcpEntry(repo, client, p);
  const name = client === 'claude-desktop' ? `hindsight-${repo.bank}` : 'hindsight';
  let next: string;
  if (client === 'codex') {
    requireThat(existsSync(p.python), 'NOT_INSTALLED', 'Install the isolated Python environment before editing Codex configuration.');
    const parse = (text: string) => parseToml(text, p.python); const existing = object(parse(original ?? '').mcp_servers ?? {});
    requireThat(owned(existing[name], p, entry), 'MCP_CONFLICT', 'An unrelated MCP server uses this name; nothing was replaced.');
    next = replaceToml(original ?? '', name, remove ? null : entry, parse);
  } else {
    const data = original === null ? {} : readConfig(path).data; const servers = object(data.mcpServers ?? {});
    requireThat(owned(servers[name], p, entry), 'MCP_CONFLICT', 'An unrelated MCP server uses this name; nothing was replaced.');
    const nextServers = { ...servers }; if (remove) delete nextServers[name]; else nextServers[name] = entry;
    next = `${JSON.stringify({ ...data, mcpServers: nextServers }, null, 2)}\n`;
  }
  return { path, original, next, paths: p, launcher: remove ? undefined : launcherPlan(p), plan: { schemaVersion: 1, operation: remove ? 'disconnect' : 'connect', client, config: path, server: name, entry: remove ? null : entry,
    planHash: digest(`${resolve(path)}\0${original}\0${next}`), effects: remove ? ['Remove only the owned MCP registration; retain hooks, provider and memory data.'] : ['Stage a content-fingerprinted launcher outside Git and change only this user-scope MCP entry, retaining unrelated settings.', 'Start the already installed local profile when an opted-in project opens this MCP server. No automatic install or login.', 'First cold start may exceed client timeout; run memory start --apply once, then restart the desktop app.'], next: 'Restart the desktop app. Host trust/permissions still apply.' } };
}
export function applyConnection(change: Connection): void {
  requireThat(readText(change.path) === change.original, 'CONFIG_CHANGED', 'Desktop configuration changed during review. Re-plan.');
  if (change.launcher) stageLauncher(change.paths, change.launcher);
  saveText(change.path, change.next, change.original);
}

/** Inspect registration without launching it; file presence is not desktop acceptance. */
export function connectionStatus(repo: Identity, p: Paths, client: DesktopClient): JsonObject {
  try {
    const path = configPath(p, client); const text = readText(path);
    if (text === null) return { client, state: 'MISSING', connected: false };
    const data = client === 'codex' ? parseToml(text, p.python) : readConfig(path).data;
    const name = client === 'claude-desktop' ? `hindsight-${repo.bank}` : 'hindsight';
    const entry = object(data[client === 'codex' ? 'mcp_servers' : 'mcpServers'] ?? {})[name];
    if (!entry) return { client, state: 'MISSING', connected: false };
    const expected = mcpEntry(repo, client, p);
    const managed = owned(entry, p, expected);
    const connected = managed && isDeepStrictEqual(object(entry).args, expected.args);
    return { client, state: connected ? 'REGISTERED' : managed ? 'RECONNECT_REQUIRED' : 'MCP_CONFLICT', connected, clientAcceptanceVerified: false };
  } catch { return { client, state: 'CONFIG_NOT_INSPECTED', connected: false, next: 'Check the client config and installed Python interpreter. No configuration was changed.' }; }
}
