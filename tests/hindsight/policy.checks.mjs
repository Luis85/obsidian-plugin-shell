import test from 'node:test';
import assert from 'node:assert/strict';
import { consent, identity, loopback, object, configured, disabled, requireEnabled, document, seedPlan } from '../../scripts/hindsight/policy.ts';
import { install, installationPlan } from '../../scripts/hindsight/install.ts';
import { paths } from '../../scripts/hindsight/io.ts';
const repo = identity('/work/repo', '/work/repo/.git', 'git@github.com:Owner/Repo.git');
const choice = consent('claude-code,codex', 'message', false);
const endpoint = 'http://127.0.0.1:9876';
const config = () => configured({}, repo, endpoint, choice);
const fails = (callback, code) => assert.throws(callback, error => error.code === code);

test('GitHub identity normalizes transport, case and credentials without putting secrets in bank IDs', () => {
  for (const remote of ['https://github.com/owner/repo', 'https://token@github.com/OWNER/REPO.git', 'ssh://git@github.com/owner/repo.git']) {
    assert.equal(identity('/elsewhere', '/elsewhere/.git', remote).bank, repo.bank);
  }
  assert.equal(repo.github, 'owner/repo');
  assert.match(repo.bank, /^shell-[a-f0-9]{24}$/);
});
test('forks and equal basenames owned by different organizations never share banks', () => {
  assert.notEqual(identity('/work/fork', '/work/fork/.git', 'git@github.com:Fork/Repo.git').bank, repo.bank);
});
test('offline repositories use common Git directory so linked worktrees share identity', () => {
  assert.equal(identity('/main', '/main/.git', '').bank, identity('/worktree', '/main/.git', '').bank);
  assert.notEqual(identity('/other', '/other/.git', '').bank, identity('/main', '/main/.git', '').bank);
});
for (const url of ['https://cloud.example', 'http://127.0.0.1.evil.test', 'file:///tmp/db', 'http://user:password@localhost', 'http://localhost/path', 'http://localhost?secret=x']) {
  test(`remote or credential-bearing endpoint is refused: ${url.split('@').at(-1)}`, () => fails(() => loopback(url), 'ENDPOINT_INVALID'));
}
test('IPv6 and IPv4 loopback endpoints are accepted', () => {
  assert.equal(loopback('http://[::1]:9876/'), 'http://[::1]:9876');
  assert.equal(loopback(endpoint), endpoint);
});
test('agent installation requires explicit supported targets, never all', () => {
  fails(() => consent('', 'message', false), 'AGENT_REQUIRED');
  fails(() => consent('all', 'message', false), 'AGENT_REQUIRED');
  fails(() => consent('codex', 'all', false), 'GIT_MODE_INVALID');
  assert.deepEqual(consent('codex,codex', 'none', true).agents, ['codex']);
});
test('new configuration is opt-in only with source survey and session retention off', () => {
  const data = config();
  assert.equal(data.optInOnly, true); assert.equal(data.autoUpdate, false);
  assert.deepEqual(data.optInPaths, []); assert.equal(data.retainSessions, false);
  const bank = data.banks[repo.bank];
  assert.equal(bank.gitIngest, 'message'); assert.equal(bank.retainSessions, false);
  assert.equal(bank.codebaseSurvey, false); assert.equal(bank.pageTriggerType, 'manual');
  assert.equal(requireEnabled(data, repo), endpoint);
  fails(() => requireEnabled({}, repo), 'NOT_ENABLED');
});
test('unrelated banks, mappings, root preferences and harness settings are preserved', () => {
  const existing = { ...config(), gitIngest: 'full', retainSessions: true, customPreference: 'keep',
    harnesses: { codex: { recallBudget: 8192 } }, mapPathToBank: { '/other': 'other-bank' },
    banks: { 'other-bank': { disabled: false, retainSessions: true } } };
  const before = structuredClone(existing);
  const next = configured(existing, repo, endpoint, choice);
  assert.deepEqual(existing, before);
  assert.deepEqual(next.banks['other-bank'], existing.banks['other-bank']);
  assert.deepEqual(next.harnesses, existing.harnesses); assert.equal(next.mapPathToBank['/other'], 'other-bank');
  assert.equal(next.gitIngest, 'full'); assert.equal(next.retainSessions, true);
  assert.equal(next.banks[repo.bank].retainSessions, false);
});
for (const mutation of [data => { data.optInOnly = false; }, data => { data.autoUpdate = true; },
  data => { data.serverMode = 'cloud'; }, data => { data.optInPaths = ['/']; },
  data => { data.harnesses = { codex: { apiUrl: endpoint } }; }]) {
  test('unsafe existing privacy/endpoint overrides fail without rewriting configuration', () => {
    const data = config(); mutation(data); const before = structuredClone(data);
    fails(() => configured(data, repo, endpoint, choice), 'CONFIG_CONFLICT');
    assert.deepEqual(data, before);
  });
}
test('bank aliases and different checkout mappings are refused', () => {
  const data = config(); data.mapPathToBank[repo.root] = 'other';
  fails(() => configured(data, repo, endpoint, choice), 'BANK_CONFLICT');
  data.mapPathToBank[repo.root] = repo.bank; data.banks[repo.bank].bank = 'elsewhere';
  fails(() => configured(data, repo, endpoint, choice), 'BANK_CONFLICT');
});
test('disable preserves retained data, mappings and other settings', () => {
  const data = config(); const next = disabled(data, repo);
  assert.equal(next.banks[repo.bank].disabled, true);
  assert.deepEqual(next.mapPathToBank, data.mapPathToBank);
  fails(() => requireEnabled(next, repo), 'NOT_ENABLED');
});
test('dangerous JSON keys and malformed configuration fail closed', () => {
  fails(() => object(JSON.parse('{"__proto__":{}}')), 'CONFIG_INVALID');
  fails(() => object([]), 'CONFIG_INVALID');
});
test('source IDs are stable; hashes change with content and commits; plan omits document bodies', () => {
  const a = document(repo, 'docs/memory/decisions/example.md', 'first\n', 'a'.repeat(40));
  const b = document(repo, a.path, 'second\n', 'b'.repeat(40));
  assert.equal(a.documentId, b.documentId); assert.notEqual(a.sha256, b.sha256);
  assert.notEqual(seedPlan(repo, [a]).planHash, seedPlan(repo, [b]).planHash);
  assert.equal('content' in seedPlan(repo, [a]).sources[0], false);
});
test('traversal, unreviewed paths, oversized bodies and common credential patterns are refused', () => {
  for (const path of ['.env', 'docs/memory/../secret.md', '/docs/memory/a.md', 'src/main.ts'])
    fails(() => document(repo, path, 'text', 'a'.repeat(40)), 'SOURCE_DENIED');
  fails(() => document(repo, 'docs/memory/a.md', 'x'.repeat(65537), 'a'.repeat(40)), 'SOURCE_INVALID');
  fails(() => document(repo, 'docs/memory/a.md', `ghp_${'a'.repeat(30)}`, 'a'.repeat(40)), 'SECRET_DETECTED');
});
function installerPort(failNative = false) {
  let data = {}; let original = null; const calls = [];
  return { calls, snapshot: () => data,
    execute: (cmd, args) => { calls.push([cmd, args]); if (args.includes('self-hosted')) {
      assert.equal(data.banks[repo.bank].disabled, true);
      if (failNative) throw new Error('fixture native failure');
    } }, npm: args => calls.push(['npm', args]), backend: () => ({ url: endpoint }),
    read: () => ({ data, original }), save: (next, expected) => { assert.equal(original, expected); data = structuredClone(next); original = JSON.stringify(next); },
    pythonExists: () => false, announce: () => {} };
}
test('install preview is pure and discloses processing and exact top-level versions', () => {
  const plan = installationPlan(repo, paths('/fake-home'), choice);
  assert.equal(plan.privacy.retainSessions, false); assert.equal(plan.packages.length, 3);
  assert.ok(plan.effects.some(text => text.includes('LLM')));
});
test('installation wires only explicit agents, pins dependencies, then enables the bank', () => {
  const port = installerPort(); const result = install(repo, paths('/fake-home'), choice, 'python3', port);
  assert.equal(result.ok, true); assert.equal(port.snapshot().banks[repo.bank].disabled, false);
  const native = port.calls.at(-1)[1]; assert.ok(native.includes('codex')); assert.ok(native.includes('claude-code'));
  assert.ok(!native.includes('all')); assert.ok(native.includes('self-hosted'));
  assert.ok(port.calls.find(([cmd]) => cmd === 'npm')[1].includes('--ignore-scripts'));
});
test('native installation failure leaves a disabled recoverable bank, never false success', () => {
  const port = installerPort(true);
  assert.throws(() => install(repo, paths('/fake-home'), choice, 'python3', port), /fixture native failure/);
  assert.equal(port.snapshot().banks[repo.bank].disabled, true);
});
test('linked worktree status honors an explicitly mapped main checkout', () => {
  const linked = { ...repo, root: '/work/linked', mainRoot: repo.root };
  assert.equal(requireEnabled(config(), linked), endpoint);
  fails(() => requireEnabled(disabled(config(), repo), linked), 'NOT_ENABLED');
});
test('native installer cannot silently change approved configuration', () => {
  const port = installerPort(); const execute = port.execute;
  port.execute = (cmd, args) => { execute(cmd, args); if (args.includes('self-hosted')) port.snapshot().optInOnly = false; };
  fails(() => install(repo, paths('/fake-home'), choice, 'python3', port), 'CONFIG_CHANGED');
});
test('existing cloud configuration is rejected before any installation effects', () => {
  const port = installerPort(); port.read = () => ({ data: { serverMode: 'cloud' }, original: '{}' });
  fails(() => install(repo, paths('/fake-home'), choice, 'python3', port), 'CONFIG_CONFLICT');
  assert.equal(port.calls.length, 0);
});
