import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, readdir, realpath, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { zip } from '../../scripts/framework/zip.ts';
import { hash } from '../../scripts/framework/files.ts';
import { kitManifest, verifyKit } from '../../scripts/framework/kit-integrity.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
function cli(dir, args) {
  return spawnSync(process.execPath, [join(dir, 'app.mjs'), ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 5_000_000 });
}
test('compiled kit bootstraps, imports and generates without dependencies or Git', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler()), archive = zip(files);
  assert.deepEqual(archive, zip([...files].reverse()), 'ZIP ordering must be deterministic');
  const extracted = await extractArchive(archive, dir);
  assert.equal(extracted.length, files.length);
  for (const file of files) assert.deepEqual(await readFile(join(dir, file.path)), file.bytes);
  assert.ok(!extracted.some(path => /docs\/concepts\/companion\/(?:src|vendor)\//.test(path)));
  assert.ok(!extracted.some(path => path.endsWith('docs/concepts/companion/index.html')));
  assert.ok(!(await readdir(dir)).includes('node_modules')); assert.ok(!(await readdir(dir)).includes('.git'));
  assert.ok((await verifyKit(dir)).files.length > 100);
  let output = cli(dir, ['capabilities', '--json']); assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).status, 'ok'); assert.ok(!output.stderr.includes('ExperimentalWarning'), output.stderr);
  assert.deepEqual(files.filter(file => file.path.startsWith('.framework/compiled/') && file.path.endsWith('.js')).map(file => file.path), ['.framework/compiled/app.js']);
  assert.ok((await readFile(join(dir, '.framework/compiled/app.js'), 'utf8')).length > 1000);
  for (const name of ['configs/types/tsconfig.sitemap.json', 'configs/types/tsconfig.authoring.json']) {
    assert.deepEqual(await readFile(join(dir, '.framework/template', name)), await readFile(join(root, name)), name + ' must ship before generation');
  }
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
  assert.match(await readFile(join(dir, 'vitest.project.config.mjs'), 'utf8'), /spec\/project/);
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
  const compiled = join(dir, '.framework/compiled/app.js'); await writeFile(compiled, (await readFile(compiled, 'utf8')) + '\n// drift\n');
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
  const base = { schemaVersion: 1, version: '0.4.0', compilerVersion: '6.0.3', sourceHash: 'a'.repeat(64), files: [{ path: '.framework/template/LICENSE', hash: 'a'.repeat(64), bytes: 1 }], bootstrap: ['shell.mjs', 'package.json', 'README.md', 'LICENSE'].map(path => ({path, hash: 'b'.repeat(64)})) };
  assert.equal(kitManifest(base).version, '0.4.0');
  // Current kits add app.mjs and bin/app; the pre-rename shell.mjs-only set stays valid for existing projects.
  const bootstrap = paths => paths.map(path => ({ path, hash: 'b'.repeat(64) }));
  assert.equal(kitManifest({ ...base, bootstrap: bootstrap(['app.mjs', 'bin/app', 'shell.mjs', 'package.json', 'README.md', 'LICENSE']) }).bootstrap.length, 6);
  for (const paths of [['app.mjs', 'package.json', 'README.md', 'LICENSE'], ['app.mjs', 'bin/app', 'package.json', 'README.md', 'LICENSE'], ['app.mjs', 'app.mjs', 'shell.mjs', 'package.json', 'README.md', 'LICENSE'], ['app.mjs', 'bin/app', 'shell.mjs', 'package.json', 'README.md', 'LICENSE', 'bin/other']]) {
    assert.throws(() => kitManifest({ ...base, bootstrap: bootstrap(paths) }), /bootstrap/i, paths.join(','));
  }
  assert.throws(() => kitManifest({ ...base, files: [{ ...base.files[0], path: '.framework/template/../../outside' }] }));
  assert.throws(() => kitManifest({ ...base, files: [...base.files, { ...base.files[0], path: '.framework/template/license' }] }));
});
test('archive rejects traversal and duplicate entries', () => {
  assert.throws(() => zip([{ path: '../outside', bytes: Buffer.from('x') }]));
  assert.throws(() => zip([{ path: 'x', bytes: Buffer.from('x') }, { path: 'x', bytes: Buffer.from('x') }]));
});


test('kit verification reopens bytes on every call and rejects source links and size drift', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kit-read-contract-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [];
  for (let i=0; i<18; i++) {
    const path = `.framework/${i<9?'template':'compiled'}/source-${i}.txt`, bytes = Buffer.from(`source-${i}`);
    await mkdir(join(root, '.framework', i<9?'template':'compiled'), { recursive: true });
    await writeFile(join(root, path), bytes); files.push({ path, bytes: bytes.length, hash: hash(bytes) });
  }
  const bootstrap = [];
  for (const path of ['shell.mjs', 'package.json', 'README.md', 'LICENSE']) {
    await writeFile(join(root, path), path); bootstrap.push({ path, hash: hash(path) });
  }
  const kit = { schemaVersion:1, version:'0.4.0', compilerVersion:'fixture', sourceHash:'a'.repeat(64), files, bootstrap };
  await writeFile(join(root, '.framework/kit.json'), JSON.stringify(kit));
  assert.deepEqual(await verifyKit(root), kit);
  const target = join(root, files[0].path);
  await writeFile(target, 'source-X'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await writeFile(target, 'source-0'); assert.deepEqual(await verifyKit(root), kit);
  await writeFile(target, 'short'); await assert.rejects(verifyKit(root), /fingerprint mismatch/);
  await rm(target); await symlink(join(root, files[1].path), target, 'file');
  await assert.rejects(verifyKit(root), /links/);
});
