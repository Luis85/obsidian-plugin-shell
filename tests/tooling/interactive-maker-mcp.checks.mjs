import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { realpath, mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { mcpResponse, runMcpServer, runWorkbench, workbenchMcpTools } from '../../bin/adapters/mcp-server.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { main as appMain } from '../../bin/app.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const ok = async args => ({ exitCode: 0, signal: null, stdout: JSON.stringify({ args }), stderr: '', timedOut: false, overflow: false });

test('MCP supports current modern discovery and legacy initialize with deterministic tools', async () => {
  const discover = await mcpResponse({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }, ok);
  assert.ok(discover.result.supportedVersions.includes('2026-07-28'));
  assert.equal(discover.result.resultType, 'complete');
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].name, 'workbench-local');
  const initialized = await mcpResponse({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, ok);
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  const fallback = await mcpResponse({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: 'future' } }, ok);
  assert.equal(fallback.result.protocolVersion, '2025-11-25');
  const listed = await mcpResponse({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, ok);
  assert.deepEqual(listed.result.tools.map(tool => tool.name), workbenchMcpTools.map(tool => tool.name));
  assert.equal(await mcpResponse({ jsonrpc: '2.0', method: 'notifications/initialized' }, ok), null);
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 5, method: 'unknown' }, ok)).error.code, -32601);
});

test('MCP delegates exact Workbench arguments and validates unsafe inputs', async () => {
  const calls = [];
  const run = async (args, timeout, stdin) => { calls.push([args, timeout, stdin ?? null]); return ok(args); };
  for (const [id, name, args] of [[1, 'workbench_capabilities', {}], [2, 'workbench_help', { topic: 'setup' }],
    [3, 'workbench_execute', { args: ['check', '--fast'], timeoutMs: 5000, stdin: '{"scope":"current"}\n' }]]) {
    const response = await mcpResponse({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, run);
    assert.equal(response.result.isError, false);
  }
  assert.deepEqual(calls, [[['capabilities', '--json'], 120000, null], [['help', 'setup', '--json'], 120000, null],
    [['check', '--fast'], 5000, '{"scope":"current"}\n']]);
  for (const arguments_ of [{}, { args: [] }, { args: ['x'], timeoutMs: 1 }, { args: ['bad\0arg'] },
    { args: ['check', '--root', '../other'] }, { args: ['check', '--root=../other'] }, { args: ['check'], stdin: 'bad\0input' }]) {
    const response = await mcpResponse({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'workbench_execute', arguments: arguments_ } }, run);
    assert.equal(response.result.isError, true);
  }
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'workbench_help', arguments: { topic: '' } } }, run)).result.isError, true);
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'missing', arguments: {} } }, run)).result.isError, true);
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: {} }, run)).error.code, -32602);
  assert.equal((await mcpResponse({ jsonrpc: '1.0', id: 13, method: 'ping' }, run)).error.code, -32600);
});

test('stdio and app entrypoint serve MCP without a second executable', async () => {
  for (const invoke of [
    () => {
      const value = streams();
      return Promise.all([runMcpServer(frameworkRoot, value.io, ok), feed(value.input)]).then(([code]) => code);
    },
    () => {
      const value = streams();
      return Promise.all([appMain(['mcp'], frameworkRoot, { ...value.io, error: value.error }), feed(value.input)]).then(([code]) => code);
    },
  ]) assert.equal(await invoke(), 0);

  const invalid = streams();
  const running = runMcpServer(frameworkRoot, invalid.io, ok);
  invalid.input.write('{bad json}\n'); invalid.input.end(); await running;
  assert.equal(JSON.parse(invalid.read()).error.code, -32700);

  const usage = streams();
  assert.equal(await appMain(['mcp', 'extra'], frameworkRoot, { ...usage.io, error: usage.error }), 1);
  assert.match(usage.readError(), /MCP_USAGE/);
});
function streams() {
  const input = new PassThrough(), output = new PassThrough(), error = new PassThrough();
  let text = '', err = ''; output.setEncoding('utf8'); error.setEncoding('utf8');
  output.on('data', chunk => { text += chunk; }); error.on('data', chunk => { err += chunk; });
  return { input, output, error, io: { input, output }, read: () => text.trim(), readError: () => err };
}
async function feed(input) {
  input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }) + '\n');
  input.end();
}

test('the real runner delegates to bin/app and modern setup owns Claude/Codex project registrations', async () => {
  const execution = await runWorkbench(frameworkRoot, ['version', '--json'], 15000);
  assert.equal(execution.exitCode, 0, execution.stderr);

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-mcp-')));
  try {
    await mkdir(join(root, 'bin'), { recursive: true }); await writeFile(join(root, 'bin/app'), '#!/usr/bin/env node\n');
    const request = { command: 'setup', args: [], options: { id: 'mcp-demo', name: 'MCP Demo', author: 'Example', blank: true, mcp: true, yes: true } };
    const context = { root, frameworkRoot };
    const applied = await executeOperation(request, context);
    assert.equal(applied.status, 'applied', JSON.stringify(applied));
    assert.deepEqual(JSON.parse(await readFile(join(root, '.mcp.json'), 'utf8')).mcpServers.workbench.args, ['${CLAUDE_PROJECT_DIR}/bin/app', 'mcp']);
    assert.match(await readFile(join(root, '.codex/config.toml'), 'utf8'), /default_tools_approval_mode = "writes"/);
    const claude = JSON.parse(await readFile(join(root, '.claude/settings.local.json'), 'utf8')).permissions;
    assert.deepEqual(claude.allow, ['mcp__workbench__workbench_capabilities', 'mcp__workbench__workbench_help']);
    assert.deepEqual(claude.ask, ['mcp__workbench__workbench_execute']);
    await writeFile(join(root, '.mcp.json'), '{"edited":true}\n');
    const replay = await executeOperation(request, context);
    assert.equal(replay.status, 'failed'); assert.equal(replay.diagnostics[0].code, 'IMPORT_OWNERSHIP');
  } finally { await rm(root, { recursive: true, force: true }); }
});
