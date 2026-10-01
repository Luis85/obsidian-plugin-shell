import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { planLocalMcp } from '../../scripts/setup/mcp.mjs';
import { setupOptions } from '../../scripts/setup/options.mjs';
import { fixture, run, snapshot } from './setup-identity-fixture.mjs';

const root = resolve(import.meta.dirname, '../..');
const flags = ['--yes', '--no-interaction', '--json'];

test('[SETUP-MCP-01] MCP is default-off, explicit, resumable data and conflicting flags fail closed', async () => {
  assert.equal((await setupOptions([])).mcp, false);
  assert.equal((await setupOptions(['--mcp'])).mcp, true);
  assert.equal((await setupOptions(['--no-mcp'])).mcp, false);
  await assert.rejects(setupOptions(['--mcp', '--no-mcp']), /conflicts/);
});

test('[SETUP-MCP-02] the opt-in plan creates exact Claude and Codex project configuration and preserves edits', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const planned = await planLocalMcp(f.root, true);
  assert.deepEqual(planned.files.map(file => file.path), ['.mcp.json', '.claude/settings.json', '.codex/config.toml']);
  assert.ok(planned.files.every(file => file.status === 'create'));
  await applyFilePlan(planned.plan);
  const claudeMcp = JSON.parse(await readFile(join(f.root, '.mcp.json'), 'utf8'));
  assert.deepEqual(claudeMcp.mcpServers.workbench.args, ['${CLAUDE_PROJECT_DIR}/scripts/agent/workbench-mcp.mjs']);
  const claude = JSON.parse(await readFile(join(f.root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(claude.permissions.allow, ['mcp__workbench']);
  const codex = await readFile(join(f.root, '.codex/config.toml'), 'utf8');
  assert.match(codex, /\[mcp_servers\.workbench\]/); assert.match(codex, /default_tools_approval_mode = "writes"/);
  const rerun = await planLocalMcp(f.root, true, { files: planned.files });
  assert.ok(rerun.files.every(file => file.status === 'unchanged'));
  await writeFile(join(f.root, '.mcp.json'), '{"user":"edit"}\n');
  await assert.rejects(planLocalMcp(f.root, true, { files: planned.files }), /MCP_CONFIG_CONFLICT/);
  assert.equal(await readFile(join(f.root, '.mcp.json'), 'utf8'), '{"user":"edit"}\n');
});

test('[SETUP-MCP-03] setup dry-run is read-only and apply journals the MCP ownership separately from install stages', async t => {
  const dry = await fixture(); t.after(() => rm(dry.root, { recursive: true, force: true }));
  const before = await snapshot(dry.root);
  const preview = run(dry.root, dry.launcher, ['--dry-run', '--json', '--mcp']);
  assert.equal(preview.status, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout); assert.equal(plan.agentMcp.enabled, true);
  assert.deepEqual(plan.agentMcp.clients, ['claude-code', 'codex']);
  assert.deepEqual(await snapshot(dry.root), before);

  const applied = await fixture(); t.after(() => rm(applied.root, { recursive: true, force: true }));
  const result = run(applied.root, applied.launcher, [...flags, '--mcp']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const handoff = JSON.parse(result.stdout); assert.equal(handoff.agentMcp.status, 'verified');
  assert.equal(handoff.agentMcp.enabled, true);
  const journal = JSON.parse(await readFile(join(applied.root, '.template-state/setup.json'), 'utf8'));
  assert.equal(journal.options.mcp, true); assert.equal(journal.agentMcp.status, 'verified');
  assert.ok((await readFile(join(applied.root, '.mcp.json'), 'utf8')).includes('workbench'));
});

function mcpClient() {
  const child = spawn(process.execPath, ['scripts/agent/workbench-mcp.mjs'], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = ''; const pending = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line); const waiter = pending.get(message.id);
      if (waiter) { pending.delete(message.id); waiter.resolve(message); }
    }
  });
  const request = (id, method, params = {}) => new Promise((resolveRequest, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP test timeout')); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolveRequest(value); } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  return { child, request, notify: (method, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n') };
}

test('[SETUP-MCP-04] the local server negotiates MCP, exposes bounded app tools and delegates read-only discovery to bin/app', async t => {
  const client = mcpClient();
  t.after(() => { client.child.stdin.end(); client.child.kill(); });
  const discovered = await client.request(0, 'server/discover', { _meta: {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'setup-test', version: '1' },
    'io.modelcontextprotocol/clientCapabilities': {},
  } });
  assert.ok(discovered.result.supportedVersions.includes('2026-07-28'));
  assert.equal(discovered.result.resultType, 'complete');
  assert.equal(discovered.result._meta['io.modelcontextprotocol/serverInfo'].name, 'workbench-local');
  const initialized = await client.request(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'setup-test', version: '1' } });
  assert.equal(initialized.result.serverInfo.name, 'workbench-local');
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  client.notify('notifications/initialized');
  const listed = await client.request(2, 'tools/list');
  assert.deepEqual(listed.result.tools.map(tool => tool.name), ['workbench_capabilities', 'workbench_help', 'workbench_execute']);
  assert.equal(listed.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(listed.result.tools[2].annotations.destructiveHint, true);
  const called = await client.request(3, 'tools/call', { name: 'workbench_capabilities', arguments: {} });
  assert.equal(called.result.isError, false, called.result.content?.[0]?.text);
  const execution = JSON.parse(called.result.content[0].text);
  assert.equal(execution.exitCode, 0, execution.stderr);
  assert.match(execution.stdout, /capabilit/i);
});
