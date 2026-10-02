import { Plugin, App } from 'obsidian';
import { createTestApp, hostInstance, type TestApp } from './obsidian';
import { registerNativeIntegrations } from '../../src/infrastructure/obsidian/native-integrations';
import { inspectNativeFile } from '../../src/application/inspect-native-file';
import type { NativeFileType, NativeFileAction } from '../../src/domain/native-file';
export const nativeType: NativeFileType = {id:'document',name:'Custom document',extension:'shellnote',format:'json',defaultContent:'{}\n',icon:'file-code'};
export const nativeAction: NativeFileAction = {id:'summary',name:'Inspect file',extensions:['md','txt'],icon:'file-search',run:inspectNativeFile};
export async function nativeFixture(types: readonly NativeFileType[] = [nativeType], actions: readonly NativeFileAction[] = [nativeAction]) {
  const kit = createTestApp({files:{'a.shellnote':'{ "title": "Original" }\n','b.shellnote':'{}','note.md':'hello','note.txt':'é😀','Other.pdf':'binary','folder/note.md':'nested'}});
  class FixturePlugin extends Plugin { async onload(): Promise<void> {} }
  const plugin = new FixturePlugin(hostInstance(kit.app,App),{id:'native-fixture',name:'Native fixture',version:'0.1.0',minAppVersion:'1.8.0',author:'Fixture',description:'Native host protocol tests',isDesktopOnly:false});
  const reports: string[][] = [];
  await kit.loadPlugin(plugin);
  const stop = registerNativeIntegrations(plugin,types,actions,(code,operation)=>reports.push([code,operation]));
  return {kit,plugin,stop,reports};
}
export async function openNative(kit: TestApp,path = 'a.shellnote') {
  const leaf = kit.workspace.getLeaf('tab');
  await leaf.setViewState({type:'native-fixture-file-document',state:{file:path},active:true});
  return leaf;
}
export function textArea(root: HTMLElement): HTMLTextAreaElement {
  const value = root.querySelector('textarea'); if (!value) throw new Error('Expected native file textarea'); return value;
}
export function button(root: HTMLElement,label: string): HTMLButtonElement {
  const value = Array.from(root.querySelectorAll('button')).find(b=>b.textContent===label); if (!value) throw new Error('Expected native action '+label); return value;
}
export function edit(root: HTMLElement,value: string): void { const area=textArea(root);area.value=value;area.dispatchEvent(new Event('input',{bubbles:true})); }
export function deferred<T>() { let resolve!: (value:T)=>void;let reject!: (reason:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; }
