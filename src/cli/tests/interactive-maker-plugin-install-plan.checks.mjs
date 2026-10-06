import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { planOperation, applyOperation } from '../adapters/framework/planning.ts';

const frameworkRoot = resolve(import.meta.dirname, '../../..');
const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code ?? error.message; } };
/** A configured blank project with a prepared isolated test vault and a matching build. */
async function withProject(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'plugin-install-plan-')));
  try {
    const context = { root, frameworkRoot };
    const setup = await planOperation({ command: 'setup', args: [], options: { id: 'install-test', name: 'Install Test', author: 'Test', blank: true } }, context);
    await applyOperation(setup, context, setup.planHash);
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'dist/main.js'), 'module.exports = {};');
    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'install-test', version: '0.1.0' }));
    await check(context, root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const install = context => planOperation({ command: 'plugin install', args: [], options: {} }, context);
const prepareVault = async context => { const vault = await planOperation({ command: 'vault prepare', args: [], options: {} }, context); await applyOperation(vault, context, vault.planHash); };

test('plugin install plans copy only verified build assets into the prepared isolated vault', () => withProject(async (context, root) => {
  assert.equal(await code(install(context)), 'ENOENT');
  await prepareVault(context);
  const planned = await install(context);
  const paths = planned.plan.changes.map(change => change.path);
  assert.deepEqual(paths, ['.test-vault/.obsidian/plugins/install-test/main.js', '.test-vault/.obsidian/plugins/install-test/manifest.json']);
  assert.equal(planned.summary.activation, 'manual'); assert.equal(planned.summary.dataJson, 'preserved');
  await writeFile(join(root, 'dist/styles.css'), '.x{}');
  assert.ok((await install(context)).plan.changes.some(change => change.path.endsWith('/styles.css')));
  await applyOperation(await install(context), context, (await install(context)).planHash);
  await rm(join(root, 'dist/styles.css'));
  assert.equal(await code(install(context)), 'STALE_STYLE');
}));

test('plugin install refuses mismatched versions, identities, empty assets and foreign installations', () => withProject(async (context, root) => {
  await prepareVault(context);
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'install-test', version: '9.9.9' }));
  assert.equal(await code(install(context)), 'PLUGIN_VERSION');
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'other-plugin', version: '0.1.0' }));
  assert.equal(await code(install(context)), 'PLUGIN_IDENTITY');
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'install-test', version: '0.1.0' }));
  await writeFile(join(root, 'dist/main.js'), '');
  assert.equal(await code(install(context)), 'EMPTY_ASSET');
  await writeFile(join(root, 'dist/main.js'), 'module.exports = {};');
  await mkdir(join(root, '.test-vault/.obsidian/plugins/install-test'), { recursive: true });
  await writeFile(join(root, '.test-vault/.obsidian/plugins/install-test/manifest.json'), JSON.stringify({ id: 'someone-else' }));
  assert.equal(await code(install(context)), 'INSTALLED_IDENTITY');
  const vaultFile = join(root, '.test-vault/.framework-vault.json');
  await writeFile(vaultFile, JSON.stringify({ ...JSON.parse(await readFile(vaultFile, 'utf8')), projectId: 'someone-else' }));
  assert.equal(await code(install(context)), 'VAULT_REQUIRED');
}));

test('plugin install, maker planning and unknown commands fail before any write', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'plugin-install-empty-')));
  try {
    const context = { root, frameworkRoot };
    assert.equal(await code(install(context)), 'CONFIG_REQUIRED');
    assert.equal(await code(planOperation({ command: 'make', args: ['feature'], options: {} }, context)), 'MAKER_INPUT_REQUIRED');
    // An unregistered name is unknown before any trust decision; only a registered custom recipe asks for trust.
    assert.equal(await code(planOperation({ command: 'make', args: ['./custom.mjs', 'thing'], options: {} }, context)), 'MAKER_UNKNOWN');
    await mkdir(join(root, 'scripts/makers/custom'), { recursive: true });
    await writeFile(join(root, 'scripts/makers/custom/registry.mjs'), "import { thingMaker } from './thing.mjs';\nexport const customMakers = [thingMaker];\n");
    assert.equal(await code(planOperation({ command: 'make', args: ['thing', 'item'], options: {} }, context)), 'CUSTOM_TRUST_REQUIRED');
    assert.equal(await code(planOperation({ command: 'status', args: [], options: {} }, context)), 'Operation has no file plan.');
  } finally { await rm(root, { recursive: true, force: true }); }
});
