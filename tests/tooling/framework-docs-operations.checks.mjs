import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, rename, symlink, realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { extractKit } from './framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { newDocument } from '../../src/cli/domain/document.ts';
import { savePlan, applyPrepared } from '../../src/cli/adapters/storage.ts';
import { openDocument } from '../../src/cli/domain/document.ts';
import { addPage } from '../../src/cli/domain/pages.ts';
import { attachComponents } from '../../src/cli/domain/components.ts';
import { defaults } from '../../src/cli/adapters/framework/configuration.ts';
import { parseCliArguments } from '../../src/cli/adapters/framework/catalog.ts';
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';
import { planOperation, applyOperation } from '../../src/cli/adapters/framework/planning.ts';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { projectEntities } from '../../src/cli/documentation/adapters/model.ts';
import { keyOf } from '../../src/cli/documentation/domain/contracts.ts';
import { parseMarkdown, renderMarkdown } from '../../src/cli/documentation/adapters/markdown.ts';
import { journalHook, recoverDocuments } from '../../src/cli/documentation/adapters/recovery.ts';
import { documentationDigest as digest } from '../../src/cli/documentation/adapters/filesystem.ts';
import { documentationStatus } from '../../src/cli/documentation/adapters/plan.ts';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
test('documentation status adapter remains an explicit lazy-load contract', () => { assert.equal(typeof documentationStatus, 'function'); });
async function directory(t) { const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-docs-'))); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
async function write(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
async function fixture(t, project = projectFixture().project, kit = false) {
  const root = await directory(t), ctx = { root, frameworkRoot: kit ? root : frameworkRoot, inputText: JSON.stringify(project) };
  if (kit) await extractKit(frameworkRoot, root);
  const response = await executeOperation(parseCliArguments(['setup', '--input', '-', '--yes']), ctx);
  assert.equal(response.status, 'applied', JSON.stringify(response)); delete ctx.inputText;
  return ctx;
}
async function saveModel(ctx, project) {
  const before = digest(await readFile(join(ctx.root, 'design/project.json')));
  const prepared = await savePlan(ctx.root, 'design/project.json', openDocument(project), before);
  await applyPrepared(prepared, prepared.planHash);
}
const run = (ctx, args) => executeOperation(parseCliArguments(args), ctx);
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function exportDocs(ctx) { const result = await run(ctx, ['docs', 'export', '--yes']); assert.ok(['applied', 'unchanged'].includes(result.status), JSON.stringify(result)); return readJson(join(ctx.root, 'design/docs-index.json')); }
async function snapshot(root) {
  const result = {};
  async function visit(path = '') { for (const name of (await readdir(join(root, path), { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const target = path ? path + '/' + name.name : name.name;
    if (name.isDirectory()) await visit(target); else result[target] = digest(await readFile(join(root, target)));
  } }
  await visit(); return result;
}
function pageEntry(index) { return Object.entries(index.entries).find(([,entry]) => entry.baseline.type === 'page'); }
async function editDoc(ctx, path, edit) {
  const parsed = parseMarkdown(await readFile(join(ctx.root, path), 'utf8'));
  const entity = structuredClone(parsed.entity); edit(entity); await writeFile(join(ctx.root, path), renderMarkdown(entity, parsed));
}
test('public commands preview, reviewed apply, read-only validation, and byte-idempotent export/import', async t => {
  const ctx = await fixture(t), before = await snapshot(ctx.root);
  const preview = await run(ctx, ['docs', 'export', '--dry-run']); assert.equal(preview.status, 'planned'); assert.deepEqual(await snapshot(ctx.root), before);
  assert.equal((await run(ctx, ['docs', 'export', '--apply', preview.data.planHash, '--yes'])).status, 'applied');
  const baseline = await snapshot(ctx.root), info = await stat(join(ctx.root, 'design/docs-index.json'));
  for (const args of [['docs','export','--yes'], ['docs','import','--yes']]) assert.equal((await run(ctx,args)).status, 'unchanged');
  assert.deepEqual(await snapshot(ctx.root), baseline); assert.equal((await stat(join(ctx.root,'design/docs-index.json'))).mtimeMs, info.mtimeMs);
  assert.equal((await run(ctx,['docs','validate'])).status, 'ok'); assert.equal((await run(ctx,['docs','status'])).status, 'ok');
  assert.deepEqual(await snapshot(ctx.root), baseline);
});
test('single-file import updates real page and preserves prose, unknown metadata and unrelated entities', async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), [key, entry] = pageEntry(index), before = await readJson(join(ctx.root,'design/project.json'));
  let source = await readFile(join(ctx.root, entry.path), 'utf8'); source = source.replace('doc_status: draft', 'doc_status: reviewed\ncustom_owner: Alice # keep'); source += '\n## Important rationale\nAuthored information must survive.\n'; await writeFile(join(ctx.root, entry.path), source);
  await editDoc(ctx, entry.path, entity => { entity.title = 'Reviewed overview'; });
  const result = await run(ctx, ['docs','import',entry.path,'--yes']); assert.equal(result.status,'applied',JSON.stringify(result));
  const next = await readJson(join(ctx.root,'design/project.json')); assert.equal(next.design.nodes.find(node=>node.id===entry.baseline.id).label,'Reviewed overview');
  assert.equal(next.design.nodes.length, before.design.nodes.length); assert.deepEqual(next.design.sitemap.journeys,before.design.sitemap.journeys);
  assert.ok((await readFile(join(ctx.root,entry.path),'utf8')).includes('custom_owner: Alice # keep')); assert.ok((await readFile(join(ctx.root,entry.path),'utf8')).endsWith('Authored information must survive.\n'));
  assert.equal((await readJson(join(ctx.root,'design/docs-index.json'))).entries[key].baseline.title,'Reviewed overview');
  assert.equal((await readJson(join(ctx.root,'.framework/intake.json'))).files['design/project.json'],digest(await readFile(join(ctx.root,'design/project.json'))));
});
test('project edits export without stale Markdown reversing them', async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), [,entry] = pageEntry(index), project = await readJson(join(ctx.root,'design/project.json'));
  project.design.nodes.find(node=>node.id===entry.baseline.id).goal = 'Changed through the model'; await saveModel(ctx, project);
  assert.equal((await run(ctx,['docs','import',entry.path,'--yes'])).status,'applied');
  assert.equal((await readJson(join(ctx.root,'design/project.json'))).design.nodes.find(node=>node.id===entry.baseline.id).goal,'Changed through the model');
  assert.equal(parseMarkdown(await readFile(join(ctx.root,entry.path),'utf8')).entity.data.surface.goal,'Changed through the model');
});
test('conflicting field edits block every write and explicit per-field resolution unblocks import', async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), [key,entry] = pageEntry(index);
  await editDoc(ctx,entry.path,entity=>{entity.title='Markdown title';});
  const project=await readJson(join(ctx.root,'design/project.json')); project.design.nodes.find(node=>node.id===entry.baseline.id).label='Project title'; await saveModel(ctx, project);
  const before=await snapshot(ctx.root), response=await run(ctx,['docs','import','--yes']); assert.equal(response.status,'blocked',JSON.stringify(response)); assert.deepEqual(await snapshot(ctx.root),before);
  await write(join(ctx.root,'docs-resolutions.json'),JSON.stringify({[key+'#/title']:'markdown'}));
  assert.equal((await run(ctx,['docs','import','--resolutions','docs-resolutions.json','--yes'])).status,'applied');
  assert.equal((await readJson(join(ctx.root,'design/project.json'))).design.nodes.find(node=>node.id===entry.baseline.id).label,'Markdown title');
});
test('export blocks Markdown-ahead edits rather than overwriting them', async t=>{
  const ctx=await fixture(t), index=await exportDocs(ctx), [,entry]=pageEntry(index); await editDoc(ctx,entry.path,e=>{e.title='Unsaved';}); const before=await snapshot(ctx.root);
  assert.equal((await run(ctx,['docs','export','--yes'])).status,'blocked'); assert.deepEqual(await snapshot(ctx.root),before);
});
for (const change of ['source','addition','settings','project','output']) test('review hash rejects changed '+change+' inputs before writes', async t=>{
  const ctx=await fixture(t), index=await exportDocs(ctx), [,entry]=pageEntry(index);
  const request=parseCliArguments(['docs','export']), preview=await planOperation(request,ctx);
  if(change==='source') await writeFile(join(ctx.root,entry.path),(await readFile(join(ctx.root,entry.path),'utf8'))+'\nNew prose.\n');
  if(change==='addition') await write(join(ctx.root,'docs/application/new-note.md'),'# Newly discovered note\n');
  if(change==='settings'){const value=await readJson(join(ctx.root,'configs/user-settings.json'));value.documentation.linkFormat='wikilink';await writeFile(join(ctx.root,'configs/user-settings.json'),JSON.stringify(value));}
  if(change==='project'){const value=await readJson(join(ctx.root,'design/project.json'));value.notes.push('New project note');await writeFile(join(ctx.root,'design/project.json'),JSON.stringify(value));}
  if(change==='output') await writeFile(join(ctx.root,'docs/application/generated/index.md'),'A human edited the output.\n');
  const before=await snapshot(ctx.root); await assert.rejects(applyOperation(preview,ctx,preview.planHash),/stale|changed/i); assert.deepEqual(await snapshot(ctx.root),before);
});
test('file moves preserve identity and missing files never delete project elements', async t=>{
  const ctx=await fixture(t), index=await exportDocs(ctx), [key,entry]=pageEntry(index), renamed='docs/application/pages/renamed-file.md';
  await rename(join(ctx.root,entry.path),join(ctx.root,renamed)); assert.equal((await run(ctx,['docs','import','--yes'])).status,'applied');
  assert.equal((await readJson(join(ctx.root,'design/docs-index.json'))).entries[key].path,renamed);
  const before=await readFile(join(ctx.root,'design/project.json'),'utf8'); await rm(join(ctx.root,renamed));
  assert.equal((await run(ctx,['docs','export','--yes'])).status,'blocked'); assert.equal((await run(ctx,['docs','validate'])).status,'blocked'); assert.equal(await readFile(join(ctx.root,'design/project.json'),'utf8'),before);
});
test('external folder is copied into the project with assets and source bytes unchanged', async t=>{
  const seed = newDocument('Documentation Demo'); seed.design.nextId = 100; seed.design.visualDesigns.nextId = 100; addPage(seed, 'Existing home');
  const ctx=await fixture(t,seed), external=await directory(t), original=projectFixture().project;
  for(const entity of projectEntities(original).filter(e=>e.type!=='project')) await write(join(external,entity.type,entity.id+'.md'),renderMarkdown(entity));
  await write(join(external,'assets/reference.svg'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>'); await write(join(external,'readme.md'),'# Supporting notes\n');
  const before=await snapshot(external), result=await run(ctx,['docs','import',external,'--yes']); assert.equal(result.status,'applied',JSON.stringify(result));
  assert.deepEqual(await snapshot(external),before); assert.equal((await readJson(join(ctx.root,'design/project.json'))).design.nodes.length,3);
  assert.equal(await readFile(join(ctx.root,'docs/application/assets/reference.svg'),'utf8'),'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal((await run(ctx,['docs','import',external,'--yes'])).status,'unchanged');
});
test('duplicate IDs, invalid references and mixed projects leave the complete workspace unchanged', async t=>{
  const ctx=await fixture(t), index=await exportDocs(ctx), [,entry]=pageEntry(index), original=await readFile(join(ctx.root,entry.path),'utf8');
  await write(join(ctx.root,'docs/application/copy.md'),original); let before=await snapshot(ctx.root); assert.equal((await run(ctx,['docs','import','--yes'])).status,'failed'); assert.deepEqual(await snapshot(ctx.root),before); await rm(join(ctx.root,'docs/application/copy.md'));
  await writeFile(join(ctx.root,entry.path),original.replace('project: documentation-demo','project: foreign')); before=await snapshot(ctx.root); assert.equal((await run(ctx,['docs','import','--yes'])).status,'failed'); assert.deepEqual(await snapshot(ctx.root),before);
});
test('edited generated navigation is not overwritten even when its marker remains', async t=>{
  const ctx=await fixture(t);await exportDocs(ctx); const path=join(ctx.root,'docs/application/generated/index.md');await writeFile(path,(await readFile(path,'utf8'))+'\nHuman addition\n');const before=await snapshot(ctx.root);
  assert.equal((await run(ctx,['docs','export','--yes'])).status,'blocked');assert.deepEqual(await snapshot(ctx.root),before);
});
test('settings preserve unrelated preferences and reject source/test/output overlap', async t=>{
  const ctx=await fixture(t);await write(join(ctx.root,'configs/user-settings.json'),JSON.stringify({schemaVersion:1,theme:'light',documentation:{root:'specs/app',paths:{pages:'specs/screens'}}}));
  const settings=await readFile(join(ctx.root,'configs/user-settings.json'),'utf8'), index=await exportDocs(ctx);assert.ok(pageEntry(index)[1].path.startsWith('specs/screens/'));assert.equal(await readFile(join(ctx.root,'configs/user-settings.json'),'utf8'),settings);
  assert.equal((await run(ctx,['docs','export','--out','src','--yes'])).status,'failed'); assert.equal((await run(ctx,['docs','export','--out','../outside','--yes'])).status,'failed');
});
test('symlinked input and destination parents are refused', async t=>{
  const ctx=await fixture(t), external=await directory(t); await write(join(external,'doc.md'),'# External\n');
  try{await symlink(external,join(ctx.root,'linked'),'dir');}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('The runner forbids symlink creation.');return;}throw error;}
  assert.equal((await run(ctx,['docs','import','linked','--yes'])).status,'failed');await mkdir(join(ctx.root,'docs'));await symlink(external,join(ctx.root,'docs/application'),'dir');assert.equal((await run(ctx,['docs','export','--yes'])).status,'failed');
});
test('empty or missing selected folders cannot silently initialize documentation state', async t=>{
  const ctx=await fixture(t);await mkdir(join(ctx.root,'notes'));const before=await snapshot(ctx.root);
  assert.equal((await run(ctx,['docs','import','notes','--yes'])).status,'failed');assert.equal((await run(ctx,['docs','import','missing','--yes'])).status,'failed');assert.deepEqual(await snapshot(ctx.root),before);
});
test('shared writer rolls back a failed batch with the docs journal installed', async t=>{
  const root=await directory(t);await write(join(root,'docs/page.md'),'Before');const plan=await createFilePlan(root,[{path:'docs/page.md',content:'After'},{path:'design/docs-index.json',content:'new baseline'}]), journal=journalHook(plan);
  await assert.rejects(applyFilePlan(plan,{async beforeWrite(change,index){await journal();if(index===1)throw Error('Injected interruption');}}),/Injected interruption/);
  assert.equal(await readFile(join(root,'docs/page.md'),'utf8'),'Before');assert.deepEqual(Object.keys(await snapshot(root)),['docs/page.md']);
});
test('durable recovery previews and restores preimages, rejecting intervening edits', async t=>{
  const root=await directory(t), lock=join(root,'.codex-authoring.lock'), before='Before',after='After';await mkdir(lock);await write(join(root,'docs/page.md'),after);await write(join(lock,'before-0'),before);
  const journal={schemaVersion:1,kind:'application-docs-recovery',pid:2147483647,changes:[{path:'docs/page.md',beforeHash:digest(before),afterHash:digest(after),status:'update',index:0}]};await write(join(lock,'docs-journal.json'),JSON.stringify(journal));
  const preview=await recoverDocuments(root,false);assert.equal(preview.status,'planned');assert.equal(await readFile(join(root,'docs/page.md'),'utf8'),after);
  await writeFile(join(root,'docs/page.md'),'Human edit');await assert.rejects(recoverDocuments(root,true,preview.data.recoveryHash),/DOCS_RECOVERY_CONFLICT/);assert.equal(await readFile(join(root,'docs/page.md'),'utf8'),'Human edit');
  await writeFile(join(root,'docs/page.md'),after);const current=await recoverDocuments(root,false);assert.equal((await recoverDocuments(root,true,current.data.recoveryHash)).status,'applied');assert.equal(await readFile(join(root,'docs/page.md'),'utf8'),before);
});
test('live writer recovery is refused and unrelated locks are not removed', async t=>{
  const root=await directory(t);await write(join(root,'.codex-authoring.lock/docs-journal.json'),JSON.stringify({schemaVersion:1,kind:'application-docs-recovery',pid:process.pid,changes:[]}));await assert.rejects(recoverDocuments(root,true,'anything'),/DOCS_RECOVERY_ACTIVE/);
  await rm(join(root,'.codex-authoring.lock/docs-journal.json'));await assert.rejects(recoverDocuments(root,false),/DOCS_RECOVERY_MISSING/);assert.ok((await readdir(root)).includes('.codex-authoring.lock'));
});
test('an interaction can move to another existing source while retaining its stable ID', async t=>{
  const fixtureData=projectFixture();const [destination]=attachComponents(fixtureData.project,fixtureData.details,[{kind:'existing',id:fixtureData.component}]);const ctx=await fixture(t,fixtureData.project), index=await exportDocs(ctx);
  const entry=Object.values(index.entries).find(e=>e.baseline.type==='interaction');await editDoc(ctx,entry.path,e=>{e.fields.owner_id=fixtureData.details;e.fields.source_node_id=destination;});
  assert.equal((await run(ctx,['docs','import',entry.path,'--yes'])).status,'applied');const project=await readJson(join(ctx.root,'design/project.json')), events=projectEntities(project).filter(e=>e.type==='interaction');assert.equal(events.length,1);assert.equal(events[0].id,fixtureData.interaction);assert.equal(events[0].fields.source_node_id,destination);
});
test('machine schema discovery succeeds outside a configured project without prompting', async t=>{
  const root=await directory(t);await write(join(root,'shell.config.json'),'broken');const response=spawnSync(process.execPath,[join(frameworkRoot,'bin/app'),'docs','schema','--json','--no-interaction'],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(response.status,0,response.stderr);const result=JSON.parse(response.stdout);assert.equal(result.command,'docs schema');assert.ok(result.data.types.includes('journey'));assert.equal(response.stdout.trim().split('\n').length,1);
});

test('interactive setup reviews docs import before generation and offers independent docs export', async () => {
  const { continueSetup } = await import('../../src/cli/presentation/terminal/setup-terminal.ts');
  const { result } = await import('../../src/cli/adapters/framework/contracts.ts');
  const answers=['no','yes','docs/application','yes','no','yes','yes'], calls=[];
  const execute=async request=>{calls.push(request);return request.options.apply ? result(request.command,{},'applied') : result(request.command,{planHash:'a'.repeat(64)},'planned');};
  const outcome=await continueSetup({root:'/',frameworkRoot:'/'},execute,async()=>answers.shift(),()=>{},result('setup',{},'applied'));
  assert.equal(outcome.status,'applied');assert.deepEqual(calls.map(request=>request.command),['docs import','docs import','docs export','docs export']);
  assert.deepEqual(calls[0].args,['docs/application']);assert.equal(calls[1].options.apply,'a'.repeat(64));assert.equal(answers.length,0);
});
test('declining reviewed docs changes cancels setup rather than applying or generating', async()=>{
  const { continueSetup }=await import('../../src/cli/presentation/terminal/setup-terminal.ts');const { result }=await import('../../src/cli/adapters/framework/contracts.ts');
  const answers=['no','yes','','no'], calls=[];
  const outcome=await continueSetup({root:'/',frameworkRoot:'/'},async request=>{calls.push(request.command);return result(request.command,{planHash:'b'.repeat(64)},'planned');},async()=>answers.shift(),()=>{},result('setup',{},'applied'));
  assert.equal(outcome.status,'cancelled');assert.deepEqual(calls,['docs import']);
});

for (const boundary of [0, 1, 3]) test(`terminated writer recovers at destination boundary ${boundary} with the index last`, async t => {
  const root = await directory(t);
  await write(join(root, 'docs/page.md'), 'Before page');
  await write(join(root, 'design/project.json'), '{"before":true}\n');
  await write(join(root, 'design/docs-index.json'), '{"baseline":"before"}\n');
  const original = await snapshot(root);
  const entries = [{path:'docs/page.md',content:'After page'}, {path:'docs/added.md',content:'New document'},
    {path:'design/project.json',content:'{"after":true}\n'}, {path:'design/docs-index.json',content:'{"baseline":"after"}\n'}];
  const writer = new URL('../../scripts/shared/file-plan.ts', import.meta.url).href;
  const journal = new URL('../../src/cli/documentation/adapters/recovery.ts', import.meta.url).href;
  const code = `import {createFilePlan,applyFilePlan} from ${JSON.stringify(writer)}; import {journalHook} from ${JSON.stringify(journal)};
    const plan=await createFilePlan(${JSON.stringify(root)},${JSON.stringify(entries)}), record=journalHook(plan);
    await applyFilePlan(plan,{async beforeWrite(change,index){await record();if(index===${boundary})process.kill(process.pid,'SIGKILL');}});`;
  const child = spawnSync(process.execPath, ['--experimental-strip-types','--input-type=module','--eval',code], {encoding:'utf8',timeout:30000});
  assert.ifError(child.error); assert.notEqual(child.status, 0, 'The worker must terminate before completing the batch.');
  assert.ok((await readdir(join(root,'.codex-authoring.lock'))).includes('docs-journal.json'));
  assert.equal(await readFile(join(root,'design/docs-index.json'),'utf8'), '{"baseline":"before"}\n');
  const preview = await recoverDocuments(root,false);
  assert.equal((await recoverDocuments(root,true,preview.data.recoveryHash)).status,'applied');
  assert.deepEqual(await snapshot(root), original);
});

test('merged command discovery retains documentation, handout and prototype handlers without duplicates', async t => {
  const ctx = await fixture(t), response = await run(ctx, ['capabilities']);
  assert.equal(response.status, 'ok');
  const ids = response.data.commands.map(command => command.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const name of ['docs import', 'docs export', 'docs validate', 'docs status', 'docs schema', 'docs recover',
    'handout generate', 'handout refresh', 'handout validate', 'handout inspect',
    'prototypes list', 'prototypes create', 'prototypes activate', 'prototypes adopt', 'prototypes generate']) {
    assert.ok(ids.includes(name), `Missing merged command: ${name}`);
    const help = await run(ctx, ['help', ...name.split(' ')]);
    assert.equal(help.status, 'ok', JSON.stringify(help));
    assert.equal(help.data.commands[0].id, name);
    assert.ok(help.data.commands[0].examples.length, `Missing executable help example: ${name}`);
  }
  assert.equal((await run(ctx, ['docs', 'schema'])).status, 'ok');
});

test('Markdown intake preserves the active prototype and requires explicit variant promotion before generation', { timeout: 180000 }, async t => {
  if (await reviewedExamplesRemoved(frameworkRoot)) { t.skip('In-place generation requires the framework kit and its reviewed example sources.'); return; }
  // In-place generation runs inside an extracted, verified kit.
  const ctx = await fixture(t, undefined, true), selected = ['exploration', '--version', 'v1', '--variant', 'main'];
  async function apply(args) {
    const result = await run(ctx, [...args, '--yes']);
    assert.ok(['applied', 'unchanged'].includes(result.status), JSON.stringify(result));
    return result;
  }
  await apply(['prototypes', 'create', 'exploration']);
  await apply(['prototypes', 'status', ...selected, '--status', 'approved']);
  await apply(['prototypes', 'activate', ...selected]);
  const saved = await snapshot(join(ctx.root, 'docs/concepts'));
  const index = await exportDocs(ctx), [, entry] = pageEntry(index);
  await editDoc(ctx, entry.path, entity => { entity.title = 'Markdown variant'; });
  await apply(['docs', 'import', entry.path]);
  assert.deepEqual(await snapshot(join(ctx.root, 'docs/concepts')), saved);
  const blocked = await run(ctx, ['generate', '--dry-run']);
  assert.equal(blocked.status, 'failed', JSON.stringify(blocked));
  assert.equal(blocked.diagnostics[0].code, 'PROTOTYPE_IMPORT_REQUIRED');
  // The pinned variant is never compiled over the Markdown-edited canonical design either.
  const pinned = await run(ctx, ['prototypes', 'generate', '--dry-run']);
  assert.equal(pinned.status, 'failed', JSON.stringify(pinned));
  assert.equal(pinned.diagnostics[0].code, 'PROTOTYPE_IMPORT_REQUIRED');
  assert.deepEqual(await snapshot(join(ctx.root, 'docs/concepts')), saved);
  await apply(['prototypes', 'fork', ...selected, '--as', 'markdown-edit']);
  const next = ['exploration', '--version', 'v1', '--variant', 'markdown-edit'];
  await apply(['prototypes', 'save', ...next]);
  await apply(['prototypes', 'status', ...next, '--status', 'approved']);
  await apply(['prototypes', 'activate', ...next]);
  const generation = await run(ctx, ['generate', '--dry-run']);
  assert.equal(generation.status, 'planned', JSON.stringify(generation));
  assert.equal(generation.data.summary.prototypeSelection.variantId, 'markdown-edit');
  const project = await readJson(join(ctx.root, 'design/project.json'));
  assert.equal(project.design.nodes.find(node => node.id === entry.baseline.id).label, 'Markdown variant');
});
