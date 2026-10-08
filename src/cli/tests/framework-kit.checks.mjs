import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir, realpath, mkdir, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { upgradePlan } from '../adapters/framework/kit.ts';
import { extractArchive, extractKit, kitFiles } from './support/framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './support/example-sources-fixture.mjs';
import { zip } from '../adapters/framework/zip.ts';
import { hash } from '../adapters/framework/files.ts';
import { applyFilePlan } from '#shared/platform/file-plan.ts';
import { kitManifest, verifyKit } from '../adapters/framework/kit-integrity.ts';
import { selfProject } from '#shared/testing/starter-documents.mjs';
import { executeOperation } from '../adapters/framework/operations.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
function cli(dir, args) {
  return spawnSync(process.execPath, [join(dir, 'bin/app'), ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 5_000_000 });
}
test('compiled kit bootstraps, imports and generates without dependencies or Git', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await kitFiles(root), archive = zip(files);
  assert.deepEqual(archive, zip([...files].reverse()), 'ZIP ordering must be deterministic');
  const extracted = await extractArchive(archive, dir);
  assert.equal(extracted.length, files.length);
  for (const file of files) assert.deepEqual(await readFile(join(dir, file.path)), file.bytes);
  assert.ok(!extracted.some(path => /docs\/concepts\/companion\/(?:src|starters|seeds)\/|(?:^|\/)configs\/starters\//.test(path)));
  // Only the exact reviewed compiler runtime libraries and their notices ship; prototype runtimes stay maintainer-only.
  const vendor = ['d3-NOTICE.txt', 'packages.json', 'vue-flow-core-LICENSE.txt', 'vue-flow-core.iife.js', 'vue-flow.scoped.css', 'vueuse-NOTICE.txt'];
  assert.deepEqual(extracted.filter(path => /docs\/concepts\/companion\/vendor\//.test(path)).sort(), vendor.map(name => 'bin/template/docs/concepts/companion/vendor/' + name));
  assert.ok(!extracted.some(path => path.endsWith('docs/concepts/companion/index.html')));
  assert.ok(!(await readdir(dir)).includes('node_modules')); assert.ok(!(await readdir(dir)).includes('.git'));
  assert.ok((await verifyKit(dir)).files.length > 100);
  const pluginConfigPath = join(dir, 'bin/plugins/example-extension/config.json');
  const pluginConfig = await readFile(pluginConfigPath, 'utf8');
  // Plugin code is bundled into app.js; its config.json stays editable data beside the bundle.
  assert.ok(files.some(file => file.path === 'bin/app.js'));
  assert.ok(!files.some(file => file.path === 'bin/plugins/runtime.js'));
  await writeFile(pluginConfigPath, JSON.stringify({ ...JSON.parse(pluginConfig), enabled: true }, null, 2) + '\n');
  // Enabling a plugin is a data edit: the runtime config is schema-checked, not fingerprinted.
  assert.ok((await verifyKit(dir)).files.every(file => !file.path.startsWith('bin/plugins/')));
  let output = cli(dir, ['framework', 'status', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout); assert.equal(JSON.parse(output.stdout).status, 'ok');
  output = cli(dir, ['example', 'send', '--message', 'Compiled extension', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  let pluginResult = JSON.parse(output.stdout);
  assert.equal(pluginResult.command, 'example');
  assert.deepEqual(pluginResult.data, { plugin: 'example-extension', message: 'Compiled extension' });
  assert.match(output.stderr, /Compiled extension/);
  assert.match(await readFile(join(dir, 'bin/plugins/DEVELOPER-GUIDE.md'), 'utf8'), /^# App plugin developer guide/, 'the guide ships beside the plugins');
  // A user's app plugin in bin/plugins is user data beside the bundle: the kit stays valid and the compiled CLI loads it.
  const appPlugin = join(dir, 'bin/plugins/hello-world');
  await mkdir(appPlugin, { recursive: true });
  await writeFile(join(appPlugin, 'manifest.json'), JSON.stringify({ id: 'hello-world', name: 'Hello', version: '1.0.0', minAppVersion: '0.0.1', apiVersion: 1, description: 'Greets.', author: 'Tester', category: 'tool', tags: [] }));
  await writeFile(join(appPlugin, 'settings.json'), '{"greeting":"Hi"}');
  await writeFile(join(appPlugin, 'main.js'), "const { Plugin } = require('workbench');\nmodule.exports = class extends Plugin {\n  async onload() { const { greeting } = await this.loadData(); this.addCommand({ id: 'greet', name: 'Greet', execute: () => ({ greeting }) }); }\n};\n");
  assert.ok((await verifyKit(dir)).files.every(file => !file.path.startsWith('bin/plugins/')), 'installed app plugins are not kit inventory');
  output = cli(dir, ['plugins', 'enable', 'hello-world', '--yes', '--json']);
  assert.equal(JSON.parse(output.stdout).status, 'applied', output.stderr + output.stdout);
  output = cli(dir, ['hello-world', 'greet', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  assert.deepEqual(JSON.parse(output.stdout).data, { greeting: 'Hi' });
  await rm(appPlugin, { recursive: true }); await rm(join(dir, 'bin/plugins/community-plugins.json'));
  output = cli(dir, ['help', 'example', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  pluginResult = JSON.parse(output.stdout);
  assert.equal(pluginResult.command, 'example');
  assert.equal(pluginResult.data.command, 'example');
  assert.match(pluginResult.data.help, /Dispatch the example plugin event/);
  output = cli(dir, ['new', 'guide', '--starter', 'webapp-react', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  pluginResult = JSON.parse(output.stdout);
  assert.equal(pluginResult.data.selection.framework, 'react');
  assert.deepEqual(pluginResult.data.selection.targets, ['webapp']);
  await writeFile(pluginConfigPath, '[]');
  await assert.rejects(verifyKit(dir), { code: 'KIT_PLUGIN_CONFIG' });
  await writeFile(pluginConfigPath, '{"enabled":"yes"}');
  await assert.rejects(verifyKit(dir), { code: 'KIT_PLUGIN_CONFIG' });
  await writeFile(pluginConfigPath, pluginConfig);
  assert.ok((await verifyKit(dir)).files.length > 100, 'restored plugin config keeps the extracted kit valid');
  output = cli(dir, ['capabilities', '--json']); assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).status, 'ok'); assert.ok(!output.stderr.includes('ExperimentalWarning'), output.stderr);
  assert.deepEqual(files.filter(file => file.path.startsWith('bin/') && !file.path.startsWith('bin/template/') && file.path.endsWith('.js')).map(file => file.path), ['bin/app.js', 'bin/tools/typescript.js']);
  const templateOwnership = files.find(file => file.path === 'bin/template/tooling/examples/ownership.json');
  const manifestRecord = JSON.parse(files.find(file => file.path === 'bin/kit.json').bytes)
    .files.find(file => file.path === templateOwnership.path);
  assert.equal(manifestRecord.hash, hash(templateOwnership.bytes), 'adapted template ownership must match kit integrity metadata');
  assert.ok(!files.some(file => file.path === 'bin/tooling/examples/ownership.json'), 'no stale per-file runtime metadata');
  assert.ok(!files.some(file => file.path.startsWith('bin/node_modules/')), 'vendor runtime is bundled, not copied');
  assert.ok((await readFile(join(dir, 'bin/app.js'), 'utf8')).length > 1000);
  for (const name of ['configs/types/tsconfig.sitemap.json', 'configs/types/tsconfig.authoring.json', 'configs/templates/atoms/button.json']) {
    assert.deepEqual(await readFile(join(dir, 'bin/template', name)), await readFile(join(root, name)), name + ' must ship before generation');
  }
  output = cli(dir, ['templates', 'list', '--atomic-level', 'atom', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  const templateCatalog = JSON.parse(output.stdout);
  assert.ok(templateCatalog.data.templates.some(item => item.id === 'atom.button'));
  const design = selfProject();
  design.project = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '0.1.0', description: '' };
  design.settings = { codebaseFolder: 'app/source', testsFolder: 'spec' };
  await writeFile(join(dir, 'input.json'), JSON.stringify(design));
  output = cli(dir, ['setup', '--input', 'input.json', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  output = cli(dir, ['generate', '--json', '--plan-out', 'generation.plan.json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  const plan = JSON.parse(output.stdout); assert.equal(plan.status, 'planned'); assert.deepEqual(plan.data.conflicts, []);
  assert.ok(!(await readdir(dir)).includes('src'), 'preview cannot write source');
  output = cli(dir, ['plan', 'apply', 'generation.plan.json', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  assert.equal(JSON.parse(output.stdout).status, 'applied');
  assert.match(await readFile(join(dir, 'app/source/generated/presentation/stores/authoring-vault.ts'), 'utf8'), /defineStore/);
  assert.match(await readFile(join(dir, 'configs/testing/vitest.project.config.mjs'), 'utf8'), /spec\/project/);
  assert.equal(JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')).id, 'field-notes');
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout); assert.equal(JSON.parse(output.stdout).status, 'unchanged');
  await writeFile(join(dir, 'draft.json'), JSON.stringify({ ...design, design: { ...design.design, goal: 'Unreviewed draft' } }));
  output = cli(dir, ['generate', '--input', 'draft.json', '--yes', '--json']); assert.notEqual(output.status, 0); assert.match(output.stdout + output.stderr, /INPUT_REQUIRES_IMPORT/);
  assert.notEqual(JSON.parse(await readFile(join(dir, 'design/project.json'), 'utf8')).design.goal, 'Unreviewed draft');
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout); assert.equal(JSON.parse(output.stdout).status, 'unchanged');
  design.design.goal = 'Revised intent with unchanged implementation contracts';
  await writeFile(join(dir, 'input.json'), JSON.stringify(design));
  output = cli(dir, ['project', 'import', '--input', 'input.json', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  assert.equal(JSON.parse(await readFile(join(dir, 'design/project.json'), 'utf8')).design.goal, design.design.goal);
  const source = join(dir, 'app/source/generated/infrastructure/sources/authoring-vault.ts'); await writeFile(source, (await readFile(source, 'utf8')) + '\n// developer edit\n');
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout); assert.match(await readFile(source, 'utf8'), /developer edit/);
  output = cli(dir, ['status', '--json']); assert.equal(output.status, 0, output.stderr); assert.ok(JSON.parse(output.stdout).diagnostics.some(item => item.code === 'ACCEPTANCE_PENDING'));
  // The extracted CLI must bind inherited framework source even with app/source + spec.
  output = cli(dir, ['setup', 'status', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  const approval = JSON.parse(output.stdout).data;
  const inherited = join(dir, 'src/plugin/main.ts');
  await writeFile(inherited, (await readFile(inherited, 'utf8')) + '\n// independent inherited-source edit\n');
  output = cli(dir, ['setup', 'resume', '--stage', 'verify', '--resume-hash', approval.resumeHash, '--yes', '--json']);
  assert.equal(output.status, 1, output.stderr + output.stdout);
  assert.equal(JSON.parse(output.stdout).diagnostics[0].code, 'SETUP_INPUT_CHANGED');
  assert.ok(!(await readdir(join(dir, '.framework'))).includes('setup-progress.json'), 'stale approval cannot write stage intent');
  assert.ok(!(await readdir(dir)).includes('node_modules'), 'stale approval cannot launch dependency tooling');
  const compiled = join(dir, 'bin/app.js'); await writeFile(compiled, (await readFile(compiled, 'utf8')) + '\n// drift\n');
  await assert.rejects(verifyKit(dir), /fingerprint mismatch/);
});
test('compiled kit preserves Storybook overrides and intake ownership across replay', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-kit-storybook-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await kitFiles(root);
  await extractArchive(zip(files), dir); await verifyKit(dir);
  const design = selfProject();
  design.project = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '0.1.0', description: '' };
  design.settings = { codebaseFolder: 'app/source', testsFolder: 'spec' };
  await writeFile(join(dir, 'input.json'), JSON.stringify(design));
  let output = cli(dir, ['setup', '--input', 'input.json', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
  const rootLock = await readFile(join(dir, 'package-lock.json'), 'utf8');
  for (const [enabled, stories] of [['off', 'on'], ['on', 'on'], ['off', 'off']]) {
    output = cli(dir, ['generate', '--storybook', enabled, '--storybook-stories', stories, '--yes', '--json']);
    assert.equal(output.status, 0, output.stderr + output.stdout);
    const generated = JSON.parse(await readFile(join(dir, 'design/project.json'), 'utf8'));
    assert.deepEqual(generated.tooling.storybook, { enabled: enabled === 'on', generateStories: stories === 'on' });
    // A reviewed override must update intake and generation ownership together; replay must not reject its own output.
    output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stderr + output.stdout);
    assert.equal(JSON.parse(output.stdout).status, 'unchanged', JSON.stringify(JSON.parse(output.stdout).data.applied));
  }
  assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), rootLock);
  output = cli(dir, ['storybook', 'install', '--yes', '--json']); assert.notEqual(output.status, 0);
  assert.match(output.stdout, /STORYBOOK_DISABLED/);
  output = cli(dir, ['project', 'import', '--input', 'input.json', '--yes', '--json']); assert.equal(output.status, 0, output.stdout);
  output = cli(dir, ['generate', '--yes', '--json']); assert.equal(output.status, 0, output.stdout);
});
test('kit manifest rejects traversal and duplicate case aliases', () => {
  const bootstrap = ['bin/app', 'bin/package.json', 'bin/README.md', 'bin/LICENSE', 'package.json', 'README.md', 'LICENSE'].map(path => ({ path, hash: 'b'.repeat(64) }));
  const base = { schemaVersion: 3, version: '0.4.0', compilerVersion: '6.0.3', sourceHash: 'a'.repeat(64),
    files: [{ path: 'bin/template/LICENSE', hash: 'a'.repeat(64), bytes: 1 }], bootstrap };
  assert.equal(kitManifest(base).version, '0.4.0');
  for (const paths of [
    ['package.json', 'README.md', 'LICENSE'],
    ['bin/app', 'bin/app', 'package.json', 'README.md', 'LICENSE'],
    ['bin/app', 'package.json', 'README.md', 'LICENSE', 'bin/other'],
  ]) assert.throws(() => kitManifest({ ...base, bootstrap: paths.map(path => ({ path, hash: 'b'.repeat(64) })) }), /bootstrap/i, paths.join(','));
  assert.throws(() => kitManifest({ ...base, schemaVersion: 1 }), { code: 'KIT_VERSION' });
  assert.throws(() => kitManifest({ ...base, files: [{ ...base.files[0], path: 'bin/template/../../outside' }] }));
  assert.throws(() => kitManifest({ ...base, files: [...base.files, { ...base.files[0], path: 'bin/template/license' }] }));
  assert.throws(() => kitManifest({ ...base, files: [{ ...base.files[0], path: '.framework/template/LICENSE' }] }));
  // Runtime plugin configs are editable data, so the fingerprinted inventory can never claim them.
  assert.throws(() => kitManifest({ ...base, files: [{ ...base.files[0], path: 'bin/plugins/demo/config.json' }] }), { code: 'KIT_PATH' });
});
test('archive rejects traversal and duplicate entries', () => {
  assert.throws(() => zip([{ path: '../outside', bytes: Buffer.from('x') }]));
  assert.throws(() => zip([{ path: 'x', bytes: Buffer.from('x') }, { path: 'x', bytes: Buffer.from('x') }]));
});


test('kit verification reopens bytes on every call and rejects source links and size drift', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kit-read-contract-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'bin/template'), { recursive: true });
  const files = [];
  for (let i=0; i<18; i++) {
    const path = `bin/template/source-${i}.txt`, bytes = Buffer.from(`source-${i}`);
    await writeFile(join(root, path), bytes); files.push({ path, bytes: bytes.length, hash: hash(bytes) });
  }
  await writeFile(join(root, 'bin/app.js'), 'bundle');
  files.push({ path: 'bin/app.js', bytes: 6, hash: hash('bundle') });
  const bootstrap = [];
  for (const path of ['bin/app', 'bin/package.json', 'bin/README.md', 'bin/LICENSE', 'package.json', 'README.md', 'LICENSE']) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), path); bootstrap.push({ path, hash: hash(path) });
  }
  const kit = { schemaVersion:3, version:'0.4.0', compilerVersion:'fixture', sourceHash:'a'.repeat(64), files, bootstrap };
  await writeFile(join(root, 'bin/kit.json'), JSON.stringify(kit));
  assert.deepEqual(await verifyKit(root), kit);
  const target = join(root, files[0].path);
  await writeFile(target, 'source-X'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await writeFile(target, 'source-0'); assert.deepEqual(await verifyKit(root), kit);
  await writeFile(target, 'short'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await rm(target); await symlink(join(root, files[1].path), target, 'file');
  await assert.rejects(verifyKit(root), /links/);
});
const kitBootstrap = { 'bin/app': 'launcher', 'bin/package.json': '{}', 'bin/README.md': 'README', 'bin/LICENSE': 'license', 'package.json': '{}', 'README.md': 'README', LICENSE: 'license' };
/** A minimal verified bin-owned kit; `configs` are runtime plugin configs whose shipped default is the template copy. */
async function kitFixture(root, version, files, configs = {}) {
  const entries = [];
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    entries.push({ path, hash: hash(content), bytes: Buffer.byteLength(content) });
  }
  for (const [id, content] of Object.entries(configs)) {
    for (const path of [`bin/template/src/cli/sdk/${id}/config.json`, `bin/plugins/${id}/config.json`]) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    }
    entries.push({ path: `bin/template/src/cli/sdk/${id}/config.json`, hash: hash(content), bytes: Buffer.byteLength(content) });
  }
  const initial = [];
  for (const [path, content] of Object.entries(kitBootstrap)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    initial.push({ path, hash: hash(content) });
  }
  const manifest = { schemaVersion: 3, version, compilerVersion: 'fixture', sourceHash: hash(version), files: entries, bootstrap: initial };
  await writeFile(join(root, 'bin/kit.json'), JSON.stringify(manifest));
  assert.deepEqual(await verifyKit(root), manifest);
  return manifest;
}
async function kitRoots(t, count) {
  const roots = await Promise.all(Array.from({ length: count }, async () => realpath(await mkdtemp(join(tmpdir(), 'kit-upgrade-')))));
  t.after(async () => { await Promise.all(roots.map(path => rm(path, { recursive: true, force: true }))); });
  return roots;
}
test('upgrading a verified bin-owned kit replaces runtime files and removes only verified kit inventory', async t => {
  const [old, next] = await kitRoots(t, 2);
  const currentFiles = {
    'bin/template/LICENSE': 'template',
    'bin/template/obsolete.md': 'obsolete template',
    'bin/app.js': 'old bundled app',
    'bin/licenses/yaml.LICENSE': 'yaml license',
  };
  const nextFiles = {
    'bin/template/LICENSE': 'template',
    'bin/app.js': 'new bundled app',
    'bin/licenses/yaml.LICENSE': 'yaml license',
  };
  await kitFixture(old, '0.4.0', currentFiles);
  const final = await kitFixture(next, '0.4.1', nextFiles);
  const { plan } = await upgradePlan({ root: old, frameworkRoot: old }, next);
  assert.deepEqual(plan.changes.filter(change => change.status === 'delete').map(change => change.path), ['bin/template/obsolete.md']);
  await writeFile(join(old, 'bin/template/obsolete.md'), 'concurrent edit');
  await assert.rejects(applyFilePlan(plan), /PLAN_STALE/);
  assert.equal(await readFile(join(old, 'bin/app.js'), 'utf8'), 'old bundled app');
  await writeFile(join(old, 'bin/template/obsolete.md'), currentFiles['bin/template/obsolete.md']);
  await applyFilePlan(plan);
  assert.deepEqual(await verifyKit(old), final);
});
test('kit upgrade preserves an edited plugin config, follows unedited defaults and reports a changed-on-both-sides conflict', async t => {
  const [old, sameDefault, newDefault] = await kitRoots(t, 3);
  const files = { 'bin/app.js': 'app', 'bin/template/LICENSE': 'template' };
  const shipped = '{"enabled":false}\n', edited = '{"enabled":true}\n', revised = '{"enabled":false,"defaultMessage":"v2"}\n';
  await kitFixture(old, '0.4.0', files, { demo: shipped, retired: shipped });
  await kitFixture(sameDefault, '0.4.1', { ...files, 'bin/app.js': 'app 2' }, { demo: shipped, added: shipped });
  await kitFixture(newDefault, '0.4.2', { ...files, 'bin/app.js': 'app 3' }, { demo: revised });
  // Unedited: the config follows the new kit (retired configs are removed, new ones created).
  let upgrade = await upgradePlan({ root: old, frameworkRoot: old }, newDefault);
  assert.deepEqual(upgrade.conflicts, []);
  const status = path => upgrade.plan.changes.find(change => change.path === path)?.status;
  assert.equal(status('bin/plugins/demo/config.json'), 'update'); assert.equal(status('bin/plugins/retired/config.json'), 'delete');
  // Enabling a plugin is user data: kept when the shipped default is unchanged.
  await writeFile(join(old, 'bin/plugins/demo/config.json'), edited);
  await verifyKit(old);
  upgrade = await upgradePlan({ root: old, frameworkRoot: old }, sameDefault);
  assert.deepEqual(upgrade.conflicts, []); assert.deepEqual(upgrade.summary.preservedPluginConfigs, ['bin/plugins/demo/config.json']);
  assert.equal(status('bin/plugins/demo/config.json'), undefined); assert.equal(status('bin/plugins/added/config.json'), 'create');
  await applyFilePlan(upgrade.plan);
  assert.equal(await readFile(join(old, 'bin/plugins/demo/config.json'), 'utf8'), edited);
  await verifyKit(old);
  // Edited locally and changed upstream: a conflict, never an overwrite.
  upgrade = await upgradePlan({ root: old, frameworkRoot: old }, newDefault);
  assert.deepEqual(upgrade.conflicts, ['bin/plugins/demo/config.json']);
  assert.equal(status('bin/plugins/demo/config.json'), undefined);
  // An edited config whose plugin the new kit retires is a conflict, not a deletion.
  await writeFile(join(old, 'bin/plugins/added/config.json'), edited);
  assert.ok((await upgradePlan({ root: old, frameworkRoot: old }, newDefault)).conflicts.includes('bin/plugins/added/config.json'));
});
test('installed app plugins and the plugin guide are user data: verified around and upgraded only when unedited', async t => {
  const [old, next] = await kitRoots(t, 2);
  const shippedGuide = 'bin/template/src/cli/plugins/DEVELOPER-GUIDE.md', guide = 'bin/plugins/DEVELOPER-GUIDE.md';
  await kitFixture(old, '0.4.0', { 'bin/app.js': 'app', [shippedGuide]: 'guide v1' });
  await kitFixture(next, '0.4.1', { 'bin/app.js': 'app 2', [shippedGuide]: 'guide v2' });
  await mkdir(join(old, 'bin/plugins/team-tool'), { recursive: true });
  for (const name of ['manifest.json', 'main.js', 'settings.json']) await writeFile(join(old, 'bin/plugins/team-tool', name), '{}');
  await writeFile(join(old, 'bin/plugins/community-plugins.json'), '["team-tool"]');
  await writeFile(join(old, guide), 'guide v1');
  await verifyKit(old);
  let upgrade = await upgradePlan({ root: old, frameworkRoot: old }, next);
  assert.equal(upgrade.plan.changes.find(change => change.path === guide)?.status, 'update');
  assert.equal(upgrade.summary.pluginGuide, 'updated');
  assert.ok(!upgrade.plan.changes.some(change => /^bin\/plugins\/(?:team-tool\/|community-plugins)/.test(change.path)), 'installed plugins are never touched');
  await writeFile(join(old, guide), 'guide v1 with team notes');
  upgrade = await upgradePlan({ root: old, frameworkRoot: old }, next);
  assert.equal(upgrade.plan.changes.find(change => change.path === guide), undefined, 'an edited guide is kept');
});
test('kit verification fails with an explicit code for missing configs, stray configs and a missing kit', async t => {
  const [root, legacy] = await kitRoots(t, 2);
  await kitFixture(root, '0.4.0', { 'bin/app.js': 'app' }, { demo: '{}' });
  await rm(join(root, 'bin/plugins/demo/config.json'));
  await assert.rejects(verifyKit(root), { code: 'KIT_PLUGIN_CONFIG' });
  await writeFile(join(root, 'bin/plugins/demo/config.json'), '{}');
  await mkdir(join(root, 'bin/plugins/stray'), { recursive: true });
  await writeFile(join(root, 'bin/plugins/stray/config.json'), '{}');
  await assert.rejects(verifyKit(root), { code: 'KIT_INVENTORY' });
  await mkdir(join(legacy, '.framework'), { recursive: true });
  await writeFile(join(legacy, '.framework/kit.json'), JSON.stringify({ schemaVersion: 1 }));
  // The retired layout is not probed or migrated; it is simply not a kit, reported explicitly rather than as a raw ENOENT.
  await assert.rejects(verifyKit(legacy), { code: 'KIT_REQUIRED' });
  await assert.rejects(upgradePlan({ root: legacy, frameworkRoot: legacy }, root), { code: 'KIT_REQUIRED' });
  const status = await executeOperation({ command: 'framework status', args: [], options: {} }, { root: legacy, frameworkRoot: legacy });
  assert.equal(status.diagnostics[0].code, 'KIT_REQUIRED', 'a clear diagnostic, not a raw ENOENT');
});

test('a bootstrap failure reports the canonical envelope from the one module its layout ships', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-bootstrap-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const expected = message => ({ protocolVersion: 1, command: 'bootstrap', status: 'failed', data: null, diagnostics: [{ code: 'BOOTSTRAP_FAILED', message }] });
  const kit = join(dir, 'kit'); await extractKit(root, kit);
  await writeFile(join(kit, 'bin/app.js'), "throw new Error('kit bundle probe');\n");
  const packaged = cli(kit, ['capabilities', '--json']);
  assert.equal(packaged.status, 1); assert.deepEqual(JSON.parse(packaged.stdout), expected('kit bundle probe'));
  const checkout = join(dir, 'checkout'); await mkdir(join(checkout, 'bin'), { recursive: true }); await mkdir(join(checkout, 'src/cli'), { recursive: true });
  await writeFile(join(checkout, 'bin/app'), await readFile(join(root, 'bin/app')));
  await writeFile(join(checkout, 'src/cli/app.ts'), "throw new Error('checkout probe');\n");
  await writeFile(join(checkout, 'bin/package.json'), '{"type":"module"}');
  await writeFile(join(checkout, 'bin/app.js'), "throw new Error('compiled checkout probe');\n");
  const source = cli(checkout, ['capabilities', '--json']);
  assert.equal(source.status, 1); assert.deepEqual(JSON.parse(source.stdout), expected('compiled checkout probe'));
  const plain = cli(checkout, ['capabilities']);
  assert.equal(plain.status, 1); assert.equal(plain.stdout, ''); assert.equal(plain.stderr, 'compiled checkout probe\n');
});
