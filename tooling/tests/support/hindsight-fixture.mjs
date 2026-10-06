/** Disposable Git/user-home fixture. No provider SDK, registry or personal config access. */
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { configured, consent } from '../../../src/cli/tooling/hindsight/policy.ts';
import { paths, repository, saveConfig } from '../../../src/cli/tooling/hindsight/io.ts';
export function fixture(t, enabled = false) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'memory-polish-')));
  const root = join(base, 'repo'); const home = join(base, 'home'); mkdirSync(root); mkdirSync(home);
  const git = args => { const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git(['init', '--quiet']); git(['config', 'user.email', 'tests@example.invalid']); git(['config', 'user.name', 'Fixture']);
  git(['remote', 'add', 'origin', 'https://github.com/example/polish.git']);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const repo = repository(root); const p = paths(home);
  if (enabled) saveConfig(p.config, configured({}, repo, 'http://127.0.0.1:9876', consent('codex', 'none', false)), null);
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'), APPDATA: join(home, 'AppData/Roaming'), HINDSIGHT_CONFIG: '', HINDSIGHT_API_LLM_PROVIDER: '', HINDSIGHT_API_LLM_MODEL: '' };
  const cli = fileURLToPath(new URL('../../../src/cli/tooling/hindsight/cli.ts', import.meta.url));
  return { ...p, p, root, home, repo, git, env,
    invoke: (args, extra = {}) => spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], { cwd: root, env, encoding: 'utf8', timeout: 60000, ...extra }),
  };
}
export function fakeNative(f, body) {
  const packageRoot = dirname(dirname(f.installer)); mkdirSync(dirname(f.installer), { recursive: true });
  writeFileSync(join(packageRoot, 'package.json'), '{"version":"0.7.0","type":"module"}');
  writeFileSync(join(dirname(f.installer), 'mcp-server.js'), body);
}
export const fakeServer = `import readline from 'node:readline';
const reader = readline.createInterface({input:process.stdin});
reader.on('line', line => { const r=JSON.parse(line); if (!r.id) return;
if(r.method !== 'initialize' && r.method !== 'tools/list') process.exit(7);
const result = r.method==='initialize' ? {protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}} : {tools:[{name:'fixture_recall',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]};
console.log(JSON.stringify({jsonrpc:'2.0',id:r.id,result})); });`;
