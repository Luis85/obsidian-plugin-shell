import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { terminateProcessTree } from './framework/process-tree.ts';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 4096;
const MAX_STDIN_LENGTH = 256 * 1024;
const legacyProtocols = new Set(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const supportedVersions = ['2026-07-28', ...legacyProtocols];
const serverInfo = { name: 'workbench-local', version: '1.0.0' };
const capabilities = { tools: { listChanged: false } };

export const workbenchMcpTools = [
  {
    name: 'workbench_capabilities',
    description: 'List the Workbench CLI capabilities available in this project without changing project state.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'workbench_help',
    description: 'Read Workbench CLI help. Optionally provide a command topic such as setup, make, project, or release.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      topic: { type: 'string', minLength: 1, maxLength: 120 },
    } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'workbench_execute',
    description: 'Execute the project-local Workbench CLI with an exact argument array. The MCP layer never adds --yes, --apply, release authorization, process trust, or other permissions; existing Workbench planning and approval rules remain authoritative.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['args'], properties: {
      args: { type: 'array', minItems: 1, maxItems: MAX_ARGS, items: { type: 'string', maxLength: MAX_ARG_LENGTH } },
      stdin: { type: 'string', maxLength: MAX_STDIN_LENGTH, description: 'Optional stdin payload for commands using --input -.' },
      timeoutMs: { type: 'integer', minimum: 1000, maximum: 600000 },
    } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
] as const;

type RunResult = { exitCode: number; signal: string | null; stdout: string; stderr: string; timedOut: boolean; overflow: boolean; error?: string };
export type McpRunner = (args: string[], timeoutMs: number, stdin?: string) => Promise<RunResult>;
type JsonRpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
type McpIo = { input: Readable; output: Writable };

function textResult(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError };
}
function exactArgs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ARGS) throw new Error('args must contain 1-64 CLI arguments.');
  for (const item of value) if (typeof item !== 'string' || item.length > MAX_ARG_LENGTH || item.includes('\0')) {
    throw new Error('Each CLI argument must be a bounded string without NUL bytes.');
  }
  if (value.some(item => item === '--root' || item.startsWith('--root='))) {
    throw new Error('The project-local MCP is bound to its Workbench root; --root is not accepted.');
  }
  return value;
}
function modern(message: JsonRpc): boolean {
  const meta = record(record(message.params)._meta);
  return message.method === 'server/discover' || meta['io.modelcontextprotocol/protocolVersion'] === '2026-07-28';
}
function result(id: unknown, value: Record<string, unknown>, isModern = false) {
  const body = isModern ? { ...value, resultType: value.resultType ?? 'complete',
    _meta: { ...record(value._meta), 'io.modelcontextprotocol/serverInfo': serverInfo } } : value;
  return { jsonrpc: '2.0', id, result: body };
}
function error(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
async function tool(name: string, input: unknown, run: McpRunner) {
  const options = record(input);
  if (name === 'workbench_capabilities') {
    const value = await run(['capabilities', '--json'], 120000);
    return textResult(value, value.exitCode !== 0);
  }
  if (name === 'workbench_help') {
    const topic = options.topic;
    if (topic !== undefined && (typeof topic !== 'string' || !topic.trim() || topic.length > 120 || topic.includes('\0'))) {
      return textResult({ code: 'INVALID_INPUT', message: 'topic must be a bounded nonempty string.' }, true);
    }
    const value = await run(['help', ...(topic ? [topic.trim()] : []), '--json'], 120000);
    return textResult(value, value.exitCode !== 0);
  }
  if (name !== 'workbench_execute') return textResult({ code: 'UNKNOWN_TOOL', message: 'Unknown Workbench MCP tool.' }, true);
  try {
    const args = exactArgs(options.args);
    const timeoutMs = options.timeoutMs === undefined ? 120000 : options.timeoutMs;
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) {
      throw new Error('timeoutMs must be 1000-600000.');
    }
    const stdin = options.stdin;
    if (stdin !== undefined && (typeof stdin !== 'string' || stdin.length > MAX_STDIN_LENGTH || stdin.includes('\0'))) {
      throw new Error('stdin must be a bounded string without NUL bytes.');
    }
    const value = await run(args, timeoutMs, typeof stdin === 'string' ? stdin : undefined);
    return textResult(value, value.exitCode !== 0 || value.timedOut || value.overflow);
  } catch (cause) {
    return textResult({ code: 'INVALID_INPUT', message: cause instanceof Error ? cause.message : 'Invalid tool input.' }, true);
  }
}

function initializeResponse(message: JsonRpc, params: Record<string, unknown>) {
  const requested = params.protocolVersion;
  const protocolVersion = typeof requested === 'string' && legacyProtocols.has(requested) ? requested : '2025-11-25';
  return result(message.id, { protocolVersion, capabilities, serverInfo });
}
async function operationalResponse(message: JsonRpc, params: Record<string, unknown>, run: McpRunner) {
  const isModern = modern(message);
  if (message.method === 'ping') return result(message.id, {}, isModern);
  if (message.method === 'tools/list') return result(message.id, { tools: workbenchMcpTools }, isModern);
  if (message.method !== 'tools/call') return error(message.id, -32601, 'Method not found.');
  const name = params.name;
  if (typeof name !== 'string') return error(message.id, -32602, 'Tool name is required.');
  return result(message.id, await tool(name, params.arguments ?? {}, run), isModern);
}
export async function mcpResponse(message: JsonRpc, run: McpRunner): Promise<Record<string, unknown> | null> {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return error(message?.id ?? null, -32600, 'Invalid JSON-RPC request.');
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled' || message.id === undefined) return null;
  const params = record(message.params);
  if (message.method === 'server/discover') return result(message.id, { supportedVersions, capabilities, ttlMs: 0, cacheScope: 'private' }, true);
  if (message.method === 'initialize') return initializeResponse(message, params);
  return operationalResponse(message, params, run);
}

export function runWorkbench(root: string, args: string[], timeoutMs: number, stdin?: string): Promise<RunResult> {
  return new Promise(resolveRun => {
    const child = spawn(process.execPath, [join(root, 'bin/app'), ...args], {
      cwd: root, shell: false, windowsHide: true, detached: process.platform !== 'win32',
      env: { ...process.env, NO_COLOR: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', bytes = 0, settled = false, timedOut = false, overflow = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      terminateProcessTree(child, 'SIGTERM');
      forceTimer ??= setTimeout(() => terminateProcessTree(child, 'SIGKILL'), 3000);
      forceTimer.unref();
    };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs); timer.unref();
    const settle = (value: RunResult) => {
      if (settled) return;
      settled = true; clearTimeout(timer); if (forceTimer) clearTimeout(forceTimer); resolveRun(value);
    };
    const collect = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { if (!overflow) { overflow = true; stop(); } return; }
      if (target === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', chunk => collect('stdout', chunk)); child.stderr.on('data', chunk => collect('stderr', chunk));
    child.stdin.on('error', cause => settle({ exitCode: 1, signal: null, stdout, stderr, error: cause.message, timedOut, overflow }));
    child.stdin.end(stdin ?? '');
    child.once('error', cause => settle({ exitCode: 1, signal: null, stdout, stderr, error: cause.message, timedOut, overflow }));
    child.once('close', (code, signal) => settle({ exitCode: code ?? 1, signal, stdout, stderr, timedOut, overflow }));
  });
}

export async function runMcpServer(root: string, io: McpIo, run: McpRunner = (args, timeout, stdin) => runWorkbench(root, args, timeout, stdin)): Promise<number> {
  const lines = createInterface({ input: io.input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let response: Record<string, unknown> | null;
    try { response = await mcpResponse(JSON.parse(line), run); }
    catch { response = error(null, -32700, 'Parse error.'); }
    if (response) io.output.write(JSON.stringify(response) + '\n');
  }
  return 0;
}
