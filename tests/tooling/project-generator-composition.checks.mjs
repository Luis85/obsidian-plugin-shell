import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { detailDocuments } from '../../scripts/companion/compiler/detail-model.ts';
import { compositionTestSource } from '../../scripts/companion/composition-contract.mjs';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { fileURLToPath } from 'node:url';
const project = JSON.parse(await readFile(new URL('../../docs/concepts/companion/companion-project.json', import.meta.url), 'utf8'));
const documents = detailDocuments(projectModel(project));
const root = fileURLToPath(new URL('../../', import.meta.url));
function interaction(kind, extra, edit) {
  const d = structuredClone(project); const doc = d.design.detailDesigns.documents.find(x => x.id === 'detail-document-14');
  const node = doc.nodes.find(n => n.id === 'detail-node-16'); node.kind = kind; delete node.options; Object.assign(node, extra);
  edit(doc.edges[0]); return d;
}
const generated = async (d, suffix) => (await projectFiles(root, projectModel(d))).find(f => f.path.endsWith('/details/detail-document-14' + suffix)).content;
test('composition controls without form semantics still bind designed listeners', async () => {
  for (const [kind, extra] of [['table', {}], ['list', { options: ['a', 'b'] }], ['tabs', { options: ['one', 'two'] }], ['divider', {}], ['image', {}]]) {
    const vue = await generated(interaction(kind, extra, edge => { edge.source = 'detail-node-16'; edge.target = 'detail-node-17'; }), '.vue');
    assert.match(vue, /data-design-node="detail-node-16"[^>]*v-on="model.listeners\('detail-node-16'\)"/, kind);
  }
  assert.throws(() => detailDocuments(projectModel(interaction('tabs', { options: ['one', 'two'] }, edge => { edge.source = 'detail-node-16'; edge.target = 'detail-node-17'; edge.event = 'input'; }))), /Unsupported detail event/);
});
test('generated value assertions read the real control state instead of serialized markup', async () => {
  const checkbox = await generated(interaction('checkbox', {}, edge => { edge.targetSurfaceId = null; edge.effect = { type: 'value', value: true }; }), '.test.ts');
  assert.ok(checkbox.includes('wrapper.get<HTMLInputElement>("[data-design-node=\\"detail-node-16\\"] input").element.checked).toBe(true)'), checkbox); assert.ok(!checkbox.includes('toContain("true")'));
  const text = await generated(interaction('input', {}, edge => { edge.targetSurfaceId = null; edge.effect = { type: 'value', value: 'typed' }; }), '.test.ts');
  assert.ok(text.includes('wrapper.get<HTMLInputElement>("[data-design-node=\\"detail-node-16\\"] input").element.value).toBe("typed")'), text);
  const tabs = await generated(interaction('tabs', { options: ['one', 'two'] }, edge => { edge.targetSurfaceId = null; edge.effect = { type: 'value', value: 'two' }; }), '.test.ts');
  assert.ok(tabs.includes('[aria-selected=\\"true\\"]").text()).toBe("two")'), tabs);
});
test('complete companion lowers all live designs and immutable published designs with independent identities', () => {
  const store = project.design.detailDesigns;
  assert.equal(store.documents.length, 81); assert.equal(store.revisions.length, 54);
  assert.equal(documents.length, 135); assert.equal(new Set(documents.map(d => d.id)).size, documents.length);
  for (const doc of documents) for (const node of doc.nodes) assert.equal(Object.hasOwn(node, 'position'), false);
  for (const revision of store.revisions) {
    const doc = documents.find(d => d.id === revision.id);
    assert.deepEqual(doc.designSystem, revision.designSystem);
    assert.ok(doc.nodes.every(n => n.id.startsWith(revision.id + '-')));
  }
});
test('editing a working component never rewrites an independently compiled published revision', () => {
  const changed = structuredClone(project), revision = changed.design.detailDesigns.revisions[0];
  const original = documents.find(d => d.id === revision.id);
  changed.design.detailDesigns.documents.find(d => d.ownerId === revision.ownerId && d.kind === 'component').nodes[0].text = 'New working content';
  const after = detailDocuments(projectModel(changed));
  assert.deepEqual(after.find(d => d.id === revision.id), original);
});
test('generated model tests execute every declared UI effect and navigation in all 134 compiled designs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'companion-model-tests-'));
  try {
    const paths=[];
    for (const doc of documents) { const path=join(dir,doc.id+'.checks.mjs'); await writeFile(path,compositionTestSource(doc)); paths.push(path); }
    const run=spawnSync(process.execPath,['--test','--test-concurrency=1',...paths],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='NODE_TEST_CONTEXT'))});
    assert.equal(run.status,0,(run.error?.message||'')+run.stdout+run.stderr);
    const executable=documents.flatMap(d=>d.edges).filter(e=>e.effect||e.targetSurfaceId).length;
    assert.ok(executable>150); assert.match(run.stdout,new RegExp('pass '+executable+'(?:\\n|\\r)'));
    const unimplemented=documents.flatMap(d=>d.edges).filter(e=>!e.effect&&!e.targetSurfaceId).length;
    assert.match(run.stdout,new RegExp('todo '+unimplemented+'(?:\\n|\\r)'));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
