const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { loadCompiler, compileApplication } = require('../scripts/compiler.cjs');
const concept = path.resolve(__dirname, '..');
const compiler = loadCompiler(path.resolve(concept, '../../..'));

function project(t, files) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'jev-ts6-program-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  const config = JSON.parse(fs.readFileSync(path.join(concept, 'tsconfig.json'), 'utf8'));
  config.files = Object.keys(files).map(name => 'src/' + name);
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify(config));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, 'src', name), text);
  return root;
}
test('actual TypeScript 6 checks and assembles ordered cross-file namespace references without file writes', t => {
  assert.match(compiler.version, /^6\.\d+\.\d+$/);
  const root = project(t, {
    'first.ts': 'namespace Probe { export const base: number = 41; }',
    'second.ts': 'namespace Probe { export const answer: number = base + 1; }',
  });
  const first = compileApplication(compiler, root);
  const second = compileApplication(compiler, root);
  assert.deepEqual(first, second);
  const context = vm.createContext({}); vm.runInContext(first.code, context);
  assert.equal(context.Probe.answer, 42);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
test('actual TypeScript 6 rejects incorrect types without creating output', t => {
  const root = project(t, { 'invalid.ts': 'namespace Probe { export const count: number = "wrong"; }' });
  assert.throws(() => compileApplication(compiler, root), /JEV_TYPESCRIPT_CHECK_FAILED/);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
test('external modules cannot silently cross the script-assembly boundary', t => {
  const root = project(t, { 'external.ts': 'export const answer = 42;' });
  assert.throws(() => compileApplication(compiler, root), /JEV_EXTERNAL_MODULE_UNSUPPORTED/);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
