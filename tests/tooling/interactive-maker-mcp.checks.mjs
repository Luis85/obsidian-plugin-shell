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
  assert.match(discover.result.instructions, /workbench_capabilities/);
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].name, 'workbench-local');
  const initialized = await mcpResponse({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, ok);
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  assert.match(initialized.result.instructions, /dry-run\/plan/);
  const fallback = await mcpResponse({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: 'future' } }, ok);
  assert.equal(fallback.result.protocolVersion, '2025-11-25');
  const listed = await mcpResponse({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, ok);
  assert.deepEqual(listed.result.tools.map(tool => tool.name), workbenchMcpTools.map(tool => tool.name));
  assert.ok(listed.result.tools.every(tool => tool.outputSchema?.type === 'object'));
  assert.deepEqual(listed.result.tools.map(tool => tool.annotations.title),
    ['List Workbench capabilities', 'Read Workbench help', 'Run Workbench command']);
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
    assert.deepEqual(response.result.structuredContent.workbench.args, id === 1 ? ['capabilities', '--json'] : id === 2 ? ['help', 'setup', '--json'] : ['check', '--fast']);
  }
  assert.deepEqual(calls, [[['capabilities', '--json'], 120000, null], [['help', 'setup', '--json'], 120000, null],
    [['check', '--fast'], 5000, '{"scope":"current"}\n']]);
  for (const arguments_ of [{}, { args: [] }, { args: ['x'], timeoutMs: 1 }, { args: ['bad\0arg'] },
    { args: ['check', '--root', '../other'] }, { args: ['check', '--root=../other'] }, { args: ['mcp'] }, { args: ['check'], stdin: 'bad\0input' }]) {
    const response = await mcpResponse({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'workbench_execute', arguments: arguments_ } }, run);
    assert.equal(response.result.isError, true);
  }
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'workbench_help', arguments: { topic: '' } } }, run)).result.isError, true);
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'missing', arguments: {} } }, run)).result.isError, true);
  assert.equal((await mcpResponse({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: {} }, run)).error.code, -32602);
  assert.equal((await mcpResponse({ jsonrpc: '1.0', id: 13, method: 'ping' }, run)).error.code, -32600);
  const plain = await mcpResponse({ jsonrpc: '2.0', id: 14, method: 'tools/call', params: {
    name: 'workbench_capabilities', arguments: {},
  } }, async () => ({ exitCode: 0, signal: null, stdout: 'plain text', stderr: '', timedOut: false, overflow: false }));
  assert.equal(plain.result.structuredContent.workbench, undefined);
  const empty = await mcpResponse({ jsonrpc: '2.0', id: 15, method: 'tools/call', params: {
    name: 'workbench_capabilities', arguments: {},
  } }, async () => ({ exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false, overflow: false }));
  assert.equal(empty.result.structuredContent.workbench, undefined);
});

test('stdio MCP keeps serving while work runs and cancellation stops the owned request without a response', async () => {
  const value = streams();
  let startedResolve;
  const started = new Promise(resolveStarted => { startedResolve = resolveStarted; });
  const run = async (args, _timeout, _stdin, signal) => {
    if (args[0] !== 'check') return ok(args);
    startedResolve();
    await new Promise(resolveRun => signal.addEventListener('abort', resolveRun, { once: true }));
    return { exitCode: 1, signal: 'SIGTERM', stdout: '', stderr: '', timedOut: false, overflow: false, error: 'cancelled' };
  };
  const running = runMcpServer(frameworkRoot, value.io, run);
  value.input.write(JSON.stringify({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: {
    name: 'workbench_execute', arguments: { args: ['check', '--fast'] },
  } }) + '\n');
  await started;
  const pingOutput = new Promise(resolveOutput => value.output.once('data', resolveOutput));
  value.input.write(JSON.stringify({ jsonrpc: '2.0', id: 21, method: 'ping', params: {} }) + '\n');
  await pingOutput;
  assert.match(value.read(), /"id":21/);
  value.input.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 20 } }) + '\n');
  value.input.end();
  assert.equal(await running, 0);
  assert.doesNotMatch(value.read(), /"id":20/);
});

test('stdio MCP bounds frames and in-flight requests and contains handler failures', async () => {
  const value = streams();
  let started = 0, allStartedResolve;
  const allStarted = new Promise(resolveStarted => { allStartedResolve = resolveStarted; });
  const run = async (_args, _timeout, _stdin, signal) => {
    started++;
    if (started === 4) allStartedResolve();
    await new Promise(resolveRun => signal.addEventListener('abort', resolveRun, { once: true }));
    return { exitCode: 1, signal: 'SIGTERM', stdout: '', stderr: '', timedOut: false, overflow: false, error: 'cancelled' };
  };
  const running = runMcpServer(frameworkRoot, value.io, run);
  for (const id of [31, 32, 33, 'four']) value.input.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: {
    name: 'workbench_execute', arguments: { args: ['check', '--fast'] },
  } }) + '\n');
  await allStarted;
  value.input.write(JSON.stringify({ jsonrpc: '2.0', id: 31, method: 'ping', params: {} }) + '\n');
  value.input.write(JSON.stringify({ jsonrpc: '2.0', id: 35, method: 'ping', params: {} }) + '\n');
  value.input.write(JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping', params: {} }) + '\n');
  value.input.write('x'.repeat(512 * 1024 + 1) + '\n');
  for (const requestId of [31, 32, 33]) value.input.write(JSON.stringify({
    jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId },
  }) + '\n');
  value.input.end();
  assert.equal(await running, 0);
  const responses = value.read().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.ok(responses.some(item => item.id === 31 && item.error?.code === -32600));
  assert.ok(responses.some(item => item.id === 35 && item.error?.code === -32000));
  assert.ok(responses.some(item => item.id === null && item.error?.code === -32600));
  assert.ok(responses.some(item => item.id === null && item.error?.message === 'Request too large.'));
  assert.ok(!responses.some(item => [32, 33, 'four'].includes(item.id)));

  const failed = streams();
  const failedRun = runMcpServer(frameworkRoot, failed.io, async () => { throw new Error('private failure'); });
  const failedOutput = new Promise(resolveOutput => failed.output.once('data', resolveOutput));
  failed.input.write(JSON.stringify({ jsonrpc: '2.0', id: 40, method: 'tools/call', params: {
    name: 'workbench_capabilities', arguments: {},
  } }) + '\n');
  await failedOutput; failed.input.end(); assert.equal(await failedRun, 0);
  const failure = JSON.parse(failed.read());
  assert.equal(failure.id, 40); assert.equal(failure.error.code, -32603); assert.doesNotMatch(failure.error.message, /private failure/);
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

test('enabling MCP later preserves prior setup ownership instead of replacing the intake receipt', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-mcp-later-')));
  try {
    await mkdir(join(root, 'bin'), { recursive: true }); await writeFile(join(root, 'bin/app'), '#!/usr/bin/env node\n');
    const context = { root, frameworkRoot };
    const initial = await executeOperation({ command: 'setup', args: [], options: {
      id: 'later-mcp', name: 'Later MCP', author: 'Example', blank: true, yes: true,
    } }, context);
    assert.equal(initial.status, 'applied', JSON.stringify(initial));
    const before = JSON.parse(await readFile(join(root, '.framework/intake.json'), 'utf8')).files;
    assert.ok(before['design/project.json']); assert.ok(before['.framework/imported-project.json']);

    const enabled = await executeOperation({ command: 'setup', args: [], options: { mcp: true, yes: true } }, context);
    assert.equal(enabled.status, 'applied', JSON.stringify(enabled));
    const after = JSON.parse(await readFile(join(root, '.framework/intake.json'), 'utf8')).files;
    assert.equal(after['design/project.json'], before['design/project.json']);
    assert.equal(after['.framework/imported-project.json'], before['.framework/imported-project.json']);
    for (const path of ['.mcp.json', '.codex/config.toml', '.claude/settings.local.json']) assert.match(after[path], /^[a-f0-9]{64}$/);
    const preserved = await executeOperation({ command: 'setup', args: [], options: { yes: true } }, context);
    assert.equal(preserved.status, 'unchanged', JSON.stringify(preserved));
    assert.equal(preserved.data.summary.agentMcp.enabled, true);
    assert.equal(preserved.data.summary.agentMcp.action, 'preserve');
    const disabled = await executeOperation({ command: 'setup', args: [], options: { 'no-mcp': true, yes: true } }, context);
    assert.equal(disabled.status, 'applied', JSON.stringify(disabled));
    assert.equal(disabled.data.summary.agentMcp.enabled, false);
    const disabledReceipt = JSON.parse(await readFile(join(root, '.framework/intake.json'), 'utf8')).files;
    for (const path of ['.mcp.json', '.codex/config.toml', '.claude/settings.local.json']) {
      assert.equal(disabledReceipt[path], undefined);
      await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the real runner delegates to bin/app and modern setup owns Claude/Codex project registrations', async () => {
  const execution = await runWorkbench(frameworkRoot, ['version', '--json'], 15000);
  assert.equal(execution.exitCode, 0, execution.stderr);
  const controller = new AbortController(); controller.abort();
  const cancelled = await runWorkbench(frameworkRoot, ['version', '--json'], 15000, undefined, controller.signal);
  assert.equal(cancelled.error, 'cancelled');

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-mcp-')));
  try {
    await mkdir(join(root, 'bin'), { recursive: true }); await writeFile(join(root, 'bin/app'), '#!/usr/bin/env node\n');
    const request = { command: 'setup', args: [], options: { id: 'mcp-demo', name: 'MCP Demo', author: 'Example', blank: true, mcp: true, yes: true } };
    const context = { root, frameworkRoot };
    const applied = await executeOperation(request, context);
    assert.equal(applied.status, 'applied', JSON.stringify(applied));
    assert.deepEqual(JSON.parse(await readFile(join(root, '.mcp.json'), 'utf8')).mcpServers.workbench.args, ['${CLAUDE_PROJECT_DIR}/bin/app', 'mcp']);
    const codex = await readFile(join(root, '.codex/config.toml'), 'utf8');
    assert.match(codex, /default_tools_approval_mode = "writes"/); assert.match(codex, /tool_timeout_sec = 600/);
    assert.match(codex, /workbench_capabilities\]\napproval_mode = "approve"/);
    assert.match(codex, /workbench_help\]\napproval_mode = "approve"/);
    assert.match(codex, /workbench_execute\]\napproval_mode = "prompt"/);
    const claude = JSON.parse(await readFile(join(root, '.claude/settings.local.json'), 'utf8')).permissions;
    assert.deepEqual(claude.allow, ['mcp__workbench__workbench_capabilities', 'mcp__workbench__workbench_help']);
    assert.deepEqual(claude.ask, ['mcp__workbench__workbench_execute']);
    await writeFile(join(root, '.mcp.json'), '{"edited":true}\n');
    const replay = await executeOperation(request, context);
    assert.equal(replay.status, 'failed'); assert.equal(replay.diagnostics[0].code, 'MCP_CONFIG_CONFLICT');
    assert.equal(replay.diagnostics[0].message, 'Preserve edited or foreign MCP configuration: .mcp.json. Reconcile it before setup manages or removes it.');
    assert.equal(await readFile(join(root, '.mcp.json'), 'utf8'), '{"edited":true}\n');
    const { mcp: _enable, ...kept } = request.options;
    const disable = await executeOperation({ ...request, options: { ...kept, 'no-mcp': true } }, context);
    assert.equal(disable.status, 'failed'); assert.equal(disable.diagnostics[0].code, 'MCP_CONFIG_CONFLICT');
  } finally { await rm(root, { recursive: true, force: true }); }
});
