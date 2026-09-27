import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url)),template=await loadTemplateSnapshot(root);
const source=await readFile(join(root,'docs/concepts/companion/starters/quick-capture.companion.json'),'utf8');
test('browser output shares generated product code and packages an explicit offline build entry',async()=>{
  const plugin=await compileProject({source,template});const browser=await compileProject({source,template,outputKind:'clickdummy'});
  assert.equal(browser.status,'ok',JSON.stringify(browser.diagnostics));
  for(const file of plugin.artifacts.filter(file=>file.path.startsWith('src/generated/')))assert.equal(browser.artifacts.find(item=>item.path===file.path)?.content,file.content,file.path);
  const entry=browser.artifacts.find(file=>file.path==='harness/prototype/main.ts').content;
  const parsed=ts.transpileModule(entry,{fileName:'main.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  assert.ok(!parsed.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));
  assert.ok(!entry.includes("from 'obsidian'"));assert.match(entry,/preview never writes business data/);
  assert.equal(browser.readiness.bundle,'not-run');assert.notEqual(browser.fingerprint,plugin.fingerprint);
  const pkg=JSON.parse(browser.artifacts.find(file=>file.path==='package.json').content);assert.equal(pkg.scripts['build:clickdummy'],'node scripts/compiler/build-clickdummy.mjs');
});
test('origin maps retain normalized entity IDs and actual generated Vue line locations',async()=>{
  const compiled=await compileProject({source,sourceName:'quick.json',template});
  const origins=JSON.parse(compiled.artifacts.find(file=>file.path==='design/compiler-origins.json').content);
  const mapped=origins.artifacts.filter(file=>file.lines.length);
  assert.ok(mapped.length);for(const file of mapped){const artifact=compiled.artifacts.find(a=>a.path===file.path);for(const entry of file.lines){assert.ok(artifact.content.split('\n')[entry.line-1].includes('data-design-node'));assert.equal(entry.source.document,'normalized');assert.equal(entry.source.file,'quick.json');}}
});
test('pure rendering never schedules a runtime provider, timer or network call',async()=>{
  const fetch=globalThis.fetch,timer=globalThis.setTimeout;
  globalThis.fetch=()=>{throw new Error('unexpected network');};globalThis.setTimeout=()=>{throw new Error('unexpected timer');};
  try{const result=await compileProject({source,template});assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));}
  finally{globalThis.fetch=fetch;globalThis.setTimeout=timer;}
});
