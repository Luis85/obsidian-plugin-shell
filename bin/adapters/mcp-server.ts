import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { terminateProcessTree } from './framework/process-tree.ts';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 4096;
const MAX_STDIN_LENGTH = 256 * 1024;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_INFLIGHT = 4;
const legacyProtocols = new Set(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const supportedVersions = ['2026-07-28', ...legacyProtocols];
const serverInfo = { name: 'workbench-local', title: 'Workbench Local', version: '1.0.0' };
const capabilities = { tools: { listChanged: false } };
const instructions = 'Use workbench_capabilities and workbench_help before invoking unfamiliar commands. Prefer Workbench dry-run/plan flows before writes. workbench_execute never grants approval flags or release/process trust; those remain explicit Workbench and client decisions.';
const executionOutputSchema = {
  type: 'object', additionalProperties: true,
  required: ['exitCode', 'signal', 'stdout', 'stderr', 'timedOut', 'overflow'],
  properties: {
    exitCode: { type: 'integer' }, signal: { type: ['string', 'null'] }, stdout: { type: 'string' },
    stderr: { type: 'string' }, timedOut: { type: 'boolean' }, overflow: { type: 'boolean' },
    error: { type: 'string' }, workbench: {},
  },
} as const;

export const workbenchMcpTools = [
  {
    name: 'workbench_capabilities',
    description: 'List the Workbench CLI capabilities available in this project without changing project state.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    outputSchema: executionOutputSchema,
    annotations: { title: 'List Workbench capabilities', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'workbench_help',
    description: 'Read Workbench CLI help. Optionally provide a command topic such as setup, make, project, or release.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      topic: { type: 'string', minLength: 1, maxLength: 120 },
    } },
    outputSchema: executionOutputSchema,
    annotations: { title: 'Read Workbench help', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'workbench_execute',
    description: 'Execute the project-local Workbench CLI with an exact argument array. Use --json for machine output and Workbench dry-run/plan flows before writes. The MCP layer never adds --yes, --apply, release authorization, process trust, or other permissions.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['args'], properties: {
      args: { type: 'array', minItems: 1, maxItems: MAX_ARGS, items: { type: 'string', maxLength: MAX_ARG_LENGTH } },
      stdin: { type: 'string', maxLength: MAX_STDIN_LENGTH, description: 'Optional stdin payload for commands using --input -.' },
      timeoutMs: { type: 'integer', minimum: 1000, maximum: 600000 },
    } },
    outputSchema: executionOutputSchema,
    annotations: { title: 'Run Workbench command', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
] as const;

type RunResult = { exitCode: number; signal: string | null; stdout: string; stderr: string; timedOut: boolean; overflow: boolean; error?: string };
export type McpRunner = (args: string[], timeoutMs: number, stdin?: string, signal?: AbortSignal) => Promise<RunResult>;
type JsonRpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
type McpIo = { input: Readable; output: Writable };

function textResult(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError };
}
function parsedStdout(stdout: string): unknown | undefined {
  const source = stdout.trim();
  if (!source) return undefined;
  try { return JSON.parse(source); } catch { return undefined; }
}
function executionResult(value: RunResult, isError = false) {
  const parsed = parsedStdout(value.stdout);
  const structuredContent = { ...value, ...(parsed === undefined ? {} : { workbench: parsed }) };
  return { content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }], structuredContent, isError };
}
function exactArgs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ARGS) throw new Error('args must contain 1-64 CLI arguments.');
  for (const item of value) if (typeof item !== 'string' || item.length > MAX_ARG_LENGTH || item.includes('\0')) {
    throw new Error('Each CLI argument must be a bounded string without NUL bytes.');
  }
  if (value.some(item => item === '--root' || item.startsWith('--root='))) {
    throw new Error('The project-local MCP is bound to its Workbench root; --root is not accepted.');
  }
  if (value[0] === 'mcp') throw new Error('The MCP transport cannot recursively invoke itself.');
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
async function tool(name: string, input: unknown, run: McpRunner, signal?: AbortSignal) {
  const options = record(input);
  if (name === 'workbench_capabilities') {
    const value = await run(['capabilities', '--json'], 120000, undefined, signal);
    return executionResult(value, value.exitCode !== 0);
  }
  if (name === 'workbench_help') {
    const topic = options.topic;
    if (topic !== undefined && (typeof topic !== 'string' || !topic.trim() || topic.length > 120 || topic.includes('\0'))) {
      return textResult({ code: 'INVALID_INPUT', message: 'topic must be a bounded nonempty string.' }, true);
    }
    const value = await run(['help', ...(topic ? [topic.trim()] : []), '--json'], 120000, undefined, signal);
    return executionResult(value, value.exitCode !== 0);
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
    const value = await run(args, timeoutMs, typeof stdin === 'string' ? stdin : undefined, signal);
    return executionResult(value, value.exitCode !== 0 || value.timedOut || value.overflow);
  } catch (cause) {
    return textResult({ code: 'INVALID_INPUT', message: cause instanceof Error ? cause.message : 'Invalid tool input.' }, true);
  }
}

function initializeResponse(message: JsonRpc, params: Record<string, unknown>) {
  const requested = params.protocolVersion;
  const protocolVersion = typeof requested === 'string' && legacyProtocols.has(requested) ? requested : '2025-11-25';
  return result(message.id, { protocolVersion, capabilities, serverInfo, instructions });
}
async function operationalResponse(message: JsonRpc, params: Record<string, unknown>, run: McpRunner, signal?: AbortSignal) {
  const isModern = modern(message);
  if (message.method === 'ping') return result(message.id, {}, isModern);
  if (message.method === 'tools/list') return result(message.id, { tools: workbenchMcpTools }, isModern);
  if (message.method !== 'tools/call') return error(message.id, -32601, 'Method not found.');
  const name = params.name;
  if (typeof name !== 'string') return error(message.id, -32602, 'Tool name is required.');
  return result(message.id, await tool(name, params.arguments ?? {}, run, signal), isModern);
}
export async function mcpResponse(message: JsonRpc, run: McpRunner, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return error(message?.id ?? null, -32600, 'Invalid JSON-RPC request.');
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled' || message.id === undefined) return null;
  const params = record(message.params);
  if (message.method === 'server/discover') return result(message.id, { supportedVersions, capabilities, instructions, ttlMs: 0, cacheScope: 'private' }, true);
  if (message.method === 'initialize') return initializeResponse(message, params);
  return operationalResponse(message, params, run, signal);
}

export function runWorkbench(root: string, args: string[], timeoutMs: number, stdin?: string, signal?: AbortSignal): Promise<RunResult> {
  if (signal?.aborted) return Promise.resolve({ exitCode: 1, signal: null, stdout: '', stderr: '', timedOut: false, overflow: false, error: 'cancelled' });
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
    const abort = () => stop();
    signal?.addEventListener('abort', abort, { once: true });
    const settle = (value: RunResult) => {
      if (settled) return;
      settled = true; clearTimeout(timer); if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener('abort', abort); resolveRun(value);
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    const collect = (target: 'stdout' | 'stderr', chunk: string) => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > MAX_OUTPUT_BYTES) { if (!overflow) { overflow = true; stop(); } return; }
      if (target === 'stdout') stdout += chunk; else stderr += chunk;
    };
    child.stdout.on('data', chunk => collect('stdout', chunk)); child.stderr.on('data', chunk => collect('stderr', chunk));
    child.stdin.on('error', cause => settle({ exitCode: 1, signal: null, stdout, stderr, error: cause.message, timedOut, overflow }));
    child.stdin.end(stdin ?? '');
    child.once('error', cause => settle({ exitCode: 1, signal: null, stdout, stderr, error: cause.message, timedOut, overflow }));
    child.once('close', (code, signal) => settle({ exitCode: code ?? 1, signal, stdout, stderr, timedOut, overflow }));
  });
}

function requestKey(id: unknown): string | null {
  if (typeof id === 'string') return 's:' + id;
  if (typeof id === 'number' && Number.isFinite(id)) return 'n:' + id;
  return null;
}
export async function runMcpServer(root: string, io: McpIo, run: McpRunner = (args, timeout, stdin, signal) => runWorkbench(root, args, timeout, stdin, signal)): Promise<number> {
  const lines = createInterface({ input: io.input, crlfDelay: Infinity });
  const active = new Map<string, { controller: AbortController; promise: Promise<void> }>();
  const pending = new Set<Promise<void>>();
  const send = (response: Record<string, unknown>) => { io.output.write(JSON.stringify(response) + '\n'); };
  const start = (message: JsonRpc, key: string) => {
    const controller = new AbortController();
    let promise!: Promise<void>;
    promise = (async () => {
      try {
        const response = await mcpResponse(message, run, controller.signal);
        if (!controller.signal.aborted && response) send(response);
      } catch {
        if (!controller.signal.aborted) send(error(message.id ?? null, -32603, 'Internal error.'));
      } finally {
        active.delete(key); pending.delete(promise);
      }
    })();
    active.set(key, { controller, promise }); pending.add(promise);
  };
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, 'utf8') > MAX_REQUEST_BYTES) { send(error(null, -32600, 'Request too large.')); continue; }
    let message: JsonRpc;
    try { message = JSON.parse(line) as JsonRpc; }
    catch { send(error(null, -32700, 'Parse error.')); continue; }
    if (message.method === 'notifications/cancelled') {
      const key = requestKey(record(message.params).requestId);
      if (key) active.get(key)?.controller.abort();
      continue;
    }
    if (message.id === undefined) { await mcpResponse(message, run); continue; }
    if (message.method === 'initialize' || message.method === 'server/discover') {
      const response = await mcpResponse(message, run); if (response) send(response); continue;
    }
    const key = requestKey(message.id);
    if (!key) { send(error(message.id ?? null, -32600, 'Request id must be a string or finite number.')); continue; }
    if (active.has(key)) { send(error(message.id, -32600, 'Duplicate in-flight request id.')); continue; }
    if (active.size >= MAX_INFLIGHT) { send(error(message.id, -32000, 'Too many in-flight requests.')); continue; }
    start(message, key);
  }
  for (const request of active.values()) request.controller.abort();
  await Promise.allSettled([...pending]);
  return 0;
}
