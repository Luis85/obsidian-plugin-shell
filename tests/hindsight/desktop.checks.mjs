import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { providerSettings, providerPlan } from '../../scripts/hindsight/provider.ts';
import { requireEnabled } from '../../scripts/hindsight/policy.ts';
import { readConfig, saveConfig } from '../../scripts/hindsight/io.ts';
import { connection, applyConnection, mcpEntry, replaceToml, parseToml, connectionStatus } from '../../scripts/hindsight/desktop.ts';
import { discoverTools, nativeServer, launchMcp } from '../../scripts/hindsight/mcp.ts';
import { fixture, fakeNative, fakeServer } from '../support/hindsight-fixture.mjs';
import { launcherPlan, stageLauncher } from '../../scripts/hindsight/launcher.ts';
const fails = (callback, code) => assert.throws(callback, e => e.code === code);
for (const provider of ['none', 'openai-codex', 'claude-code', 'ollama', 'lmstudio']) {
  test(`keyless ${provider} persists no API key`, () => {
    const settings = providerSettings({ schemaVersion: 1, provider, ...(['ollama', 'lmstudio'].includes(provider) ? { model: 'local-model:latest' } : {}) });
    assert.equal(providerPlan(settings).key, false); assert.equal('apiKey' in settings, false);
  });
}
test('provider schema rejects credentials, remote local endpoints, missing models and command-like models', () => {
  for (const patch of [{ apiKey: 'SECRET' }, { model: 'x && do-bad' }, { baseUrl: 'https://example.org/v1' }]) {
    assert.throws(() => providerSettings({ schemaVersion: 1, provider: 'ollama', model: 'local', ...patch }));
  }
  fails(() => providerSettings({ schemaVersion: 1, provider: 'ollama' }), 'MODEL_REQUIRED');
  fails(() => providerSettings({ schemaVersion: 1, provider: 'none', model: 'local' }), 'MODEL_INVALID');
});
test('Codex can persist a separate non-secret auth home, not an auth token', t => {
  const f = fixture(t); const value = providerSettings({ schemaVersion: 1, provider: 'openai-codex', authHome: join(f.home, 'service-auth') });
  assert.equal(value.authHome, join(f.home, 'service-auth'));
  fails(() => providerSettings({ ...value, provider: 'none' }), 'AUTH_HOME_INVALID');
  fails(() => providerSettings({ ...value, authHome: 'relative' }), 'AUTH_HOME_INVALID');
});
test('configure preview and keyless apply work without Python, packages, keys, or daemon', t => {
  const f = fixture(t);
  let r = f.invoke(['configure', '--provider', 'none']); assert.equal(r.status, 0, r.stderr); assert.deepEqual(readdirSync(f.home), []);
  r = f.invoke(['configure', '--provider', 'none', '--apply']); assert.equal(r.status, 0, r.stderr);
  const path = join(f.state, 'provider.json'); const data = readFileSync(path, 'utf8');
  assert.deepEqual(JSON.parse(data), { schemaVersion: 1, provider: 'none' });
  assert.equal(existsSync(f.config), false); assert.equal(existsSync(f.venv), false);
  r = f.invoke(['configure', '--provider', 'none', '--apply']); assert.equal(r.status, 0, r.stderr);
  assert.equal(readdirSync(f.state).filter(n => n.includes('backup')).length, 0);
});
test('setup preview exposes full keyless provider and desktop flow without writes', t => {
  const f = fixture(t); const r = f.invoke(['setup', '--agents', 'claude-code,codex', '--provider', 'none']);
  assert.equal(r.status, 0, r.stderr); const plan = JSON.parse(r.stdout);
  assert.equal(plan.provider.provider, 'none'); assert.deepEqual(plan.desktopConnections, ['claude-code', 'codex']);
  assert.deepEqual(readdirSync(f.home), []);
});
test('agent-ready project defaults are preview-only and cannot bypass processing consent', t => {
  const f = fixture(t); mkdirSync(join(f.root, 'design'));
  writeFileSync(join(f.root, 'design/project.json'), JSON.stringify({ tooling: { hindsight: {
    enabled: true, agents: ['claude-code', 'codex'], git: 'message', sessions: false,
  } } }));
  let r = f.invoke(['setup', '--provider', 'none']); assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout); assert.deepEqual(plan.agents, ['claude-code', 'codex']);
  assert.equal(plan.privacy.gitIngest, 'message'); assert.equal(plan.privacy.retainSessions, false);
  assert.equal(plan.projectDefaults.source, 'design/project.json'); assert.deepEqual(readdirSync(f.home), []);
  r = f.invoke(['setup', '--provider', 'none', '--apply']); assert.equal(r.status, 1);
  assert.match(r.stderr, /CONSENT_REQUIRED/); assert.deepEqual(readdirSync(f.home), []);
});
test('invalid project Hindsight defaults fail closed without user-scope writes', t => {
  const f = fixture(t); mkdirSync(join(f.root, 'design'));
  writeFileSync(join(f.root, 'design/project.json'), JSON.stringify({ tooling: { hindsight: {
    enabled: true, agents: ['all'], git: 'message', sessions: false,
  } } }));
  const r = f.invoke(['setup', '--provider', 'none']); assert.equal(r.status, 1);
  assert.match(r.stderr, /PROJECT_MEMORY_CONFIG_INVALID/); assert.deepEqual(readdirSync(f.home), []);
});
test('new flags fail closed; no query processing or live discovery under dry-run', t => {
  const f = fixture(t);
  for (const args of [['setup', '--agents', 'codex', '--provider', 'none', '--apply'], ['doctor', '--live', '--dry-run'], ['tools', '--agent', 'codex', '--live', '--dry-run'], ['mcp', '--agent', 'codex', '--dry-run'], ['configure', '--provider', 'none', '--provider', 'ollama'], ['recall', '--query', ''], ['status', '--provider', 'none']]) {
    const r = f.invoke(args); assert.equal(r.status, 1); assert.deepEqual(readdirSync(f.home), []);
  }
});
test('global disable blocks status, MCP startup and recall even if a bank was enabled', t => {
  const f = fixture(t, true); const before = readConfig(f.config); saveConfig(f.config, { ...before.data, disabled: true }, before.original);
  fails(() => requireEnabled(readConfig(f.config).data, f.repo), 'NOT_ENABLED');
  fails(() => launchMcp(f.repo, f.p, 'codex'), 'NOT_ENABLED');
  const r = f.invoke(['recall', '--query', 'sample', '--apply']); assert.equal(r.status, 1); assert.match(r.stderr, /NOT_ENABLED/);
});
test('Claude Code registration is previewed, backed up, idempotent and selectively disconnected', t => {
  const f = fixture(t, true); const path = join(f.home, '.claude.json');
  writeFileSync(path, JSON.stringify({ preference: 'keep', mcpServers: { other: { command: 'other-server', env: { SECRET: 'do-not-print' } } } }));
  const before = readFileSync(path, 'utf8'); const change = connection(f.repo, f.p, 'claude-code');
  assert.equal(readFileSync(path, 'utf8'), before); assert.ok(!JSON.stringify(change.plan).includes('do-not-print'));
  applyConnection(change); const next = readConfig(path).data;
  assert.equal(next.preference, 'keep'); assert.equal(next.mcpServers.other.env.SECRET, 'do-not-print');
  assert.deepEqual(next.mcpServers.hindsight, mcpEntry(f.repo, 'claude-code', f.p));
  assert.equal(connectionStatus(f.repo, f.p, 'claude-code').state, 'REGISTERED');
  const repeat = connection(f.repo, f.p, 'claude-code'); assert.equal(repeat.next, repeat.original);
  applyConnection(repeat); assert.equal(readdirSync(f.home).filter(n => n.includes('backup')).length, 1);
  applyConnection(connection(f.repo, f.p, 'claude-code', true)); assert.equal(readConfig(path).data.mcpServers.hindsight, undefined);
  assert.deepEqual(readConfig(path).data.mcpServers.other, next.mcpServers.other);
});
test('foreign and customized MCP entries are refused rather than overwritten', t => {
  const f = fixture(t); const path = join(f.home, '.claude.json');
  for (const value of [{ command: 'some-other-service', args: [] }, { ...mcpEntry(f.repo, 'claude-code', f.p), env: { CUSTOM_SECRET: 'private' } }]) {
    writeFileSync(path, JSON.stringify({ mcpServers: { hindsight: value } })); const before = readFileSync(path, 'utf8');
    fails(() => connection(f.repo, f.p, 'claude-code'), 'MCP_CONFLICT'); assert.equal(readFileSync(path, 'utf8'), before);
  }
});
test('stale desktop plans reject concurrent edits without destroying them', t => {
  const f = fixture(t); const c = connection(f.repo, f.p, 'claude-code'); writeFileSync(c.path, '{"user":"new edit"}');
  fails(() => applyConnection(c), 'CONFIG_CHANGED'); assert.equal(readFileSync(c.path, 'utf8'), '{"user":"new edit"}');
});
test('chat desktop uses a repo-specific server name and explicit root instead of ambiguous cwd', t => {
  const f = fixture(t); const c = connection(f.repo, f.p, 'claude-desktop', false, 'darwin');
  assert.equal(c.plan.server, `hindsight-${f.repo.bank}`); assert.ok(c.plan.entry.args.includes('--root'));
  // repository() canonicalizes the Git path; Windows may normalize drive/path casing.
  assert.equal(c.plan.entry.args.at(-1), f.repo.root);
  assert.equal(existsSync(c.path), false);
});
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
test('Codex TOML edits preserve other tables, comments and CRLF and round-trip disconnect', () => {
  const parse = text => parseToml(text, python);
  const original = '# keep comment\r\nmodel = "example"\r\n[mcp_servers.other]\r\ncommand = "other"\r\n';
  const entry = { command: 'node', args: ['memory.mjs'] };
  const next = replaceToml(original, 'hindsight', entry, parse);
  assert.ok(next.startsWith(original)); assert.ok(!/(?<!\r)\n/.test(next));
  assert.equal(parse(next).mcp_servers.other.command, 'other');
  assert.equal(replaceToml(next, 'hindsight', entry, parse), next);
  assert.deepEqual(parse(replaceToml(next, 'hindsight', null, parse)), parse(original));
});
test('unusual existing TOML shape is preserved through fail-closed rejection', () => {
  const parse = text => parseToml(text, python); const odd = '[mcp_servers."hindsight"]\ncommand="node"\n';
  fails(() => replaceToml(odd, 'hindsight', { command: 'node', args: [] }, parse), 'CONFIG_CONFLICT');
  assert.throws(() => replaceToml('not valid = [[', 'hindsight', null, parse));
});
test('real MCP initialize/list handshake uses project-bound upstream entry and never calls tools', async t => {
  const f = fixture(t, true); fakeNative(f, fakeServer);
  const result = await discoverTools(f.repo, f.p, 'codex'); assert.equal(result.tools[0].name, 'fixture_recall');
  assert.equal(result.daemonStarted, false); assert.equal(result.inferenceVerified, false); assert.equal(existsSync(f.venv), false);
});
test('MCP malformed output and a stalled server fail with bounded, safe diagnostics', async t => {
  const f = fixture(t, true); fakeNative(f, 'console.log("SENSITIVE INVALID OUTPUT")');
  await assert.rejects(discoverTools(f.repo, f.p, 'codex'), e => e.code === 'MCP_DISCOVERY_FAILED' && !e.message.includes('SENSITIVE'));
  fakeNative(f, 'process.stdin.resume();');
  await assert.rejects(discoverTools(f.repo, f.p, 'codex', 100), e => e.code === 'MCP_DISCOVERY_FAILED');
});
test('MCP discovery refuses a wrong package version or unapproved repository before spawning', t => {
  const f = fixture(t, true); fakeNative(f, fakeServer); writeFileSync(join(dirname(dirname(f.installer)), 'package.json'), '{"version":"wrong"}');
  fails(() => nativeServer(f.p), 'AGENT_VERSION_MISMATCH');
  fails(() => discoverTools({ ...f.repo, root: join(f.root, 'other'), mainRoot: undefined }, f.p, 'codex'), 'NOT_ENABLED');
});
test('shell memory and help memory work without framework dependencies, Git or Python', t => {
  const f = fixture(t); const shell = new URL('../../bin/app', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(shell), 'help', 'memory', '--json'], { cwd: f.home, env: f.env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(JSON.parse(result.stdout).help, /--provider/);
  assert.deepEqual(readdirSync(f.home), []);
});

function launcherFixture(f) {
  const source = join(f.root, 'tooling'); mkdirSync(source);
  for (const file of launcherPlan(f.p).files.filter(file => file.name !== 'package.json')) {
    const path = join(source, file.name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, '// reviewed fixture\n');
  }
  return source;
}
test('launcher plan is pure and staged snapshots are reusable without checkout paths in registration', t => {
  const f = fixture(t); const source = launcherFixture(f); const plan = launcherPlan(f.p, source);
  assert.deepEqual(readdirSync(f.home), []); stageLauncher(f.p, plan);
  assert.equal(readFileSync(join(plan.directory, 'cli.ts'), 'utf8'), '// reviewed fixture\n');
  assert.equal(readFileSync(join(plan.directory, '../shared/hash.ts'), 'utf8'), '// reviewed fixture\n');
  stageLauncher(f.p, plan); assert.deepEqual(readdirSync(dirname(plan.directory)).sort(), ['companion', 'hindsight', 'shared']);
  const entry = mcpEntry(f.repo, 'claude-code', f.p); assert.ok(entry.args[1].startsWith(join(f.state, 'launchers')));
});
test('changed launcher source invalidates its plan before creating a snapshot', t => {
  const f = fixture(t); const source = launcherFixture(f); const plan = launcherPlan(f.p, source);
  writeFileSync(join(source, 'cli.ts'), '// changed\n'); fails(() => stageLauncher(f.p, plan), 'PLAN_CHANGED');
  assert.equal(existsSync(plan.directory), false); assert.deepEqual(readdirSync(f.home), []);
});
test('the staged launcher is self-contained: every relative import resolves to a staged file', t => {
  const f = fixture(t); const plan = launcherPlan(f.p); const staged = new Set(plan.files.map(file => file.name));
  for (const file of plan.files.filter(file => /\.(?:ts|mjs)$/.test(file.name))) {
    const text = readFileSync(join(plan.source, file.name), 'utf8');
    for (const [, specifier] of text.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g))
      assert.ok(staged.has(posix.normalize(posix.join(posix.dirname(file.name), specifier))), `${file.name} imports ${specifier}, which the launcher snapshot does not stage`);
  }
});
test('modified existing snapshot is preserved and rejected instead of silently overwritten', t => {
  const f = fixture(t); const source = launcherFixture(f); const plan = launcherPlan(f.p, source); stageLauncher(f.p, plan);
  const file = join(plan.directory, 'cli.ts'); writeFileSync(file, '// local edit\n');
  fails(() => stageLauncher(f.p, plan), 'LAUNCHER_CHANGED'); assert.equal(readFileSync(file, 'utf8'), '// local edit\n');
});
test('MCP discovery rejects invalid UTF-8 instead of accepting replacement characters', async t => {
  const f = fixture(t, true); fakeNative(f, "process.stdout.write(Buffer.from([0xff,10]));");
  await assert.rejects(discoverTools(f.repo, f.p, 'codex'), e => e.code === 'MCP_DISCOVERY_FAILED');
});

for (const outcome of ['success', 'malformed', 'timeout']) {
  test(`MCP ${outcome} settles only after its owned discovery process closes`, async t => {
    const f = fixture(t, true); const pidFile = join(f.home, 'discovery.pid');
    const prefix = `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\n`;
    fakeNative(f, prefix + (outcome === 'success' ? fakeServer : outcome === 'malformed' ? 'console.log("SENSITIVE INVALID OUTPUT");' : 'process.stdin.resume();'));
    let pid;
    try {
      if (outcome === 'success') assert.equal((await discoverTools(f.repo, f.p, 'codex')).tools[0].name, 'fixture_recall');
      else await assert.rejects(discoverTools(f.repo, f.p, 'codex', outcome === 'timeout' ? 1500 : 10000),
        error => error.code === 'MCP_DISCOVERY_FAILED' && !error.message.includes('SENSITIVE'));
      pid = Number(readFileSync(pidFile, 'utf8')); assert.ok(Number.isSafeInteger(pid) && pid > 0);
      assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', 'Discovery returned while its child was still alive');
    } finally {
      // Failed-reproducer cleanup only: target the PID written by this owned fixture.
      if (!pid && existsSync(pidFile)) pid = Number(readFileSync(pidFile, 'utf8'));
      if (pid) { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    }
  });
}
