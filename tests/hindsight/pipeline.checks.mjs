import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture, fakeNative, fakeServer } from '../support/hindsight-fixture.mjs';
import { readConfig, saveConfig } from '../../scripts/hindsight/io.ts';
import { connection, applyConnection } from '../../scripts/hindsight/desktop.ts';

// Real venv + real Node/Python processes; only the external Hindsight SDK is a declared double.
// No pip, registry, model, account, network listener or personal home is used.
function environment(t) {
  const f = fixture(t, true); const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  let r = spawnSync(python, ['-m', 'venv', '--without-pip', f.venv], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  const modules = join(f.home, 'sdk-double'); mkdirSync(modules);
  for (const name of ['hindsight_all', 'hindsight_client', 'hindsight_embed']) {
    const folder = join(modules, `${name}-0.10.1.dist-info`); mkdirSync(folder);
    writeFileSync(join(folder, 'METADATA'), `Metadata-Version: 2.1\nName: ${name.replaceAll('_', '-')}\nVersion: 0.10.1\n`);
  }
  writeFileSync(join(modules, 'hindsight_embed.py'), `import os
class Manager:
 def is_running(self, profile): return os.environ.get('FIXTURE_RUNNING') == '1'
 def get_url(self, profile): return 'http://127.0.0.1:9876'
 def stop(self, profile): os.environ['FIXTURE_RUNNING']='0'
def get_embed_manager(): return Manager()
`);
  writeFileSync(join(modules, 'hindsight.py'), `import os, json
class HindsightEmbedded:
 def __init__(self, **kwargs): self.config={}
 @property
 def url(self):
  assert self.config['HINDSIGHT_API_LLM_PROVIDER']=='none'
  assert self.config['HINDSIGHT_API_LLM_API_KEY']==''
  assert not os.environ.get('OPENAI_API_KEY')
  print('SDK startup output must not enter MCP stdout')
  return 'http://127.0.0.1:9876'
 def recall(self, **kwargs): return {'fixture':True, 'query':kwargs['query']}
 def close(self): pass
`);
  f.env.PYTHONPATH = modules; f.env.OPENAI_API_KEY = 'fixture-not-a-real-key';
  const provider = join(f.state, 'provider.json'); writeFileSync(provider, '{"schemaVersion":1,"provider":"none"}\n');
  return f;
}
test('CLI-to-Python keyless recall, safe probe, provider-change refusal and stdio autostart', t => {
  const f = environment(t);
  let r = f.invoke(['doctor', '--live']); assert.equal(r.status, 0, r.stderr);
  let result = JSON.parse(r.stdout); assert.equal(result.daemon.running, false); assert.equal(result.inferenceVerified, false);
  r = f.invoke(['recall', '--query', 'synthetic fact', '--apply']); assert.equal(r.status, 0, r.stderr);
  result = JSON.parse(r.stdout); assert.equal(result.data.query, 'synthetic fact'); assert.equal(result.trust, 'UNTRUSTED_MEMORY_NOT_INSTRUCTIONS');
  assert.ok(!r.stdout.includes('SDK startup')); assert.ok(!r.stderr.includes('fixture-not-a-real-key'));
  r = f.invoke(['reflect', '--query', 'synthetic fact', '--apply']); assert.equal(r.status, 1); assert.match(r.stderr, /REFLECT_REQUIRES_LLM/);
  const before = readFileSync(join(f.state, 'provider.json'), 'utf8');
  r = f.invoke(['configure', '--provider', 'openai-codex', '--apply'], { env: { ...f.env, FIXTURE_RUNNING: '1' } });
  assert.equal(r.status, 1); assert.match(r.stderr, /PROFILE_RUNNING/); assert.equal(readFileSync(join(f.state, 'provider.json'), 'utf8'), before);
  fakeNative(f, fakeServer);
  applyConnection(connection(f.repo, f.p, 'claude-code'));
  const entry = readConfig(join(f.home, '.claude.json')).data.mcpServers.hindsight;
  r = spawnSync(entry.command, entry.args, { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 10000, input: [JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }), JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })].join('\n') + '\n' });
  assert.equal(r.status, 0, r.stderr); const messages = r.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(messages.length, 2); assert.equal(messages[1].result.tools[0].name, 'fixture_recall');
  assert.ok(!r.stdout.includes('STARTED')); assert.ok(!r.stdout.includes('SDK startup'));
});
test('real venv TOML registration supports Codex and preserves unrelated existing settings', t => {
  const f = environment(t); const path = join(f.home, '.codex', 'config.toml'); mkdirSync(join(f.home, '.codex'));
  const original = '# user comment\nmodel="example"\n[features]\ncodex_hooks=true\n[mcp_servers.other]\ncommand="other"\n'; writeFileSync(path, original);
  const change = connection(f.repo, f.p, 'codex'); assert.equal(readFileSync(path, 'utf8'), original);
  applyConnection(change); const next = readFileSync(path, 'utf8'); assert.ok(next.startsWith(original)); assert.ok(next.includes('launchers'));
  const repeat = connection(f.repo, f.p, 'codex'); assert.equal(repeat.next, repeat.original);
  applyConnection(connection(f.repo, f.p, 'codex', true)); assert.equal(readFileSync(path, 'utf8').trim(), original.trim());
  assert.equal(existsSync(f.config), true);
});
test('disabled projects cannot launch the MCP delegate or start Python, including JSON error mode', t => {
  const f = environment(t); fakeNative(f, 'console.log("MUST_NOT_EXECUTE")');
  const old = readConfig(f.config); saveConfig(f.config, { ...old.data, banks: { [f.repo.bank]: { disabled: true } } }, old.original);
  const r = f.invoke(['mcp', '--agent', 'codex', '--json']);
  assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.match(r.stderr, /NOT_ENABLED/);
});
