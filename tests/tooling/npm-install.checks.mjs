import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectInstallEnvironment } from '../../scripts/shared/npm-install.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));

test('[NPM-01] remove only forwarded approval keys across Windows casing', () => {
  const source = Object.freeze({ npm_config_allow_scripts: 'unreviewed',
    NPM_CONFIG_ALLOW_SCRIPTS: 'other', 'npm_config_allow-scripts': 'third',
    npm_config_ignore_scripts: 'true', npm_config_strict_allow_scripts: 'true',
    npm_config_registry: 'https://registry.example.test/', npm_config_proxy: 'local-proxy',
    npm_config_userconfig: 'C:\\Users\\Test User\\.npmrc', NODE_EXTRA_CA_CERTS: 'owned.pem',
    NPM_CONFIG_STRICT_SSL: 'true', npm_config_allow_scripts_pin: 'true',
    npm_execpath: 'C:\\tools with spaces\\npm-cli.js', PATH: 'kept', NPM_TOKEN: 'fixture-not-a-secret' });
  const result = projectInstallEnvironment(source);
  assert.equal(result.removedKeys.length, 3);
  const expected = { ...source };
  delete expected.npm_config_allow_scripts; delete expected.NPM_CONFIG_ALLOW_SCRIPTS;
  delete expected['npm_config_allow-scripts'];
  assert.deepEqual(result.env, expected);
  assert.equal(source.npm_config_allow_scripts, 'unreviewed');
  assert.equal(result.env.npm_config_ignore_scripts, 'true');
});

test('[NPM-02] no-policy and empty-value inputs are deterministic nonmutating copies', () => {
  const source = Object.freeze({ PATH: 'kept' });
  const result = projectInstallEnvironment(source);
  assert.deepEqual(result, { env: { PATH: 'kept' }, removedKeys: [] });
  assert.notEqual(result.env, source);
  assert.deepEqual(projectInstallEnvironment({ npm_config_allow_scripts: '' }).env, {});
});

test('[NPM-03] reviewed pins cover the lockfile hooks without blanket approvals', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  assert.deepEqual(pkg.allowScripts, { 'esbuild@0.28.2': true, 'vue-demi@0.14.10': true, fsevents: false });
  const observed = new Set();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!entry.hasInstallScript) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const key = `${name}@${entry.version}`;
    assert.ok(pkg.allowScripts[key] === true || pkg.allowScripts[name] === false, `Unreviewed lifecycle hook: ${key}`);
    observed.add(key);
  }
  assert.ok(observed.has('esbuild@0.28.2'));
  assert.ok(observed.has('vue-demi@0.14.10'));
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'presetup', 'postsetup'])
    assert.equal(pkg.scripts[hook], undefined, `Recursive setup risk: ${hook}`);
});

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'shell npm spaces ü-'));
  await mkdir(join(dir, 'scripts'), { recursive: true });
  await cp(join(root, 'scripts/setup.mjs'), join(dir, 'scripts/setup.mjs'));
  await cp(join(root, 'scripts/setup'), join(dir, 'scripts/setup'), { recursive: true });
  await cp(join(root, 'scripts/shared'), join(dir, 'scripts/shared'), { recursive: true });
  await cp(join(root, 'package.json'), join(dir, 'package.json'));
  for (const name of ['manifest.json', 'package-lock.json', 'versions.json']) await cp(join(root, name), join(dir, name));
  return dir;
}

test('[NPM-04] real setup CLI isolates npm env with stub tools and preserves stricter controls', async () => {
  const dir = await fixture();
  try {
    const launcher = join(dir, 'npm launcher.mjs');
    await writeFile(launcher, `import {writeFileSync,mkdirSync} from 'node:fs';
      if(process.argv[2] === '--version') { console.log('11.19.1'); process.exit(0); }
      if (Object.keys(process.env).some(k => k.toLowerCase().replaceAll('-', '_') === 'npm_config_allow_scripts')) {
        console.error('EALLOWSCRIPTS'); process.exit(1);
      }
      mkdirSync('node_modules', {recursive:true});writeFileSync('node_modules/.package-lock.json', JSON.stringify({packages:{}}));
      writeFileSync('probe.json', JSON.stringify({args:process.argv.slice(2),
        ignore:process.env.npm_config_ignore_scripts, strict:process.env.npm_config_strict_allow_scripts}));`);
    for (const path of ['scripts/quality/verify.mjs']) {
      const target = join(dir, path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, `// Stub: this test asserts the CLI boundary, not build or Vitest behavior.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
mkdirSync('dist',{recursive:true});writeFileSync('dist/main.js','fixture');writeFileSync('dist/styles.css','.fixture{}');writeFileSync('dist/manifest.json',readFileSync('manifest.json'));`);
    }
    const result = spawnSync(process.execPath, [join(dir, 'scripts/setup.mjs'), '--yes', '--no-interaction', '--no-local'], {
      cwd: dir, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, npm_execpath: launcher, npm_config_allow_scripts: 'not-approved',
        npm_config_ignore_scripts: 'true', npm_config_strict_allow_scripts: 'true' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /discard the forwarded/);
    assert.doesNotMatch(result.stdout, /not-approved/);
    const probe = JSON.parse(await readFile(join(dir, 'probe.json'), 'utf8'));
    assert.deepEqual(probe, { args: ['ci', '--no-fund'], ignore: 'true', strict: 'true' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('[NPM-05] dry-run needs no dependency installation and does not launch npm', async () => {
  const dir = await fixture();
  try {
    const result = spawnSync(process.execPath, [join(dir, 'scripts/setup.mjs'), '--dry-run'], {
      cwd: dir, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, npm_execpath: join(dir, 'does-not-exist.mjs'), npm_config_allow_scripts: 'fixture-only' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Dry run/);
    await assert.rejects(readFile(join(dir, 'node_modules/.package-lock.json')), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
