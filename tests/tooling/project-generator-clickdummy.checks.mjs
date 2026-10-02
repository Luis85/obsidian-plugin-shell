import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { projectFiles } from '../../scripts/compiler/adapters/project-files.ts';
import { clickdummyCode } from '../../scripts/companion/compiler/clickdummy-code.ts';
import { matches } from '../../scripts/companion/runtime/contract.ts';
const root = fileURLToPath(new URL('../../',import.meta.url));
const document = JSON.parse(await readFile(new URL('../../docs/concepts/companion/companion-project.json',import.meta.url),'utf8'));
const model = projectModel(document);
function emitted(m=model) { const files=new Map(); clickdummyCode(m,(path,content,ownership)=>files.set(path,{content,ownership})); return files; }
test('clickdummy emits a browser composition using the same generated panels, services and visual context', () => {
  const files = emitted(), entry = files.get('harness/prototype/clickdummy.ts').content;
  assert.match(entry,/bootstrap\/panels.ts/); assert.match(entry,/bootstrap\/visual-context.ts/);
  assert.match(entry,/provideVisualContext\(app, \{ \.\.\.createVisualContext/);
  assert.match(entry,/disposePinia/); assert.match(entry,/createDialogHost/);
  assert.match(files.get('harness/prototype/clickdummy-host.ts').content,/dialog.showModal\(\)/);
  assert.match(entry,/surface=/); assert.match(entry,/exportProject/);
  assert.doesNotMatch(entry, /from ['"](?:node:|obsidian['"])/);
  assert.doesNotMatch(entry,/createServices|nativeAdapters|fetch\(/);
  for (const [path,file] of files) if(path.endsWith('.ts')) {
    const source = ts.createSourceFile(path,file.content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    assert.deepEqual(source.parseDiagnostics,[],path);
  }
});
test('generated source reads return detached schema-valid fixtures and writes fail, never fake success', async t => {
  const dir = await mkdtemp(join(tmpdir(),'clickdummy-services-')); t.after(()=>rm(dir,{recursive:true,force:true}));
  // Include one writable operation to prove the browser never imports or calls a native writer.
  const m = structuredClone(model), source=m.sources[0], operation=source.operations[0];
  source.operations.push({...structuredClone(operation), id:'write-fixture',slug:'write-fixture',direction:'write'});
  const {dataCode}=await import('../../scripts/companion/compiler/data-code.ts');
  const files=emitted(m); dataCode(m,(path,content)=>files.set(path,{content}));
  files.set(`${m.sourceRoot}/domain/contract.ts`,{content:await readFile(join(root,'scripts/companion/runtime/contract.ts'),'utf8')});
  for (const [path,file] of files) if(path.endsWith('.ts') && /(?:application\/|domain\/contract|clickdummy-sources)/.test(path)) {
    await mkdir(dirname(join(dir,path)),{recursive:true}); await writeFile(join(dir,path),file.content);
  }
  await writeFile(join(dir,'package.json'),' {"type":"module"} ');
  const {createClickdummySources} = await import(pathToFileURL(join(dir,m.sourceRoot,'bootstrap/clickdummy-sources.ts')));
  const services=createClickdummySources();
  const first=await services[source.slug][operation.slug](undefined), second=await services[source.slug][operation.slug](operation.input===null?undefined:first);
  assert.equal(matches(first,operation.output),true); assert.deepEqual(first,second);
  if(first && typeof first==='object') assert.notEqual(first,second);
  await assert.rejects(services[source.slug]['write-fixture'](undefined),/NOT_IMPLEMENTED/);
});
test('custom source folders produce contained valid relative imports and escaped project identity', () => {
  const custom={...model,sourceRoot:'application/source/generated',project:{...model.project,name:'</script> project'}};
  const entry=emitted(custom).get('harness/prototype/clickdummy.ts').content;
  assert.match(entry,/application\/source\/generated\/bootstrap\/panels/); assert.doesNotMatch(entry,/<\/script>/);
});
test('full generator includes the public command, fixed browser entry and native-state forwarding', async () => {
  const files=new Map((await projectFiles(root,model)).map(f=>[f.path,f]));
  assert.equal(JSON.parse(files.get('package.json').content).scripts['build:clickdummy'],'node bin/app clickdummy build');
  assert.ok(files.has('harness/prototype/clickdummy.ts'));
  assert.match(files.get(`${model.sourceRoot}/presentation/components/ProjectWorkbench.vue`).content,/design-state/);
  const page=[...files].find(([path])=>path.includes('/screens/')&&files.get(path).content.includes('import Detail'));
  assert.ok(page); assert.match(page[1].content,/:design-state="props.designState"/);
});
test('full v6 route declarations compile with stable IDs and parameter paths intact', async t => {
  const { migrateAuthoringDocument } = await import('../../scripts/companion/authoring-contract.ts');
  const v6 = migrateAuthoringDocument(document).document;
  const owner = v6.design.nodes.find(node => node.kind === 'page');
  v6.design.sitemap = { schema: 1, routes: [{ id: 'route-regression', surface: owner.id, path: '/record/:recordId' }], journeys: [] };
  const source = emitted(projectModel(v6)).get('harness/prototype/clickdummy.ts').content;
  const ast = ts.createSourceFile('entry.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements.find(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(item => item.name.getText(ast) === 'routes'));
  assert.ok(declaration); assert.match(declaration.getText(ast), /route-regression/);
  const dir = await mkdtemp(join(tmpdir(), 'clickdummy-route-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'routes.ts'); await writeFile(file, declaration.getText(ast));
  const program = ts.createProgram([file], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, types: [] });
  assert.deepEqual(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});
test('preview selects have explicit labels independent of their option text', () => {
  const component = emitted().get(`${model.sourceRoot}/presentation/components/ClickdummyPreview.vue`).content;
  for (const [id, label] of [['clickdummy-surface', 'Browse surfaces'], ['clickdummy-state', 'Preview state']]) {
    assert.ok(component.includes(`<label for="${id}">${label}</label>`));
    assert.ok(component.includes(`<select id="${id}"`));
  }
  assert.doesNotMatch(component, /<label>[^<]*<select/);
});

test('preview owns bfcache restoration, readiness and reset focus without discarding browser history', () => {
  const files=emitted(), entry=files.get('harness/prototype/clickdummy.ts').content;
  assert.match(entry,/createPreviewLifecycle/); assert.match(entry,/lifecycle.reset\(\)/);
  assert.match(entry,/history.replaceState/); assert.doesNotMatch(entry,/location.hash = ''/);
  assert.match(entry,/finally \{ disposePinia/);
  assert.match(entry,/delete document.documentElement.dataset.prototypeReady/);
  assert.match(entry,/getElementById\('clickdummy-reset'\)\?\.focus/);
  const component=files.get(`${model.sourceRoot}/presentation/components/ClickdummyPreview.vue`).content;
  assert.match(component,/<h1>\{\{ model.name \}\}<\/h1>/);
  const css=files.get('harness/prototype/clickdummy.css').content;
  assert.match(css,/:focus-visible/); assert.match(css,/@media \(max-width:480px\)/);
});
