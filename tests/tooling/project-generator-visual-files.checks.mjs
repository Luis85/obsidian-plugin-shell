// Visual equivalents of the retired detail/composition emission checks: SFCs, specs, ports, hooks, generated tests and model tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { migrateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { visualDefinitions, visualSpecs } from '../../scripts/companion/compiler/visual-model.ts';
import { visualTestSource } from '../../scripts/companion/visual/visual-session.mjs';
import { visualNodes, visualRoot } from '../../scripts/companion/visual/visual-ir.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = async path => migrateCompanionDocument(JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))).document;
const fixture = await read('../fixtures/companion/detail-v3.json'), self = await read('../../docs/concepts/companion/companion-project.json');
const clone = () => structuredClone(fixture);
const files = async d => new Map((await projectFiles(root, projectModel(d))).map(e => [e.path, e.content]));
const store = d => d.design.visualDesigns;
const libraryPage = d => store(d).pages[1].root[0];
const review = d => store(d).components[0], confirm = d => review(d).template[0].children.find(n => n.id === 'vn-5');
const lit = value => ({ kind: 'literal', value });
const nuxt = (id, entryId, events = []) => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: {}, slots: {}, events });
const act = (id, event, actions) => ({ id, event, label: 'Interaction ' + id, notes: '', acceptance: '', actions });

test('compiler emits layouts, slots, typed props, source ports, hooks and traceable interaction tests', async () => {
  const entries = await files(fixture), code = 'src/generated/';
  const page = entries.get(code + 'presentation/components/details/vp-8.vue');
  assert.match(page, /data-design-node="vn-9" v-if="model\.visible\('vn-9'\)" :style="model\.style\('vn-9'\)"/);
  assert.match(page, /<ProjectJsonReview data-design-node="vn-11"[^>]*v-bind="model\.props\('vn-11'\)"/);
  assert.match(entries.get(code + 'presentation/components/library/project-json-review.vue'), /<slot name="content">/);
  assert.match(entries.get(code + 'domain/components/contracts/project-json-review.ts'), /"busy"\?: boolean/);
  assert.match(entries.get(code + 'domain/components/project-json-review.ts'), /export const specification = /);
  assert.match(entries.get(code + 'domain/visual/vp-8.ts'), /^import type \{ VisualPageSpec \} from '\.\.\/visual-runtime\.ts';\nexport const specification: VisualPageSpec = \{/);
  assert.match(entries.get(code + 'domain/visual/vc-1.ts'), /export const specification: VisualComponentSpec = \{/);
  assert.match(entries.get(code + 'bootstrap/visual-context.ts'), /defineGAuthoringVaultStore/);
  assert.match(entries.get(code + 'bootstrap/mount.ts'), /provideVisualContext\(app, createVisualContext\(sources, pinia, openModal\)\)/);
  assert.match(entries.get(code + 'application/interactions/vi-14.ts'), /NotImplementedError\("vp-8", "vi-14"\)/);
  assert.match(entries.get(code + 'application/visual-interactions.ts'), /case "vi-14": return E0\(request, sources\);/);
  assert.match(entries.get(code + 'presentation/components/screens/import-project.vue'), /import Detail from '\.\.\/details\/vp-8\.vue';/);
  assert.match(entries.get('tests/project/visual/definitions.test.ts'), /f\.navigate\.mock\.calls\.map\(\(\[target\]\) => target\)\)\.toEqual\(\["node-17"\]\)/);
  assert.match(entries.get('tests/project/acceptance/vi-14.test.ts'), /it\.todo\("\[vi-14\] Review selected file/);
  assert.match(entries.get('tests/project/ui-effects/vp-15.checks.mjs'), /Generated executable model tests/);
  const trace = JSON.parse(entries.get('design/visual-traceability.json'));
  assert.deepEqual(trace.definitions.map(d => [d.id, d.kind, d.ownerId ?? d.libraryId]), [['vp-8', 'page', 'node-48'], ['vp-15', 'page', 'node-27'], ['vc-1', 'component', 'project-json-review']]);
  assert.deepEqual(trace.interactions.map(i => [i.id, i.verification, Boolean(i.implementation), Boolean(i.test)]), [['vi-14', 'business-todo', true, true], ['vi-19', 'navigation', false, false], ['vi-7', 'business-todo', true, true]]);
  assert.equal(trace.businessAcceptance, 'not-implemented');
  assert.equal([...entries.keys()].some(p => /use-detail|detail-context|detail-interactions|detail-traceability|domain\/details\/|\/details\/[^/]+\.test\.ts$/.test(p)), false);
});
test('custom folders keep all emitted imports relative and authored text inert', async () => {
  const d = clone(); d.settings = { codebaseFolder: 'product/code', testsFolder: 'product/specs' };
  store(d).pages[0].root[0].children.find(n => n.id === 'vn-12').value = lit('</script><script>throw Error("injected")</script>{{ dangerous() }}');
  const entries = await files(d);
  assert.ok(entries.has('product/code/generated/presentation/components/details/vp-8.vue'));
  assert.doesNotMatch(entries.get('product/code/generated/presentation/components/details/vp-8.vue'), /injected|dangerous/);
  const spec = entries.get('product/code/generated/domain/visual/vp-8.ts'); assert.ok(!spec.includes('</script>')); assert.match(spec, /\\u003c/);
  assert.match(entries.get('product/specs/project/visual/definitions.test.ts'), /from "\.\.\/\.\.\/\.\.\/code\/generated\/presentation\/components\/details\/vp-8\.vue"/);
});
test('elements and Nuxt UI components without form semantics bind designed listeners', async () => {
  const d = clone(), kinds = ['u-table', 'u-tabs', 'u-separator', 'u-avatar', 'u-alert'];
  store(d).pages[0].root[0].events.push(act('vi-40', 'click', [{ kind: 'set-state', state: 'empty' }]));
  libraryPage(d).children.push(...kinds.map((entry, i) => nuxt('vn-' + (41 + i), entry, [act('vi-' + (51 + i), 'click', [{ kind: 'toggle', nodeId: 'vn-17' }])])));
  store(d).nextId = 60;
  const entries = await files(d), vue = entries.get('src/generated/presentation/components/details/vp-15.vue');
  assert.match(entries.get('src/generated/presentation/components/details/vp-8.vue'), /data-design-node="vn-9"[^>]*v-on="model\.on\('vn-9'\)"/);
  for (let i = 0; i < kinds.length; i++) assert.match(vue, new RegExp(`data-design-node="vn-${41 + i}"[^>]*v-on="model\\.on\\('vn-${41 + i}'\\)"`), kinds[i]);
  const tabs = structuredClone(d); libraryPage(tabs).children.find(n => n.id === 'vn-42').events[0].event = 'dblclick';
  assert.throws(() => visualDefinitions(projectModel(tabs)), /event "dblclick" is not declared by this element/);
});
test('generated value assertions read the real control state instead of serialized markup', async () => {
  const d = clone(); libraryPage(d).children.push(nuxt('vn-41', 'u-input'), nuxt('vn-42', 'u-checkbox'), nuxt('vn-43', 'u-button', [act('vi-44', 'click', [{ kind: 'set-value', nodeId: 'vn-41', value: 'typed' }, { kind: 'set-value', nodeId: 'vn-42', value: true }])]));
  store(d).nextId = 45;
  const test = (await files(d)).get('tests/project/visual/definitions.test.ts');
  assert.ok(test.includes('expect(marked(wrapper.element, "vn-41").value).toBe("typed");'), test);
  assert.ok(test.includes('expect(marked(wrapper.element, "vn-42").getAttribute(\'aria-checked\')).toBe("true");'), test);
  assert.ok(!test.includes('toContain("true")'));
});
test('interactions sharing one event are dispatched once and asserted in declaration order', async () => {
  const d = clone(), open = libraryPage(d).children.find(n => n.id === 'vn-18');
  open.events.unshift(act('vi-40', 'click', [{ kind: 'set-state', state: 'empty' }])); store(d).nextId = 41;
  const test = (await files(d)).get('tests/project/visual/definitions.test.ts');
  assert.ok(test.includes('.slice(-2)).toEqual(["vi-40","vi-19"]);'), test);
  assert.ok(test.includes('expect(wrapper.attributes(\'data-design-state\')).toBe("empty");'));
});
test('complete companion lowers every live definition with independent identities; revisions stay immutable', () => {
  const m = projectModel(self), designs = visualDefinitions(m), specs = visualSpecs(m);
  assert.deepEqual([designs.pages.length, designs.components.length, designs.revisions.length, specs.length], [27, 54, 54, 81]);
  const ids = [...designs.pages, ...designs.components, ...designs.revisions].flatMap(d => [d.id, ...visualNodes(visualRoot(d)).map(n => n.id)]);
  assert.equal(new Set(ids).size, ids.length);
  const changed = structuredClone(self), revision = store(changed).revisions[0], live = store(changed).components.find(c => c.id === revision.componentId);
  const text = visualNodes(live.template).find(n => n.kind === 'text'); text.value = lit('New working content');
  assert.deepEqual(visualDefinitions(projectModel(changed)).revisions, designs.revisions);
});
test('generated model tests execute every declared local effect and navigation in all live definitions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'companion-visual-model-tests-')), specs = visualSpecs(projectModel(self));
  try {
    const paths = [];
    for (const spec of specs) { const path = join(dir, spec.id + '.checks.mjs'); await writeFile(path, visualTestSource(spec)); paths.push(path); }
    const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...paths], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) });
    assert.equal(run.status, 0, (run.error?.message || '') + run.stdout.split('\n').filter(line => /✖|not ok|Error/.test(line)).slice(0, 20).join('\n'));
    const interactions = specs.flatMap(s => visualNodes(visualRoot(s)).flatMap(n => n.events ?? []));
    const executable = interactions.filter(i => i.actions.length).length;
    assert.ok(executable > 120); assert.match(run.stdout, new RegExp('pass ' + executable + '(?:\\n|\\r)'));
    assert.match(run.stdout, new RegExp('todo ' + (interactions.length - executable) + '(?:\\n|\\r)'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('single-word library and screen names get the shared multi-word component file names', async () => {
  const d = clone(), library = d.design.library.find(l => l.id === 'project-json-review');
  library.id = 'review'; review(d).libraryId = 'review'; review(d).dependencies = [{ package: 'editor-lib', version: '1.0.0', purpose: 'Editing' }];
  review(d).template.push({ id: 'vn-40', kind: 'external', package: 'editor-lib', adapter: 'editor', props: {}, events: [] }); store(d).nextId = 41;
  for (const node of d.design.nodes) node.components = (node.components ?? []).map(c => (c.id === 'project-json-review' ? { ...c, id: 'review' } : c));
  const entries = await files(d), code = 'src/generated/presentation/components/';
  assert.ok(entries.has(code + 'library/review-component.vue')); assert.ok(!entries.has(code + 'library/review.vue'));
  assert.ok(entries.has(code + 'library/review-component/editor.adapter.ts'));
  assert.ok(entries.has(code + 'screens/components-screen.vue')); assert.match(entries.get(code + 'screens/components-screen.vue'), /import Detail from '\.\.\/details\/vp-15\.vue';/);
  assert.match(entries.get(code + 'details/vp-8.vue'), /import ProjectJsonReview from "\.\.\/library\/review-component\.vue";/);
  assert.match(entries.get(code + 'library/review-component.vue'), /from "\.\/review-component\/editor\.adapter\.ts"/);
  assert.match(entries.get('src/generated/domain/components/contracts/review.ts'), /export interface ComponentProps/);
});
test('emit switches and the interaction dispatcher declare only parameters they read', async () => {
  const d = clone(); review(d).emits = []; confirm(d).events[0].actions = [{ kind: 'navigate', surfaceId: 'node-17' }];
  store(d).pages[0].root[0].children.find(n => n.id === 'vn-10').events[0].actions = [{ kind: 'set-state', state: 'empty' }];
  const entries = await files(d);
  assert.match(entries.get('src/generated/presentation/components/library/project-json-review.vue'), /request => emit\('interaction', request\), \(name\) => \{/);
  assert.equal(entries.get('src/generated/application/visual-interactions.ts'), "import type { VisualRequest } from '../domain/visual-runtime.ts';\nimport type { Sources } from './sources.ts';\nexport const handleVisualInteraction: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new Error('VISUAL_INTERACTION_UNKNOWN'); };\n");
  assert.match((await files(fixture)).get('src/generated/application/interactions/vi-14.ts'), /export const execute: \(request: VisualRequest, sources: Sources\) => Promise<unknown> = async \(\) => \{ throw new NotImplementedError\("vp-8", "vi-14"\); \};/);
});
