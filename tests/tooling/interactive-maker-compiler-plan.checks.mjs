const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArtifacts, applyProject, reviewProject, generationReceipt } from '../../src/cli/compiler/adapters/workspace-plan.ts';
import { planProject } from '../../src/cli/compiler/adapters/project-plan.ts';
import { generationSelection } from '../../src/cli/compiler/adapters/selection.ts';
import { renderProjectFiles } from '../../src/cli/compiler/adapters/plugin-emitter.ts';
import { loadTemplateSnapshot } from '../../src/cli/compiler/adapters/template-snapshot.ts';
import { compileProject, analyzeProject } from '../../src/cli/compiler/index.ts';
import { projectModel, digest } from '../../src/cli/compiler/emitters/model.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';

// Drives workspace planning, project planning, scoped selection and the plugin emitter (src/cli/compiler) under the maker floors.
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
const root = fileURLToPath(new URL('../../', import.meta.url));
const blankText = starterDocumentText('blank');
const quickText = starterDocumentText('quick-capture');
const blank = projectModel(JSON.parse(blankText));
const template = await loadTemplateSnapshot(root);
const vault = async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'compiler-plan-')));
  after(t, () => rm(folder, { recursive: true, force: true }));
  return folder;
};
const input = (folder, text = blankText) => ({ content: Buffer.from(text), vault: folder, target: join(folder, 'out') });
const options = (extra = {}) => ({ target: 'out', templateRoot: root, ...extra });
const output = (b = 'extension body\n') => [{ path: 'src/a.ts', content: 'managed body\n', ownership: 'managed' },
  { path: 'src/b.ts', content: b, ownership: 'extension' }];
const conflict = (plan, text) => plan.conflicts.some(item => item.includes(text));

test('a fresh plan applies once; an unchanged regeneration is conflict-free and keeps the receipt', async t => {
  const folder = await vault(t);
  const plan = await planArtifacts(options(), input(folder), blank, output());
  assert.deepEqual(plan.conflicts, []); assert.equal(plan.summary.files, 2); assert.equal(plan.summary.project, blank.project.id);
  await assert.rejects(applyProject(plan, 'stale'), /stale/);
  await applyProject(plan, plan.hash);
  const receipt = JSON.parse(await readFile(join(folder, 'out/.companion/generation.json'), 'utf8'));
  assert.deepEqual(receipt.files.map(file => file.path), ['src/a.ts', 'src/b.ts']);
  const again = await planArtifacts(options(), input(folder), blank, output());
  assert.deepEqual(again.conflicts, []); assert.deepEqual(again.preserved, []);
  assert.deepEqual(reviewProject(again).changes.map(change => change.status).sort(), ['unchanged', 'unchanged', 'unchanged']);
  // A file the generator no longer emits stays tracked and on disk; it is never removed implicitly.
  const retired = await planArtifacts(options(), input(folder), blank, output().slice(1)); await applyProject(retired, retired.hash);
  const tracked = JSON.parse(await readFile(join(folder, 'out/.companion/generation.json'), 'utf8'));
  assert.deepEqual(tracked.files.map(file => file.path).sort(), ['src/a.ts', 'src/b.ts']);
  assert.equal(await readFile(join(folder, 'out/src/a.ts'), 'utf8'), 'managed body\n');
});

test('customized extensions survive, customized managed or binary files and unowned or removed files conflict', async t => {
  const folder = await vault(t);
  const first = await planArtifacts(options(), input(folder), blank, output()); await applyProject(first, first.hash);
  await writeFile(join(folder, 'out/src/b.ts'), 'developer edit\n');
  const kept = await planArtifacts(options(), input(folder), blank, output());
  assert.deepEqual(kept.preserved, ['src/b.ts']); assert.deepEqual(kept.conflicts, []);
  assert.ok(conflict(await planArtifacts(options(), input(folder), blank, output('generator changed\n')), 'customized file conflicts'));
  await writeFile(join(folder, 'out/src/b.ts'), Buffer.from([0xff, 0xfe]));
  assert.ok(conflict(await planArtifacts(options(), input(folder), blank, output()), 'not UTF-8'));
  await writeFile(join(folder, 'out/src/a.ts'), 'edited managed\n');
  assert.ok(conflict(await planArtifacts(options(), input(folder), blank, output()), 'src/a.ts: customized'));
  await rm(join(folder, 'out/src/a.ts'));
  assert.ok(conflict(await planArtifacts(options(), input(folder), blank, output()), 'previously generated file was removed'));
  await writeFile(join(folder, 'out/src/c.ts'), 'unowned\n');
  const unowned = await planArtifacts(options(), input(folder), blank, [...output(), { path: 'src/c.ts', content: 'x', ownership: 'managed' }]);
  assert.ok(conflict(unowned, 'existing unowned file'));
  await assert.rejects(applyProject(unowned, unowned.hash), /Generation conflicts/);
});

test('retained scoped files keep exact bytes unless they need generation', async t => {
  const folder = await vault(t);
  const first = await planArtifacts(options(), input(folder), blank, output()); await applyProject(first, first.hash);
  const selection = { kind: 'page', id: 'x', root: 'page:x', included: [], selectedPaths: ['src/a.ts'], sharedPaths: [], retainedPaths: ['src/b.ts'] };
  const retained = await planArtifacts(options({ selection }), input(folder), blank, output());
  assert.deepEqual(retained.conflicts, []); assert.deepEqual(retained.summary.selection, selection);
  const needs = await planArtifacts(options({ selection }), input(folder), blank, output('changed generation\n'));
  assert.ok(conflict(needs, 'excluded artifact needs generation'));
});

test('bootstrap ownership, receipts and the target location are validated before planning', async t => {
  const folder = await vault(t);
  await assert.rejects(planArtifacts(options({ bootstrap: [{ path: 'src/x.ts', hash: 'a'.repeat(64) }] }), input(folder), blank, output()), /Invalid bootstrap ownership/);
  const boot = await planArtifacts(options({ bootstrap: [{ path: 'README.md', hash: 'a'.repeat(64) }] }), input(folder), blank, output());
  assert.deepEqual(boot.conflicts, []); await applyProject(boot, boot.hash);
  const booted = JSON.parse(await readFile(join(folder, 'out/.companion/generation.json'), 'utf8'));
  assert.deepEqual(booted.files.find(file => file.path === 'README.md'), { path: 'README.md', hash: 'a'.repeat(64), ownership: 'framework' });
  await rm(join(folder, 'out'), { recursive: true });
  await assert.rejects(planArtifacts({ target: 'out', templateRoot: folder }, input(folder), blank, output()), /outside this framework checkout/);
  await assert.rejects(planArtifacts(options(), input(folder), blank, Array.from({ length: 5001 }, (_, i) => ({ path: `f/${i}.ts`, content: '', ownership: 'managed' }))), /ownership inventory/);
  await mkdir(join(folder, 'out/.companion'), { recursive: true });
  const write = value => writeFile(join(folder, 'out/.companion/generation.json'), JSON.stringify(value));
  const file = { path: 'src/a.ts', hash: digest('x'), ownership: 'managed' };
  await write({ ...generationReceipt('other', 'x', [file]) });
  await assert.rejects(planArtifacts(options(), input(folder), blank, output()), /another project/);
  await write(generationReceipt(blank.project.id, 'x', [{ ...file, ownership: 'root' }]));
  await assert.rejects(planArtifacts(options(), input(folder), blank, output()), /Invalid ownership receipt/);
  await write(generationReceipt(blank.project.id, 'x', [file, { ...file, path: 'SRC/A.ts' }]));
  await assert.rejects(planArtifacts(options(), input(folder), blank, output()), /Duplicate receipt paths/);
});

test('reviews of schema 6 input carry no legacy interaction mapping, even when a caller passes a retired migration report', async t => {
  const folder = await vault(t);
  const plain = reviewProject(await planArtifacts(options(), input(folder), blank, output()));
  assert.equal(Object.hasOwn(plain, 'legacyInteractionIds'), false);
  const retired = reviewProject(await planArtifacts(options(), { ...input(folder), migration: { interactionIds: { edge: 'interaction' } } }, blank, output()));
  assert.equal(Object.hasOwn(retired, 'legacyInteractionIds'), false);
  assert.equal(retired.planHash, plain.planHash);
});

test('project planning compiles, scopes and refuses invalid scope combinations and failed compilations', async t => {
  const folder = await vault(t);
  await writeFile(join(folder, 'quick.json'), quickText); await writeFile(join(folder, 'broken.json'), '{');
  const plan = await planProject({ input: join(folder, 'quick.json'), target: 'plugin', vault: folder, templateRoot: root });
  assert.deepEqual(plan.conflicts, []); assert.equal(plan.summary.compiler.outputKind, 'obsidian-plugin');
  assert.ok(plan.plan.changes.some(change => change.path.startsWith('plugin/bin/')));
  // An installed kit owns bin/: in-place generation must not write the template's runtime sources over it.
  const kit = await planProject({ input: join(folder, 'quick.json'), target: 'kit', vault: folder, templateRoot: root, reservedRoot: 'bin' });
  assert.ok(!kit.plan.changes.some(change => change.path.startsWith('kit/bin/')));
  assert.ok(kit.plan.changes.some(change => change.path.startsWith('kit/src/')));
  await assert.rejects(planProject({ input: join(folder, 'quick.json'), target: 'plugin', vault: folder, templateRoot: root, scope: 'bogus' }), /GENERATION_SCOPE_INVALID/);
  await assert.rejects(planProject({ input: join(folder, 'quick.json'), target: 'plugin', vault: folder, templateRoot: root, scope: 'page:x', output: [] }), /GENERATION_SCOPE_OVERRIDE/);
  await assert.rejects(planProject({ input: join(folder, 'broken.json'), target: 'plugin', vault: folder, templateRoot: root }), /./);
  const quick = projectModel(JSON.parse(quickText));
  const files = await renderProjectFiles(template, quick);
  const page = quick.document.design.visualDesigns.pages[0];
  const scoped = generationSelection(quick, files, 'page:' + page.id);
  assert.ok(scoped.selectedPaths.length > 0 && scoped.retainedPaths.length > 0);
  assert.equal(generationSelection(quick, files, 'all'), undefined);
  assert.throws(() => generationSelection(quick, files, 'page:missing'), /GENERATION_SCOPE_UNKNOWN/);
});

test('the composition root separates analysis, plugin and project-starter compilation', async () => {
  const analysis = await analyzeProject(blankText);
  assert.equal(analysis.status, 'ok'); assert.equal(analysis.artifacts.length, 0);
  const plugin = await compileProject({ source: blankText, template });
  assert.equal(plugin.status, 'ok'); assert.ok(plugin.artifacts.some(file => file.path === 'design/compiler-origins.json'));
  const selection = { schemaVersion: 2, starter: { id: 'x', version: '1.0.0', sha256: 'a'.repeat(64) }, projectType: 'cli', framework: 'none', targets: ['cli'] };
  const refused = await compileProject({ source: blankText, template, projectSelection: selection });
  assert.equal(refused.status, 'failed'); assert.match(refused.diagnostics[0].message, /outputKind project/);
  const missing = await compileProject({ source: blankText, template, outputKind: 'project', projectSelection: { ...selection, framework: 'svelte', projectType: 'webapp', targets: ['webapp'] } });
  assert.equal(missing.status, 'failed'); assert.match(missing.diagnostics[0].message, /installed framework adapter/);
  const starter = await compileProject({ source: blankText, template, outputKind: 'project', projectSelection: selection });
  assert.equal(starter.status, 'ok'); assert.ok(starter.diagnostics.some(item => item.code === 'COMPILER_ADAPTER_REQUIRED'));
  const contributed = await compileProject({ source: blankText, template, outputKind: 'project', projectSelection: { ...selection, framework: 'react', projectType: 'webapp', targets: ['webapp'] } },
    {}, { frameworkAdapters: [{ id: 'react', label: 'React', engine: 'vanilla' }] });
  assert.equal(contributed.status, 'ok');
});
