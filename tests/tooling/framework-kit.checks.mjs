import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir, realpath, mkdir, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleKit, installedCompiler, upgradePlan } from '../../bin/adapters/framework/kit.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { zip } from '../../bin/adapters/framework/zip.ts';
import { hash } from '../../bin/adapters/framework/files.ts';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { kitManifest, verifyKit } from '../../bin/adapters/framework/kit-integrity.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
function cli(dir, args) {
  return spawnSync(process.execPath, [join(dir, 'bin/app'), ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 5_000_000 });
}
test('compiled kit bootstraps, imports and generates without dependencies or Git', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler()), archive = zip(files);
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
  let output = cli(dir, ['example', 'send', '--message', 'Compiled extension', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  let pluginResult = JSON.parse(output.stdout);
  assert.equal(pluginResult.command, 'example');
  assert.deepEqual(pluginResult.data, { plugin: 'example-extension', message: 'Compiled extension' });
  assert.match(output.stderr, /Compiled extension/);
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
  await writeFile(pluginConfigPath, pluginConfig);
  assert.ok((await verifyKit(dir)).files.length > 100, 'restored plugin config keeps the extracted kit valid');
  output = cli(dir, ['capabilities', '--json']); assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).status, 'ok'); assert.ok(!output.stderr.includes('ExperimentalWarning'), output.stderr);
  assert.deepEqual(files.filter(file => file.path.startsWith('bin/') && !file.path.startsWith('bin/template/') && file.path.endsWith('.js')).map(file => file.path), ['bin/app.js']);
  const templateOwnership = files.find(file => file.path === 'bin/template/scripts/examples/ownership.json');
  const manifestRecord = JSON.parse(files.find(file => file.path === 'bin/kit.json').bytes)
    .files.find(file => file.path === templateOwnership.path);
  assert.equal(manifestRecord.hash, hash(templateOwnership.bytes), 'adapted template ownership must match kit integrity metadata');
  assert.ok(!files.some(file => file.path === 'bin/scripts/examples/ownership.json'), 'no stale per-file runtime metadata');
  assert.ok(!files.some(file => file.path.startsWith('bin/node_modules/')), 'vendor runtime is bundled, not copied');
  assert.ok((await readFile(join(dir, 'bin/app.js'), 'utf8')).length > 1000);
  for (const name of ['configs/types/tsconfig.sitemap.json', 'configs/types/tsconfig.authoring.json', 'configs/templates/atoms/button.json']) {
    assert.deepEqual(await readFile(join(dir, 'bin/template', name)), await readFile(join(root, name)), name + ' must ship before generation');
  }
  output = cli(dir, ['templates', 'list', '--atomic-level', 'atom', '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  const templateCatalog = JSON.parse(output.stdout);
  assert.ok(templateCatalog.data.templates.some(item => item.id === 'atom.button'));
  const design = JSON.parse(await readFile(join(root, 'docs/concepts/companion/companion-project.json'), 'utf8'));
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
  const inherited = join(dir, 'src/main.ts');
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
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler());
  await extractArchive(zip(files), dir); await verifyKit(dir);
  const design = JSON.parse(await readFile(join(root, 'docs/concepts/companion/companion-project.json'), 'utf8'));
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
  const bootstrap = ['bin/app', 'package.json', 'README.md', 'LICENSE'].map(path => ({ path, hash: 'b'.repeat(64) }));
  const base = { schemaVersion: 2, version: '0.4.0', compilerVersion: '6.0.3', sourceHash: 'a'.repeat(64),
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
  for (const path of ['bin/app', 'package.json', 'README.md', 'LICENSE']) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), path); bootstrap.push({ path, hash: hash(path) });
  }
  const kit = { schemaVersion:2, version:'0.4.0', compilerVersion:'fixture', sourceHash:'a'.repeat(64), files, bootstrap };
  await writeFile(join(root, 'bin/kit.json'), JSON.stringify(kit));
  assert.deepEqual(await verifyKit(root), kit);
  const target = join(root, files[0].path);
  await writeFile(target, 'source-X'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await writeFile(target, 'source-0'); assert.deepEqual(await verifyKit(root), kit);
  await writeFile(target, 'short'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await rm(target); await symlink(join(root, files[1].path), target, 'file');
  await assert.rejects(verifyKit(root), /links/);
});
test('upgrading a verified bin-owned kit replaces runtime files and removes only verified kit inventory', async t => {
  const old = await realpath(await mkdtemp(join(tmpdir(), 'kit-old-')));
  const next = await realpath(await mkdtemp(join(tmpdir(), 'kit-new-')));
  t.after(async () => { await Promise.all([old, next].map(path => rm(path, { recursive: true, force: true }))); });
  const bootstrap = { 'bin/app': 'launcher', 'package.json': '{}', 'README.md': 'README', LICENSE: 'license' };
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
  async function fixture(root, version, files) {
    const entries = [];
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
      entries.push({ path, hash: hash(content), bytes: Buffer.byteLength(content) });
    }
    const initial = [];
    for (const [path, content] of Object.entries(bootstrap)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
      initial.push({ path, hash: hash(content) });
    }
    const manifest = { schemaVersion: 2, version, compilerVersion: 'fixture', sourceHash: hash(version), files: entries, bootstrap: initial };
    await writeFile(join(root, 'bin/kit.json'), JSON.stringify(manifest));
    assert.deepEqual(await verifyKit(root), manifest);
    return manifest;
  }
  await fixture(old, '0.4.0', currentFiles);
  const final = await fixture(next, '0.4.1', nextFiles);
  const { plan } = await upgradePlan({ root: old, frameworkRoot: old }, next);
  assert.deepEqual(plan.changes.filter(change => change.status === 'delete').map(change => change.path), ['bin/template/obsolete.md']);
  await writeFile(join(old, 'bin/template/obsolete.md'), 'concurrent edit');
  await assert.rejects(applyFilePlan(plan), /PLAN_STALE/);
  assert.equal(await readFile(join(old, 'bin/app.js'), 'utf8'), 'old bundled app');
  await writeFile(join(old, 'bin/template/obsolete.md'), currentFiles['bin/template/obsolete.md']);
  await applyFilePlan(plan);
  assert.deepEqual(await verifyKit(old), final);
});
