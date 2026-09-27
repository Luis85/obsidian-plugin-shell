/** Delegate tools to upstream; do not reimplement its bank routing or MCP server. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { AGENT_VERSION, MemoryError, requireEnabled, requireThat, type Identity, type JsonObject } from './policy.ts';
import { backend, locked, readConfig, type Paths } from './io.ts';
export function nativeServer(p: Paths): string {
  const root = dirname(dirname(p.installer)); const manifest = join(root, 'package.json');
  requireThat(existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).version === AGENT_VERSION, 'AGENT_VERSION_MISMATCH', 'Install the pinned coding-agent package before connecting.');
  const script = join(root, 'dist/mcp-server.js'); requireThat(existsSync(script), 'NOT_INSTALLED', 'The official MCP server is missing; reinstall the optional runtime.'); return script;
}
export function launchMcp(repo: Identity, p: Paths, agent: string, autostart = true): Promise<number> {
  requireThat(['claude-code', 'codex'].includes(agent), 'AGENT_REQUIRED', 'MCP requires --agent claude-code or codex.');
  const config = readConfig(p.config).data; const url = requireEnabled(config, repo); const script = nativeServer(p);
  if (autostart) locked(p.state, () => backend(p, 'start', { url, approved: true }));
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script], { cwd: repo.root, stdio: 'inherit', shell: false,
      env: { ...process.env, HINDSIGHT_CONFIG: p.config, HINDSIGHT_MCP_HARNESS: agent, HINDSIGHT_MCP_PROJECT_CWD: repo.root } });
    const stop = () => child.kill(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
    const finish = (code: number) => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); resolve(code); };
    child.once('error', () => finish(1)); child.once('exit', code => finish(code ?? 1));
  });
}
/** Bounded read-only MCP discovery. Never invokes tools or starts the daemon. */
export function discoverTools(repo: Identity, p: Paths, agent: string, timeout = 10000): Promise<JsonObject> {
  requireThat(['claude-code', 'codex'].includes(agent), 'AGENT_REQUIRED', 'Choose --agent claude-code or codex.');
  requireEnabled(readConfig(p.config).data, repo); const script = nativeServer(p);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd: repo.root, stdio: ['pipe', 'pipe', 'pipe'], shell: false,
      env: { ...process.env, HINDSIGHT_CONFIG: p.config, HINDSIGHT_MCP_HARNESS: agent, HINDSIGHT_MCP_PROJECT_CWD: repo.root } });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = ''; let bytes = 0; let settled = false;
    const finish = (error: boolean, tools: unknown[] = []) => {
      if (settled) return; settled = true; clearTimeout(timer); child.kill();
      if (error) reject(new MemoryError('MCP_DISCOVERY_FAILED', 'The official MCP server did not complete initialize/tools-list. Check registration, restart the client and rerun memory doctor.'));
      else resolve({ ok: true, code: 'MCP_DISCOVERED', agent, tools, daemonStarted: false, inferenceVerified: false });
    };
    const timer = setTimeout(() => finish(true), timeout);
    const send = (value: unknown) => child.stdin.write(JSON.stringify(value) + '\n');
    child.stdin.on('error', () => finish(true)); child.stderr.resume(); child.on('error', () => finish(true)); child.on('exit', () => finish(true));
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length; if (bytes > 1024 * 1024) { finish(true); return; }
      try { buffer += decoder.decode(chunk, { stream: true }); } catch { finish(true); return; }
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.error) { finish(true); return; }
          if (msg.id === 1 && msg.result) { send({ jsonrpc: '2.0', method: 'notifications/initialized' }); send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }); }
          if (msg.id === 2) {
            const tools = msg.result?.tools;
            if (!Array.isArray(tools) || tools.some(t => typeof t.name !== 'string')) { finish(true); return; }
            finish(false, tools.map(t => ({ name: t.name, inputSchema: t.inputSchema, annotations: t.annotations })));
          }
        } catch { finish(true); return; }
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'shell-memory-doctor', version: '1.0.0' } } });
  });
}
