import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateNativeIntegrations,validateNativeExtension } from '../../scripts/companion/native-contract.mjs';
import { nativeFiles } from '../../scripts/companion/compiler/native-files.ts';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { nativeFileSource,nativeActionSource,nativeSymbol } from '../../scripts/companion/native-code.mjs';
const folder=fileURLToPath(new URL('../../docs/concepts/companion/starters/',import.meta.url));
const fileProject=JSON.parse(await readFile(folder+'custom-file-editor.companion.json','utf8'));
const menuProject=JSON.parse(await readFile(folder+'file-context-menu.companion.json','utf8'));
const native=fileProject.design.nativeIntegrations;
function outputs(document){const entries=[];nativeFiles(projectModel(document),(path,content,ownership='extension')=>entries.push({path,content,ownership}));return entries;}
test('native contract is optional, bounded and round-trips in ordinary schema v5 JSON',()=>{
 assert.deepEqual(validateNativeIntegrations(undefined),{fileTypes:[],contextMenus:[]});
 assert.equal(validateCompanionDocument(fileProject),fileProject);assert.equal(validateCompanionDocument(menuProject),menuProject);
 const copy=JSON.parse(JSON.stringify(fileProject));assert.deepEqual(validateCompanionDocument(copy).design.nativeIntegrations,native);
});
for(const ext of ['md','markdown','canvas','base','pdf','png','mp3','mp4'])test('refuses built-in ownership of .'+ext,()=>{assert.throws(()=>validateNativeExtension(ext,true),/built-in/);assert.equal(validateNativeExtension(ext),ext);});
for(const ext of ['.mine','../mine','Mine','',123,'a'.repeat(25),'a-b','a\n'])test('rejects invalid extension '+JSON.stringify(ext),()=>{assert.throws(()=>validateNativeExtension(ext),/NATIVE_INVALID/);});
for(const [name,mutate] of [
 ['unknown integration field',n=>n.run='code'],['unknown file property',n=>n.fileTypes[0].script='code'],['missing property',n=>delete n.fileTypes[0].icon],
 ['unknown format',n=>n.fileTypes[0].format='binary'],['invalid initial JSON',n=>n.fileTypes[0].defaultContent='{'],['NUL',n=>n.fileTypes[0].defaultContent='\0'],
 ['large initial UTF8',n=>n.fileTypes[0].defaultContent=JSON.stringify('é'.repeat(40000))],['duplicate suffix',n=>n.fileTypes.push({...n.fileTypes[0],id:'another'})],
 ['duplicate cross-kind ID',n=>n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],id:'document'})],
 ['duplicate symbols',n=>{n.fileTypes[0].id='a1';n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],id:'a-1'});}],
 ['unsafe ID',n=>n.fileTypes[0].id='../other'],['Windows device ID',n=>n.fileTypes[0].id='com1'],['multiline label',n=>n.fileTypes[0].name='a\nb'],
 ['executable menu property',n=>n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],run:'evil'})],
 ['wildcard filter',n=>n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],extensions:['*']})],
 ['empty filter',n=>n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],extensions:[]})],
 ['duplicate filter',n=>n.contextMenus.push({...menuProject.design.nativeIntegrations.contextMenus[0],extensions:['md','md']})],
 ['too many types',n=>n.fileTypes=Array.from({length:17},(_,i)=>({...n.fileTypes[0],id:'f'+i,extension:'f'+i}))],
])test('rejects '+name+' before compilation',()=>{const n=structuredClone(native);mutate(n);assert.throws(()=>validateNativeIntegrations(n),/NATIVE_INVALID/);const d=structuredClone(fileProject);d.design.nativeIntegrations=n;assert.throws(()=>projectModel(d),/NATIVE_INVALID/);});
test('emits real descriptors, tests and a managed native registry, not placeholder source adapters',()=>{
 for(const d of [fileProject,menuProject]){const entries=outputs(d);const registry=entries.find(e=>e.path==='src/generated/bootstrap/native-bindings.ts');assert.equal(registry.ownership,'managed');
  assert.ok(entries.some(e=>e.path.endsWith('.test.ts')&&e.ownership==='extension'));assert.ok(entries.some(e=>e.path==='NATIVE-INTEGRATIONS.md'));
  const code=entries.map(e=>e.content).join('\n');assert.doesNotMatch(code,/NotImplementedError/);assert.match(code,/generatedNativeFileTypes/);assert.match(code,/generatedNativeFileActions/);
 }
 assert.match(outputs(menuProject).find(e=>e.path.endsWith('file-actions/file-summary.ts')).content,/inspectNativeFile/);
});
test('native generated roots and relative imports follow the project configuration',()=>{
 const d=structuredClone(fileProject);d.settings.codebaseFolder='app/code';d.settings.testsFolder='quality/tests';
 const entries=outputs(d),descriptor=entries.find(e=>e.path==='app/code/generated/domain/file-types/document.ts');
 assert.ok(descriptor);assert.match(descriptor.content,/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/src\/domain\/native-file.ts/);
 assert.ok(entries.some(e=>e.path==='quality/tests/project/native/file-type-document.test.ts'));assert.ok(entries.some(e=>e.path==='app/code/generated/bootstrap/native-bindings.ts'));
});
test('no native specs still produce empty managed bindings for a compiling generated host',()=>{
 const d=structuredClone(fileProject);delete d.design.nativeIntegrations;const entries=outputs(d);assert.equal(entries.length,2);
 assert.match(entries[0].content,/generatedNativeFileTypes = \[\]/);assert.match(entries[0].content,/generatedNativeFileActions = \[\]/);
});
test('source literals cannot close a script or inject TypeScript',()=>{
 const spec={...native.fileTypes[0],name:'"; throw new Error("injection"); //',defaultContent:JSON.stringify('</script>\u2028')};
 assert.doesNotMatch(nativeFileSource(spec,'./contract'),/<\/script>/);assert.match(nativeFileSource(spec,'./contract'),/\\u003c/);
 assert.equal(nativeSymbol('custom-document'),'nativeCustomDocument');
 assert.match(nativeActionSource(menuProject.design.nativeIntegrations.contextMenus[0],'./contract','./handler'),/run: inspectNativeFile/);
});
