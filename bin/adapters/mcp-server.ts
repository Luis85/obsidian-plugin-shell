import { spawn } from 'node:child_process';
import * as timers from 'node:timers';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { terminateProcessTree } from './framework/process-tree.ts';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 4096;
const MAX_STDIN_LENGTH = 256 * 1024;
const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_INFLIGHT = 4;
/** Protocol versions negotiated through the initialize handshake; 2026-07-28 clients use server/discover instead. */
const initializeProtocols = new Set(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const supportedVersions = ['2026-07-28', ...initializeProtocols];
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
const validTopic = (topic: unknown) => topic === undefined || (typeof topic === 'string' && topic.trim() !== '' && topic.length <= 120 && !topic.includes('\0'));
async function helpTool(options: Record<string, unknown>, run: McpRunner, signal?: AbortSignal) {
  const topic = options.topic;
  if (!validTopic(topic)) return textResult({ code: 'INVALID_INPUT', message: 'topic must be a bounded nonempty string.' }, true);
  const value = await run(['help', ...(topic ? [(topic as string).trim()] : []), '--json'], 120000, undefined, signal);
  return executionResult(value, value.exitCode !== 0);
}
function executeTimeout(value: unknown): number {
  const timeoutMs = value === undefined ? 120000 : value;
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw new Error('timeoutMs must be 1000-600000.');
  return timeoutMs;
}
function executeStdin(stdin: unknown): string | undefined {
  if (stdin === undefined) return undefined;
  if (typeof stdin !== 'string' || stdin.length > MAX_STDIN_LENGTH || stdin.includes('\0')) throw new Error('stdin must be a bounded string without NUL bytes.');
  return stdin;
}
async function executeTool(options: Record<string, unknown>, run: McpRunner, signal?: AbortSignal) {
  try {
    const args = exactArgs(options.args);
    const timeoutMs = executeTimeout(options.timeoutMs);
    const value = await run(args, timeoutMs, executeStdin(options.stdin), signal);
    return executionResult(value, value.exitCode !== 0 || value.timedOut || value.overflow);
  } catch (cause) {
    return textResult({ code: 'INVALID_INPUT', message: cause instanceof Error ? cause.message : 'Invalid tool input.' }, true);
  }
}
async function tool(name: string, input: unknown, run: McpRunner, signal?: AbortSignal) {
  const options = record(input);
  if (name === 'workbench_capabilities') {
    const value = await run(['capabilities', '--json'], 120000, undefined, signal);
    return executionResult(value, value.exitCode !== 0);
  }
  if (name === 'workbench_help') return helpTool(options, run, signal);
  if (name !== 'workbench_execute') return textResult({ code: 'UNKNOWN_TOOL', message: 'Unknown Workbench MCP tool.' }, true);
  return executeTool(options, run, signal);
}

function initializeResponse(message: JsonRpc, params: Record<string, unknown>) {
  const requested = params.protocolVersion;
  const protocolVersion = typeof requested === 'string' && initializeProtocols.has(requested) ? requested : '2025-11-25';
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
const validRequest = (message: JsonRpc) => Boolean(message) && message.jsonrpc === '2.0' && typeof message.method === 'string';
/** Notifications and id-less messages never receive a response. */
const isNotification = (message: JsonRpc) => message.method === 'notifications/initialized' || message.method === 'notifications/cancelled' || message.id === undefined;
export async function mcpResponse(message: JsonRpc, run: McpRunner, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  if (!validRequest(message)) return error(message?.id ?? null, -32600, 'Invalid JSON-RPC request.');
  if (isNotification(message)) return null;
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
    let forceTimer: ReturnType<typeof timers.setTimeout> | undefined;
    const stop = () => {
      terminateProcessTree(child, 'SIGTERM');
      forceTimer ??= timers.setTimeout(() => terminateProcessTree(child, 'SIGKILL'), 3000);
      forceTimer.unref();
    };
    const timer = timers.setTimeout(() => { timedOut = true; stop(); }, timeoutMs); timer.unref();
    const abort = () => stop();
    signal?.addEventListener('abort', abort, { once: true });
    const settle = (value: RunResult) => {
      if (settled) return;
      settled = true; timers.clearTimeout(timer); if (forceTimer) timers.clearTimeout(forceTimer);
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
type Send = (response: Record<string, unknown>) => void;
type Active = Map<string, { controller: AbortController; promise: Promise<void> }>;
const OVERSIZED = Symbol('oversized frame');
type Frame = string | typeof OVERSIZED;
const decodeFrame = (parts: readonly Buffer[]): string => Buffer.concat(parts).toString('utf8').replace(/\r$/, '');
/**
 * Newline-delimited frames, holding at most MAX_REQUEST_BYTES of any one frame: the bytes of an oversized frame are
 * dropped as they arrive and the frame is reported once at its newline. UTF-8 split across chunks decodes intact.
 */
async function* frames(input: Readable): AsyncGenerator<Frame> {
  let parts: Buffer[] = [], size = 0, oversized = false;
  for await (const chunk of input) {
    let data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    for (let newline = data.indexOf(10); ; newline = data.indexOf(10)) {
      const piece = newline === -1 ? data : data.subarray(0, newline);
      if (!oversized && size + piece.length > MAX_REQUEST_BYTES) { oversized = true; parts = []; size = 0; }
      if (!oversized) { parts.push(piece); size += piece.length; }
      if (newline === -1) break;
      yield oversized ? OVERSIZED : decodeFrame(parts);
      parts = []; size = 0; oversized = false; data = data.subarray(newline + 1);
    }
  }
  if (oversized) yield OVERSIZED;
  else if (size) yield decodeFrame(parts);
}
/** Parses one frame; oversized or malformed input is answered here and yields no message. */
function parseFrame(frame: Frame, send: Send): JsonRpc | null {
  if (frame === OVERSIZED) { send(error(null, -32600, 'Request too large.')); return null; }
  if (!frame.trim()) return null;
  try { return JSON.parse(frame) as JsonRpc; }
  catch { send(error(null, -32700, 'Parse error.')); return null; }
}
/** The reason a request cannot start, or null when it may run concurrently under its own id. */
function admissionError(message: JsonRpc, key: string | null, active: Active): Record<string, unknown> | null {
  if (!key) return error(message.id ?? null, -32600, 'Request id must be a string or finite number.');
  if (active.has(key)) return error(message.id, -32600, 'Duplicate in-flight request id.');
  return active.size >= MAX_INFLIGHT ? error(message.id, -32000, 'Too many in-flight requests.') : null;
}
/** Messages answered inline: cancellations, notifications and the handshake. Returns false for ordinary requests. */
async function handledInline(message: JsonRpc, run: McpRunner, active: Active, send: Send): Promise<boolean> {
  if (message.method === 'notifications/cancelled') {
    const key = requestKey(record(message.params).requestId);
    if (key) active.get(key)?.controller.abort();
    return true;
  }
  if (message.id === undefined) { await mcpResponse(message, run); return true; }
  if (message.method !== 'initialize' && message.method !== 'server/discover') return false;
  const response = await mcpResponse(message, run); if (response) send(response);
  return true;
}
export async function runMcpServer(root: string, io: McpIo, run: McpRunner = (args, timeout, stdin, signal) => runWorkbench(root, args, timeout, stdin, signal)): Promise<number> {
  const active: Active = new Map();
  const pending = new Set<Promise<void>>();
  const send: Send = response => { io.output.write(JSON.stringify(response) + '\n'); };
  const start = (message: JsonRpc, key: string) => {
    const controller = new AbortController();
    const promise: Promise<void> = (async () => {
      try {
        const response = await mcpResponse(message, run, controller.signal);
        if (!controller.signal.aborted && response) send(response);
      } catch {
        if (!controller.signal.aborted) send(error(message.id ?? null, -32603, 'Internal error.'));
      } finally {
        active.delete(key);
      }
    })();
    active.set(key, { controller, promise }); pending.add(promise);
    void promise.finally(() => pending.delete(promise));
  };
  for await (const frame of frames(io.input)) {
    const message = parseFrame(frame, send);
    if (!message || await handledInline(message, run, active, send)) continue;
    const key = requestKey(message.id), refused = admissionError(message, key, active);
    if (refused) send(refused); else start(message, key!);
  }
  for (const request of active.values()) request.controller.abort();
  await Promise.allSettled(pending);
  return 0;
}
