import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { applyFilePlan } from '../../src/shared/platform/file-plan.ts';
import { planLocalMcp } from '../setup/mcp.mjs';
import { setupOptions } from '../setup/options.mjs';
import { fixture, run, snapshot } from './setup-identity-fixture.mjs';

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
  assert.deepEqual(planned.files.map(file => file.path), ['.mcp.json', '.codex/config.toml', '.claude/settings.local.json']);
  assert.ok(planned.files.every(file => file.status === 'create'));
  await applyFilePlan(planned.plan);
  const claudeMcp = JSON.parse(await readFile(join(f.root, '.mcp.json'), 'utf8'));
  assert.deepEqual(claudeMcp.mcpServers.workbench.args, ['${CLAUDE_PROJECT_DIR}/bin/app', 'mcp']);
  const claude = JSON.parse(await readFile(join(f.root, '.claude/settings.local.json'), 'utf8'));
  assert.deepEqual(claude.permissions.allow, ['mcp__workbench__workbench_capabilities', 'mcp__workbench__workbench_help']);
  assert.deepEqual(claude.permissions.ask, ['mcp__workbench__workbench_execute']);
  const codex = await readFile(join(f.root, '.codex/config.toml'), 'utf8');
  assert.match(codex, /\[mcp_servers\.workbench\]/); assert.match(codex, /default_tools_approval_mode = "writes"/);
  assert.match(codex, /tool_timeout_sec = 600/); assert.match(codex, /enabled_tools = \["workbench_capabilities", "workbench_help", "workbench_execute"\]/);
  assert.match(codex, /\[mcp_servers\.workbench\.tools\.workbench_capabilities\]\napproval_mode = "approve"/);
  assert.match(codex, /\[mcp_servers\.workbench\.tools\.workbench_help\]\napproval_mode = "approve"/);
  assert.match(codex, /\[mcp_servers\.workbench\.tools\.workbench_execute\]\napproval_mode = "prompt"/);
  const rerun = await planLocalMcp(f.root, true, { enabled: true, files: planned.files });
  assert.ok(rerun.files.every(file => file.status === 'unchanged'));
  const preserved = await planLocalMcp(f.root, 'preserve', { enabled: true, files: planned.files });
  assert.equal(preserved.enabled, true); assert.equal(preserved.action, 'preserve');
  assert.deepEqual(preserved.files, planned.files); assert.equal(preserved.plan.changes.length, 0);
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
  const preserved = run(applied.root, applied.launcher, flags);
  assert.equal(preserved.status, 0, preserved.stdout + preserved.stderr);
  assert.equal(JSON.parse(preserved.stdout).agentMcp.enabled, true);
  const disabled = run(applied.root, applied.launcher, [...flags, '--no-mcp']);
  assert.equal(disabled.status, 0, disabled.stdout + disabled.stderr);
  const disabledResult = JSON.parse(disabled.stdout);
  assert.equal(disabledResult.agentMcp.enabled, false); assert.equal(disabledResult.agentMcp.status, 'verified');
  for (const path of ['.mcp.json', '.codex/config.toml', '.claude/settings.local.json']) {
    await assert.rejects(readFile(join(applied.root, path)), { code: 'ENOENT' });
  }
});

