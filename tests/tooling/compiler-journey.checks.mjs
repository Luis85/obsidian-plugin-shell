import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { posix, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { compileProject, loadTemplateSnapshot } from '../../src/cli/compiler/index.ts';
import { planProject, applyProject } from '../../src/cli/compiler/adapters/project-plan.ts';
import { starterDocument } from '../support/starter-documents.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const template=await loadTemplateSnapshot(root);
const seed=starterDocument('quick-capture');
function definition(custom=false){
  const d=structuredClone(seed);
  if(custom)d.settings={codebaseFolder:'application/source',testsFolder:'checks'};
  d.design.editors={schema:1,bindings:[{surface:d.design.nodes.find(n=>n.kind==='page').id,editor:'journey-lens'}]};return d;
}
async function compile(d=definition()){
  const result=await compileProject({source:JSON.stringify(d),template});assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));
  return {result,files:new Map(result.artifacts.map(file=>[file.path,file]))};
}
for(const custom of [false,true])test('closed binding emits the actual editor with contained imports; custom roots='+custom,async()=>{
  const {result,files}=await compile(definition(custom)),sourceRoot=result.model.sourceRoot;
  const paths=[...files.keys()].filter(path=>path.startsWith(sourceRoot+'/presentation/journey/')||path.startsWith(sourceRoot+'/bootstrap/journey-'));
  assert.ok(paths.length>15);assert.ok(files.has(sourceRoot+'/presentation/journey/components/SitemapGraph.vue'));
  assert.match(files.get(sourceRoot+'/bootstrap/journey-mount.ts').content,/app\.provide\(flowKey,flow\)/);
  assert.doesNotMatch(files.get(sourceRoot+'/bootstrap/journey-mount.ts').content,/import ['"].*ui\.css/);
  for(const path of paths){
    const content=files.get(path).content;
    if(path.endsWith('.ts')&&!path.endsWith('.d.ts'))assert.doesNotThrow(()=>stripTypeScriptTypes(content,{mode:'strip'}),path+' parses; this is not a typecheck');
    for(const match of content.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
      const target=posix.normalize(posix.join(posix.dirname(path),match[1]));assert.ok(!target.startsWith('../')&&files.has(target),path+' -> '+target);
    }
  }
  const binding=definition(custom).design.editors.bindings[0];
  const screen=result.model.screens.find(s=>s.id===binding.surface);
  const actual=[...files].filter(([path,file])=>path.includes('/screens/')&&file.content.includes('JourneyWorkspace'));
  assert.equal(actual.length,1);assert.ok(actual[0][1].content.includes(JSON.stringify(screen.label)));
  assert.ok(files.has('design/journey-lens.json'));assert.ok(files.has('JOURNEY-LENS.md'));
  const nativeTest=files.get('tests/obsidian/journey-lens.obsidian.ts').content;
  assert.doesNotThrow(()=>stripTypeScriptTypes(nativeTest,{mode:'strip'}));
  assert.match(nativeTest,/Another view or an external edit changed this project/);
  assert.match(nativeTest,/\.first\(\)\.locator\('\.jl-workspace'\)/);
  for (const path of ['harness/prototype/clickdummy.ts', sourceRoot+'/bootstrap/mount.ts']) {
    assert.match(files.get(path).content, /import ui from '@nuxt\/ui\/vue-plugin'/);
    assert.match(files.get(path).content, /app\.use\(ui\)/);
  }
  assert.match(nativeTest,/obsidian\.reloadPlugin/);assert.match(nativeTest,/independent drafts/);
  assert.match(files.get('harness/prototype/clickdummy.ts').content,/createJourneyPreview/);
  const scenario=files.get('harness/prototype/clickdummy-scenarios.ts').content;
  assert.ok(!scenario.includes('\"surface\":'+JSON.stringify(binding.surface)), 'static page scenarios do not impersonate editor datasets');
});
test('generated browser transitive runtime has no native or Node imports',async()=>{
  const {result,files}=await compile();
  // Ask Node's parser for actual imports, not snippets inside generator template strings.
  // This parses source only; the child's graph never evaluates any supplied module.
  const script=`import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {posix} from 'node:path';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {files,entry}=JSON.parse(input),seen=new Set();
function visit(path){if(seen.has(path))return;seen.add(path);if(!(path in files))throw Error('Missing '+path);
let source=files[path];if(path.endsWith('.vue'))source=source.match(/<script[^>]*>([\\s\\S]*?)<\\/script>/)?.[1]??'';
if(path.endsWith('.css'))return;if(path.endsWith('.ts')||path.endsWith('.vue'))source=stripTypeScriptTypes(source,{mode:'strip'});
const module=new vm.SourceTextModule(source);
for(const name of module.dependencySpecifiers){if(name==='obsidian'||name.startsWith('node:'))throw Error(path+' imports '+name);
if(name.startsWith('.'))visit(posix.normalize(posix.join(posix.dirname(path),name)));}}
entry.forEach(visit);console.log(JSON.stringify([...seen]));`;
  const input=JSON.stringify({files:Object.fromEntries([...files].filter(([path])=>/\.(?:[cm]?js|ts|vue|css)$/.test(path)).map(([path,file])=>[path,file.content])),
    entry:[result.model.sourceRoot+'/bootstrap/journey-preview.ts',result.model.sourceRoot+'/bootstrap/journey-workspace.ts']});
  const check=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{input,encoding:'utf8',timeout:30000,maxBuffer:2_000_000});
  assert.equal(check.status,0,check.stderr);const visited=JSON.parse(check.stdout);
  assert.ok(visited.includes('scripts/companion/journey/project-store.ts'));assert.ok(!visited.some(p=>p.endsWith('journey-vault.ts')));
});
test('binding remains opt-in and unsupported code-like bindings fail before emission',async()=>{
  const plain=await compile(structuredClone(seed));assert.equal(plain.files.has('design/journey-lens.json'),false);
  const invalid=definition();invalid.design.editors.bindings[0].editor='https://example.invalid/editor.js';
  const result=await compileProject({source:JSON.stringify(invalid),template});assert.notEqual(result.status,'ok');
  assert.equal(result.artifacts.length,0);
});
test('generated native owner is shared, registered for disposal and receives actual Vault events',async()=>{
  const {result,files}=await compile(),r=result.model.sourceRoot;
  assert.match(files.get(r+'/bootstrap/initialize.ts')?.content??[...files.values()].find(f=>f.content.includes('function initializeProject'))?.content??'',/journey\.dispose\(\)/);
  assert.match(files.get(r+'/bootstrap/journey-native.ts').content,/vault\.offref/);
  assert.match(files.get(r+'/bootstrap/mount.ts').content,/provideJourney\(app,pinia,journey\)/);
  assert.match(files.get(r+'/presentation/stores/navigation.ts').content,/this\.leaveGuard/);
});
test('real generation replay retains developer-edited editor code and canonical binding',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'journey-regeneration-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const {realpath}=await import('node:fs/promises');const vault=await realpath(dir),input=join(vault,'input.json');
  const d=definition();await writeFile(input,JSON.stringify(d));
  const options={input,vault,target:'plugin',templateRoot:root};const first=await planProject(options);await applyProject(first,first.hash);
  const path=join(vault,'plugin',d.settings.codebaseFolder,'generated/presentation/journey/workspace/use-workspace.ts');
  const previous=await readFile(path,'utf8'),edited=previous+'\n// Consumer-owned reviewed extension.\n';await writeFile(path,edited);
  const replay=await planProject(options);await applyProject(replay,replay.hash);
  assert.equal(await readFile(path,'utf8'),edited);
  assert.deepEqual(JSON.parse(await readFile(join(vault,'plugin/design/project.json'),'utf8')).design.editors,d.design.editors);
});

test('merged tooling and scoped generation preserve the bound editor without mutating the input', async () => {
  const d=definition(), source=JSON.stringify(d);
  const result=await compileProject({source,template,storybook:{enabled:false,generateStories:true}});
  assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));
  const files=new Map(result.artifacts.map(file=>[file.path,file]));
  assert.ok(files.has('design/journey-lens.json'));assert.ok(files.has('design/storybook.json'));
  assert.equal(files.has('storybook/package.json'),false);
  assert.deepEqual(JSON.parse(files.get('design/project.json').content).tooling.storybook,{enabled:false,generateStories:true});
  assert.equal(JSON.stringify(d),source);
  const {generationSelection}=await import('../../src/cli/compiler/adapters/selection.ts');
  const selected=generationSelection(result.model,result.artifacts,'page:'+d.design.editors.bindings[0].surface);
  assert.ok(selected.sharedPaths.includes(result.model.sourceRoot+'/bootstrap/journey-workspace.ts'));
  assert.ok(selected.selectedPaths.some(path=>path.includes('/screens/')));
  const {parseCliArguments}=await import('../../src/cli/adapters/framework/catalog.ts');
  const request=parseCliArguments(['generate','--scope','page:'+d.design.editors.bindings[0].surface,'--storybook','off','--storybook-stories','on']);
  assert.equal(request.options.scope,'page:'+d.design.editors.bindings[0].surface);
  assert.equal(request.options.storybook,'off');assert.equal(request.options['storybook-stories'],'on');
});

test('emitted persistence acceptance executes with the real document and session revision owners', async () => {
  const {result,files}=await compile();
  const source=files.get(result.model.testRoot+'/journey-generated.test.ts').content;
  // Execute the emitted case, not a copy of its persistence sequence. This tiny assertion
  // adapter is explicit; the independently installed generated project still runs Vitest.
  const script=`import vm from 'node:vm';import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';import {join} from 'node:path';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {root,source,seed}=JSON.parse(input),cases=[];
const dependencies={vitest:{it:(name,run)=>cases.push({name,run}),expect:value=>({toBe:expected=>assert.equal(value,expected),toEqual:expected=>assert.deepEqual(value,expected)})},
 'project-store.ts':await import(pathToFileURL(join(root,'scripts/companion/journey/project-store.ts')).href),
 'session.ts':await import(pathToFileURL(join(root,'scripts/companion/sitemap/session.ts')).href),'journey-seed.ts':{seed}};
const module=new vm.SourceTextModule(stripTypeScriptTypes(source,{mode:'strip'}));
await module.link(async name=>{const dependency=dependencies[name]??dependencies[name.split('/').at(-1)];assert.ok(dependency,name);
 return new vm.SyntheticModule(Object.keys(dependency),function(){for(const [key,value] of Object.entries(dependency))this.setExport(key,value);});});
await module.evaluate();assert.equal(cases.length,1);
for(const item of cases)await item.run();console.log(JSON.stringify({executed:cases.map(item=>item.name)}));`;
  const child=spawnSync(process.execPath,['--experimental-strip-types','--experimental-vm-modules','--input-type=module','-e',script],{
    input:JSON.stringify({root,source,seed:JSON.stringify(result.model.document)}),encoding:'utf8',timeout:30000,maxBuffer:2_000_000,
  });
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(JSON.parse(child.stdout).executed,['saves the complete generated project and reopens an independent editor session']);
});

test('native qualification declares the same explicit short scratch root that its driver reads',async()=>{
  const workflow=await readFile(join(root,'.github/workflows/companion-concept-verification.yml'),'utf8');
  const native=workflow.slice(workflow.indexOf('  journey-native:'),workflow.indexOf('  jev-typescript6:'));
  assert.match(native,/COMPANION_QUALIFICATION_ROOT: \/tmp/);assert.doesNotMatch(native,/RUNNER_TEMP: \/tmp/);
  assert.match(native,/set -o pipefail/);assert.match(native,/install --with-deps chromium/);
  const driver=await readFile(join(root,'scripts/companion-tools/qualify-project.mjs'),'utf8');
  assert.match(driver,/process\.env\.COMPANION_QUALIFICATION_ROOT \?\? process\.env\.RUNNER_TEMP \?\? tmpdir\(\)/);
});
