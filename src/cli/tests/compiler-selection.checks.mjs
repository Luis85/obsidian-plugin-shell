import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSelection, selectionClosure } from '../compiler/domain/selection.ts';
import { generationSelection } from '../compiler/adapters/selection.ts';
import { planArtifacts, applyProject } from '../compiler/adapters/workspace-plan.ts';
import { planProject } from '../compiler/adapters/project-plan.ts';
import { projectModel, digest } from '../compiler/emitters/model.ts';
import { validateAuthoringDocument } from '#shared/companion/authoring-contract.ts';
import { projectFiles } from './support/project-render.mjs';
import { descriptor } from '../adapters/framework/catalog.ts';
import { starterDocument } from '#shared/testing/starter-documents.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const starter = structuredClone(starterDocument('quick-capture'));
const model = projectModel(starter);
const blank = structuredClone(starterDocument('blank'));
const graph = [{ key: 'page:one', dependencies: ['component:b', 'component:a'] },
  { key: 'component:a', dependencies: ['source:data'] }, { key: 'component:b', dependencies: ['source:data'] },
  { key: 'source:data', dependencies: [] }, { key: 'page:unrelated', dependencies: [] }];

test('scope parsing is explicit and defaults to complete generation', () => {
  assert.equal(parseSelection(), null); assert.equal(parseSelection('all'), null);
  for (const kind of ['feature', 'page', 'component']) assert.deepEqual(parseSelection(kind + ':stable-id'), { kind, id: 'stable-id' });
  for (const value of ['', '*', 'page:', 'folder:src', 'page:x\n', 'page:' + 'x'.repeat(121)])
    assert.throws(() => parseSelection(value), /GENERATION_SCOPE_INVALID/);
  assert.ok(descriptor('generate').options.scope === 'value');
});
test('closure is deterministic, unique and excludes unrelated definitions', () => {
  const request = parseSelection('page:one'); const result = selectionClosure(request, 'page:one', graph);
  assert.deepEqual(result.included, ['component:a', 'component:b', 'page:one', 'source:data']);
  assert.deepEqual(selectionClosure(request, 'page:one', [...graph].reverse()), result);
  assert.equal(result.dependencies.length, 4); assert.deepEqual(graph[0].dependencies, ['component:b', 'component:a']);
});
test('unknown selection, missing dependencies, cycles and duplicate nodes fail before emission', () => {
  assert.throws(() => selectionClosure(parseSelection('page:missing'), 'page:missing', graph), /GENERATION_SCOPE_UNKNOWN/);
  assert.throws(() => selectionClosure(parseSelection('page:one'), 'page:one', graph.slice(0, 3)), /GENERATION_SCOPE_REFERENCE/);
  assert.throws(() => selectionClosure(parseSelection('page:one'), 'page:one', [...graph, graph[0]]), /GENERATION_SCOPE_GRAPH/);
  const cyclic = structuredClone(graph); cyclic[3].dependencies.push('page:one');
  assert.throws(() => selectionClosure(parseSelection('page:one'), 'page:one', cyclic), /GENERATION_SCOPE_CYCLE/);
});
test('real authored pages resolve visual and library aliases, sources, entities, and shared file ownership', async () => {
  const output = await projectFiles(root, model), before = JSON.stringify(starter);
  const visual = starter.design.visualDesigns, page = visual.pages[0];
  const selected = generationSelection(model, output, 'page:' + page.id);
  assert.equal(selected.root, 'page:' + page.ownerId);
  assert.deepEqual(selected.selectedPaths, generationSelection(model, output, 'page:' + page.ownerId).selectedPaths);
  assert.ok(selected.selectedPaths.includes(`${model.sourceRoot}/domain/visual/${page.id}.ts`));
  assert.ok(selected.sharedPaths.includes('design/project.json'));
  assert.ok(selected.sharedPaths.some(path => path.endsWith('/bootstrap/install.ts')));
  assert.ok(selected.retainedPaths.length > 0);
  assert.equal(new Set([...selected.selectedPaths, ...selected.sharedPaths, ...selected.retainedPaths]).size, output.length);
  for (const component of visual.components) {
    const byDesign = generationSelection(model, output, 'component:' + component.id);
    assert.deepEqual(byDesign.selectedPaths, generationSelection(model, output, 'component:' + component.libraryId).selectedPaths);
  }
  const sourcePage = visual.pages.find(page => generationSelection(model, output, 'page:' + page.id).included.some(id => id.startsWith('source:')));
  assert.ok(sourcePage, 'fixture exercises source bindings');
  const dependencies = generationSelection(model, output, 'page:' + sourcePage.id).included;
  assert.ok(dependencies.includes('entity:er-entity-1'));
  assert.equal(JSON.stringify(starter), before);
});
test('features include owned surfaces and declared prerequisite features once, without treating navigation as a dependency', () => {
  const document = structuredClone(blank);
  document.design.features = { schema: 1, items: [
    { id: 'settings', name: 'Settings', surfaces: ['node-2'], entryPoints: ['node-2'], components: [], requirements: [], dependsOn: [] },
    { id: 'workspace', name: 'Workspace', surfaces: ['node-1'], entryPoints: ['node-1'], components: [], requirements: [], dependsOn: ['settings'] },
  ] };
  validateAuthoringDocument(document);
  const result = generationSelection(projectModel(document), [], 'feature:workspace');
  assert.deepEqual(result.included, ['feature:settings', 'feature:workspace', 'page:node-1', 'page:node-2']);
  assert.throws(() => generationSelection(model, [], 'page:absent'), /GENERATION_SCOPE_UNKNOWN/);
});
async function workspace(work) {
  const vault = await realpath(await mkdtemp(join(tmpdir(), 'generation-scope-')));
  const input = { vault, target: join(vault, 'plugin'), content: Buffer.from(JSON.stringify(blank)) };
  const m = projectModel(blank);
  const files = [
    { path: 'src/generated/presentation/components/screens/workspace-screen.vue', content: 'workspace\n', ownership: 'extension' },
    { path: 'src/generated/presentation/components/screens/preferences-screen.vue', content: 'preferences\n', ownership: 'extension' },
    { path: 'design/project.json', content: JSON.stringify(blank), ownership: 'managed' },
    { path: 'src/generated/navigation.ts', content: 'complete registry\n', ownership: 'managed' },
  ];
  const options = { target: 'plugin', templateRoot: root };
  try { await work({ vault, input, m, files, options }); } finally { await rm(vault, { recursive: true, force: true }); }
}
test('scoped writer updates selected and shared files, preserving excluded edited bytes and original ownership', () => workspace(async ({ vault, input, m, files, options }) => {
  const full = await planArtifacts(options, input, m, files); await applyProject(full, full.hash);
  const excluded = join(input.target, files[1].path), custom = Buffer.from([0xff, 0xfe, 0x61]);
  await writeFile(excluded, custom);
  const next = structuredClone(files); next[0].content += 'authored update\n'; next[3].content += 'updated shared registry\n';
  const selection = generationSelection(m, next, 'page:node-1');
  const scoped = await planArtifacts({ ...options, selection }, input, m, next);
  assert.deepEqual(scoped.conflicts, []);
  assert.equal(scoped.plan.changes.find(file => file.path.endsWith(files[1].path)).status, 'unchanged');
  const result = await applyProject(scoped, scoped.hash);
  assert.ok(!result.written.some(file => file.endsWith(files[1].path)));
  assert.deepEqual(await readFile(excluded), custom);
  const receipt = JSON.parse(await readFile(join(input.target, '.companion/generation.json'), 'utf8'));
  assert.equal(receipt.files.find(file => file.path === files[1].path).hash, digest(files[1].content));
  assert.equal(receipt.selection.root, 'page:node-1');
  const replay = await planArtifacts({ ...options, selection }, input, m, next);
  assert.deepEqual(replay.conflicts, []); assert.deepEqual((await applyProject(replay, replay.hash)).written, []);
  assert.equal((await readdir(vault)).length, 1);
}));
test('a missing or newly changed excluded artifact blocks a scoped plan instead of emitting an incomplete project', () => workspace(async ({ input, m, files, options }) => {
  const selection = generationSelection(m, files, 'page:node-1');
  const fresh = await planArtifacts({ ...options, selection }, input, m, files);
  assert.ok(fresh.conflicts.some(message => message.includes('excluded artifact needs generation')));
  await assert.rejects(applyProject(fresh, fresh.hash), /conflicts/);
  const initial = await planArtifacts(options, input, m, files); await applyProject(initial, initial.hash);
  const changed = structuredClone(files); changed[1].content += 'new required code\n';
  const plan = await planArtifacts({ ...options, selection }, input, m, changed);
  assert.ok(plan.conflicts.some(message => message.startsWith(files[1].path + ': excluded')));
  await assert.rejects(applyProject(plan, plan.hash), /conflicts/);
  assert.equal(await readFile(join(input.target, files[1].path), 'utf8'), files[1].content);
}));
test('an excluded file changed after review invalidates the scoped apply; it is not unguarded', () => workspace(async ({ input, m, files, options }) => {
  const full = await planArtifacts(options, input, m, files); await applyProject(full, full.hash);
  const selection = generationSelection(m, files, 'page:node-1');
  const plan = await planArtifacts({ ...options, selection }, input, m, files);
  await writeFile(join(input.target, files[1].path), 'concurrent developer edit');
  await assert.rejects(applyProject(plan, plan.hash), /STALE/);
  assert.equal(await readFile(join(input.target, files[1].path), 'utf8'), 'concurrent developer edit');
}));
test('invalid scope and caller-supplied output are refused before template or filesystem work', async () => {
  await assert.rejects(planProject({ input: '/missing', target: 'target', scope: 'folder:src' }), /GENERATION_SCOPE_INVALID/);
  await assert.rejects(planProject({ input: '/missing', target: 'target', scope: 'page:node-1', output: [] }), /GENERATION_SCOPE_OVERRIDE/);
});
