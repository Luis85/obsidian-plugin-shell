const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { loadCompiler } = require('../scripts/compiler.cjs');

// Explicit SDK-shaped test doubles exercise selection only, not real TypeScript compilation.
function fixture(t, version = '6.0.3') {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jev compiler '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('package.json', { devDependencies: { typescript: version } });
  write('package-lock.json', { packages: { '': { devDependencies: { typescript: version } }, 'node_modules/typescript': { version } } });
  write('scripts/security/dependency-policy.json', { packages: { typescript: version } });
  const install = installed => {
    write('node_modules/typescript/package.json', { name: 'typescript', version: installed });
    write('node_modules/typescript/lib/typescript.js', `module.exports = {version: ${JSON.stringify(installed)}};`);
  };
  return { root, write, install };
}
test('selects the exact workspace TypeScript 6 without shell/path resolution', t => {
  const f = fixture(t); f.install('6.0.3');
  assert.equal(loadCompiler(f.root, { PATH: '/not/a/compiler' }).version, '6.0.3');
});
test('missing workspace compiler cannot fall back to a global compiler', t => {
  const f = fixture(t);
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_MISSING/);
});
for (const version of ['5.8.3', '6.0.2', '7.0.2']) test('rejects installed compiler ' + version + ' before loading its code', t => {
  const f = fixture(t); f.install(version);
  f.write('node_modules/typescript/lib/typescript.js', 'throw new Error("SHOULD_NOT_EXECUTE");');
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_VERSION_MISMATCH/);
});
for (const version of ['5.8.3', '^6.0.3', '6.0.3-beta', '7.0.2']) test('rejects coordinated unsupported root pin ' + version, t => {
  const f = fixture(t, version); f.install(version);
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_PIN_INVALID/);
});
test('rejects lockfile and reviewed-policy drift independently', t => {
  const f = fixture(t); f.install('6.0.3');
  f.write('scripts/security/dependency-policy.json', { packages: { typescript: '5.8.3' } });
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_PIN_MISMATCH/);
  f.write('scripts/security/dependency-policy.json', { packages: { typescript: '6.0.3' } });
  f.write('package-lock.json', { packages: { '': { devDependencies: { typescript: '6.0.3' } }, 'node_modules/typescript': { version: '5.8.3' } } });
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_PIN_MISMATCH/);
});
test('rejects a compiler API that disagrees with installed package metadata', t => {
  const f = fixture(t); f.install('6.0.3');
  f.write('node_modules/typescript/lib/typescript.js', 'module.exports = {version: "5.8.3"};');
  assert.throws(() => loadCompiler(f.root, {}), /JEV_TYPESCRIPT_API_MISMATCH/);
});
test('explicit TSC overrides are refused, not silently ignored', t => {
  const f = fixture(t); f.install('6.0.3');
  assert.throws(() => loadCompiler(f.root, { TSC: 'tsc' }), /JEV_TYPESCRIPT_OVERRIDE_UNSUPPORTED/);
});
test('real build entrypoint refuses an override before changing any retained output', () => {
  const root = path.resolve(__dirname, '..');
  const files = ['dist/app.js', 'dist/template.html', 'jev-studio.html', 'evidence/build.json'];
  const before = files.map(file => fs.readFileSync(path.join(root, file)));
  const result = cp.spawnSync(process.execPath, [path.join(root, 'scripts/build.cjs')], {
    env: { ...process.env, TSC: 'unsupported-global-tsc' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /JEV_TYPESCRIPT_OVERRIDE_UNSUPPORTED/);
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[index]));
});
test('namespace compilation uses supported options and an explicit ordered source inventory', () => {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
  assert.equal(config.compilerOptions.module, 'ESNext');
  assert.equal(config.compilerOptions.moduleResolution, 'Bundler');
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.compilerOptions.noEmitOnError, true);
  assert.deepEqual(config.compilerOptions.types, []);
  assert.equal(config.compilerOptions.outFile, undefined);
  assert.equal(config.compilerOptions.ignoreDeprecations, undefined);
  const walk = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.ts') ? [path.relative(root, file).split(path.sep).join('/')] : [];
  });
  assert.equal(new Set(config.files).size, config.files.length);
  assert.deepEqual([...config.files].sort(), walk(path.join(root, 'src')).sort());
});
