import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = resolve(root, 'bin/app');
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 4096;
const protocols = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

const tools = [
  {
    name: 'workbench_capabilities',
    description: 'List the Workbench CLI capabilities available in this repository without changing project state.',
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
    description: 'Execute the repository-local Workbench CLI with an exact argument array. This exposes the full app surface. The MCP layer never adds --yes, --apply, release flags, or other permissions; write-capable commands keep the Workbench CLI planning and approval contract. Add --json when machine-readable CLI output is useful.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['args'], properties: {
      args: { type: 'array', minItems: 1, maxItems: MAX_ARGS, items: { type: 'string', maxLength: MAX_ARG_LENGTH } },
      timeoutMs: { type: 'integer', minimum: 1000, maximum: 600000 },
    } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
];

function resultText(value, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError };
}
function safeArgs(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ARGS) throw new Error('args must contain 1-64 CLI arguments.');
  for (const item of value) {
    if (typeof item !== 'string' || item.length > MAX_ARG_LENGTH || item.includes('\0')) throw new Error('Each CLI argument must be a bounded string without NUL bytes.');
  }
  return value;
}
function runApp(args, timeoutMs = 120000) {
  return new Promise(resolveRun => {
    const child = spawn(process.execPath, [app, ...args], {
      cwd: root, shell: false, windowsHide: true, env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', bytes = 0, settled = false, timedOut = false, overflow = false;
    const settle = value => { if (!settled) { settled = true; clearTimeout(timer); resolveRun(value); } };
    const collect = (kind, chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) { overflow = true; child.kill(); return; }
      if (kind === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', chunk => collect('stdout', chunk));
    child.stderr.on('data', chunk => collect('stderr', chunk));
    child.once('error', error => settle({ exitCode: 1, signal: null, stdout, stderr, error: error.message, timedOut, overflow }));
    child.once('close', (code, signal) => settle({ exitCode: code ?? 1, signal, stdout, stderr, timedOut, overflow }));
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
  });
}
async function callTool(name, input) {
  if (name === 'workbench_capabilities') {
    const value = await runApp(['capabilities', '--json']);
    return resultText(value, value.exitCode !== 0);
  }
  if (name === 'workbench_help') {
    const topic = input?.topic;
    if (topic !== undefined && (typeof topic !== 'string' || !topic.trim() || topic.length > 120 || topic.includes('\0'))) {
      return resultText({ code: 'INVALID_INPUT', message: 'topic must be a bounded nonempty string.' }, true);
    }
    const args = ['help', ...(topic ? [topic.trim()] : []), '--json'];
    const value = await runApp(args);
    return resultText(value, value.exitCode !== 0);
  }
  if (name === 'workbench_execute') {
    try {
      const args = safeArgs(input?.args);
      const timeoutMs = input?.timeoutMs === undefined ? 120000 : input.timeoutMs;
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000) throw new Error('timeoutMs must be 1000-600000.');
      const value = await runApp(args, timeoutMs);
      return resultText(value, value.exitCode !== 0 || value.timedOut || value.overflow);
    } catch (error) {
      return resultText({ code: 'INVALID_INPUT', message: error instanceof Error ? error.message : 'Invalid tool input.' }, true);
    }
  }
  return resultText({ code: 'UNKNOWN_TOOL', message: 'Unknown Workbench MCP tool.' }, true);
}
function send(value) {
  process.stdout.write(JSON.stringify(value) + '\n');
}
function response(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function errorResponse(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}
async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    if (message?.id !== undefined) errorResponse(message.id, -32600, 'Invalid JSON-RPC request.');
    return;
  }
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') return;
  if (message.id === undefined) return;
  if (message.method === 'initialize') {
    const requested = message.params?.protocolVersion;
    response(message.id, {
      protocolVersion: protocols.has(requested) ? requested : '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'workbench-local', version: '1.0.0' },
    });
    return;
  }
  if (message.method === 'ping') { response(message.id, {}); return; }
  if (message.method === 'tools/list') { response(message.id, { tools }); return; }
  if (message.method === 'tools/call') {
    const name = message.params?.name;
    if (typeof name !== 'string') { errorResponse(message.id, -32602, 'Tool name is required.'); return; }
    response(message.id, await callTool(name, message.params?.arguments ?? {}));
    return;
  }
  errorResponse(message.id, -32601, 'Method not found.');
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try { void handle(JSON.parse(line)); }
    catch { /* Invalid notification/request bytes cannot be assigned a reliable JSON-RPC id. */ }
  }
});
process.stdin.on('end', () => { if (buffer.trim()) { try { void handle(JSON.parse(buffer)); } catch { /* ignore trailing malformed input */ } } });
