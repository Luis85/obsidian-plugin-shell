import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { formatDiagnostics, createRecorder, writeReports } from '../../scripts/compiler/adapters/reporting.ts';
import { diagnostic } from '../../scripts/compiler/domain/diagnostics.ts';
import { operationSchemas } from '../../scripts/framework/schemas.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=await readFile(join(root,'docs/concepts/companion/starters/blank.companion.json'),'utf8');
const context={root,frameworkRoot:root,inputText:source};
const request=(command,options={})=>({command,args:[],options:{input:'-',...options}});

test('check is a read-only compiler call, not an alias for generation or build',async()=>{
  const result=await executeOperation(request('compiler check'),context);
  assert.equal(result.status,'ok');assert.equal(result.data.readiness.generation,'not-run');assert.equal(result.data.artifacts,0);
  assert.equal(result.data.readiness.bundle,'not-run');assert.equal(result.data.ir,undefined);
});
test('IR inspection is explicit and typed compiler errors survive the framework envelope',async()=>{
  const inspected=await executeOperation(request('compiler inspect'),context);assert.equal(inspected.data.ir.project.id,JSON.parse(source).project.id);
  const result=await executeOperation(request('compiler check'),{...context,inputText:'{'});
  assert.equal(result.status,'failed');assert.equal(result.diagnostics[0].code,'COMPILER_JSON_INVALID');assert.equal(result.diagnostics[0].source.file,'stdin.json');
  assert.ok(operationSchemas().result.properties.diagnostics.items.properties.source);
});
test('explain and argument validation are machine discoverable',async()=>{
  const explained=await executeOperation({command:'compiler explain',args:['COMPILER_JSON_INVALID'],options:{}},context);
  assert.equal(explained.status,'ok');assert.match(explained.data.help,/UTF-8/);
  for(const options of [{stage:'missing'},{'output-kind':'bad'},{debug:true}]){
    assert.equal((await executeOperation(request('compiler inspect',options),context)).status,'failed');
  }
});
test('JSON stdout contains one parseable document; human output names the location and remedy',()=>{
  const base=[join(root,'app.mjs'),'compiler','check','--input','-'];
  const machine=spawnSync(process.execPath,[...base,'--json'],{cwd:root,input:'{',encoding:'utf8'});
  assert.equal(machine.status,1);assert.equal(JSON.parse(machine.stdout).diagnostics[0].code,'COMPILER_JSON_INVALID');
  const human=spawnSync(process.execPath,base,{cwd:root,input:'{',encoding:'utf8'});assert.match(human.stderr,/stdin.json/);assert.match(human.stderr,/UTF-8/);
});
test('terminal renderer neutralizes authored control codes',()=>{
  const value=diagnostic('COMPILER_SCHEMA_INVALID','validate','bad\u001b[2Jtitle',{file:'p.json',jsonPointer:'/design'});
  assert.ok(!formatDiagnostics([value]).includes('\u001b'));
});
test('reporting is opt-in, contained, unique and excludes raw input and debug causes by default',async()=>{
  const folder=await realpath(await mkdtemp(join(tmpdir(),'compiler-report-')));
  try{
    const scoped={...context,root:folder};
    assert.equal((await executeOperation(request('compiler check'),scoped)).status,'ok');assert.deepEqual(await readdir(folder),[]);
    const first=await executeOperation(request('compiler check',{'report-dir':'reports/compiler'}),scoped);
    assert.equal(first.status,'ok');const report=first.data.report;assert.ok(report.startsWith('reports/compiler/'));
    assert.deepEqual((await readdir(join(folder,report))).sort(),['diagnostics.json','events.ndjson','summary.json']);
    const summary=JSON.parse(await readFile(join(folder,report,'summary.json'),'utf8'));assert.equal(summary.readiness.tests,'not-run');assert.equal(summary.model,undefined);
    const again=await executeOperation(request('compiler check',{'report-dir':'reports/compiler'}),scoped);assert.notEqual(again.data.report,report);
    const bad=await executeOperation(request('compiler check',{'report-dir':'src'}),scoped);assert.equal(bad.status,'failed');assert.equal(bad.diagnostics[0].code,'COMPILER_REPORT_FAILED');
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('debug recorder preserves bounded cause chains only when requested',()=>{
  const error=new Error('outer',{cause:new Error('inner')});
  const normal=createRecorder();normal.onFailure(error,'emit');assert.deepEqual(normal.debugReport().failures,[]);
  const debug=createRecorder(true);debug.onFailure(error,'emit');assert.equal(debug.debugReport().failures.length,2);
});
