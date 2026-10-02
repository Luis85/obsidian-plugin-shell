// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian',()=>import('@test/obsidian'));
import { Menu, TFolder, Modal } from 'obsidian';
import { nativeFixture,nativeType,nativeAction,openNative,deferred } from '../support/native-fixture';
import { registerNativeIntegrations } from '../../src/infrastructure/obsidian/native-integrations';
import { NATIVE_TEXT_LIMIT } from '../../src/domain/native-file';
const cleanups: Array<()=>Promise<void>>=[];
async function fixture(...args:Parameters<typeof nativeFixture>){const f=await nativeFixture(...args);cleanups.push(()=>f.kit.unloadPlugin(f.plugin));return f;}
afterEach(async()=>{for(const clean of cleanups.splice(0))await clean();vi.restoreAllMocks();document.body.replaceChildren();});
describe('native file registration and menu lifecycle',()=>{
  it('registers an extension and creates a dedicated per-file view',async()=>{
    const {kit}=await fixture();expect(kit.app.viewRegistry.typeByExtension.get('shellnote')).toBe('native-fixture-file-document');
    await kit.runCommand('new-native-document');await vi.waitFor(()=>expect(kit.workspace.getLeavesOfType('native-fixture-file-document')).toHaveLength(1));
    expect(kit.read('New-document.shellnote')).toBe('{}\n');expect(kit.workspace.activeLeaf?.view.getState()).toMatchObject({file:'New-document.shellnote'});
  });
  it('opens a registered extension through ordinary workspace file opening',async()=>{
    const {kit}=await fixture();const leaf=kit.workspace.getLeaf('tab');await leaf.openFile(kit.file('a.shellnote'));
    expect(leaf.view.getViewType()).toBe('native-fixture-file-document');expect(leaf.view.getState()).toMatchObject({file:'a.shellnote'});
    expect(leaf.view.containerEl.querySelector('textarea')?.value).toBe(kit.read('a.shellnote'));
  });
  it('never overwrites an existing creation target',async()=>{
    const {kit}=await fixture();await kit.vault.create('New-document.shellnote','{"keep":1}');await kit.runCommand('new-native-document');
    await vi.waitFor(()=>expect(kit.read('New-document-2.shellnote')).toBe('{}\n'));expect(kit.read('New-document.shellnote')).toBe('{"keep":1}');
  });
  it('creates only once on duplicate clicks and suppresses late opening after unload',async()=>{
    const {kit,stop}=await fixture(),pending=deferred<ReturnType<typeof kit.file>>();const create=vi.spyOn(kit.vault,'create').mockReturnValue(pending.promise);
    await kit.runCommand('new-native-document');await kit.runCommand('new-native-document');expect(create).toHaveBeenCalledOnce();stop();pending.resolve(kit.file('a.shellnote'));await kit.flush();expect(kit.workspace.leaves).toHaveLength(0);
  });
  it('reports a failed create once without retrying or leaking exception details',async()=>{
    const {kit,reports}=await fixture();const create=vi.spyOn(kit.vault,'create').mockRejectedValue(new Error('/secret/path'));await kit.runCommand('new-native-document');
    await vi.waitFor(()=>expect(reports).toEqual([['native.create-failed','native.integration']]));expect(create).toHaveBeenCalledOnce();expect(kit.notices[0]?.message).not.toContain('secret');
  });
  it('distinguishes successful creation followed by failed opening',async()=>{
    const {kit,reports}=await fixture();vi.spyOn(kit.workspace,'getLeaf').mockImplementation(()=>{throw new Error('open');});await kit.runCommand('new-native-document');
    await vi.waitFor(()=>expect(reports).toEqual([['native.open-failed','native.integration']]));expect(kit.read('New-document.shellnote')).toBe('{}\n');expect(kit.notices[0]?.message).toContain('was created');
  });
  it('filters menu entries by actual file type and never exposes them on folders',async()=>{
    const {kit}=await fixture();expect(kit.openFileMenu(kit.file('a.shellnote')).items.map(i=>i.title)).toEqual(['Open in Custom document']);
    expect(kit.openFileMenu(kit.file('note.md')).items.map(i=>i.title)).toEqual(['Inspect file']);expect(kit.openFileMenu(kit.file('Other.pdf')).items).toHaveLength(0);
    const folder=kit.vault.getAbstractFileByPath('folder');expect(folder).toBeInstanceOf(TFolder);expect(kit.openFileMenu(folder!).items).toHaveLength(0);
  });
  it('opens an existing custom file through its context action, without writes',async()=>{
    const {kit}=await fixture();const modify=vi.spyOn(kit.vault,'modify');await kit.openFileMenu(kit.file('a.shellnote')).items[0]!.click();
    await vi.waitFor(()=>expect(kit.workspace.getLeavesOfType('native-fixture-file-document')).toHaveLength(1));expect(modify).not.toHaveBeenCalled();
  });
  it('command availability checks perform no I/O, and executing reads the active file',async()=>{
    const {kit}=await fixture();const read=vi.spyOn(kit.vault,'read'),command=kit.commands().find(c=>c.id.endsWith(':native-action-summary'))!;
    expect(command.checkCallback?.(true)).toBe(false);kit.workspace.setActiveFile(kit.file('note.md'));expect(command.checkCallback?.(true)).toBe(true);expect(read).not.toHaveBeenCalled();
    await kit.runCommand('native-action-summary');await vi.waitFor(()=>expect(kit.modals).toHaveLength(1));expect(kit.modals[0]?.contentEl.textContent).toContain('5 characters');expect(read).toHaveBeenCalledOnce();
  });
  it('uses a fresh read, handles uppercase extension and renders result text, not HTML',async()=>{
    const {kit}=await fixture([], [{...nativeAction,async run(context){return {title:'<h1>Not HTML</h1>',message:await context.read()};}}]);
    const file=await kit.vault.create('UPPER.MD','<img src=x onerror=boom>');const menu=kit.openFileMenu(file);expect(menu.items).toHaveLength(1);
    await kit.vault.modify(file,'<script>updated</script>');await menu.items[0]!.click();await vi.waitFor(()=>expect(kit.modals).toHaveLength(1));
    expect(kit.modals[0]?.contentEl.textContent).toBe('<script>updated</script>');expect(kit.modals[0]?.containerEl.querySelector('script')).toBeNull();
  });
  it.each(['rename','delete','unload'] as const)('suppresses stale success after %s during an asynchronous read',async operation=>{
    const {kit,stop}=await fixture(),pending=deferred<string>();vi.spyOn(kit.vault,'read').mockReturnValue(pending.promise);await kit.openFileMenu(kit.file('note.md')).items[0]!.click();
    if(operation==='rename')await kit.vault.rename(kit.file('note.md'),'renamed.md');if(operation==='delete')await kit.vault.delete(kit.file('note.md'));if(operation==='unload')stop();
    pending.resolve('late private bytes');await kit.flush();expect(kit.modals).toHaveLength(0);
  });
  it('rejects stat-oversized files before reading and byte-oversized text after reading',async()=>{
    const {kit,reports}=await fixture();const read=vi.spyOn(kit.vault,'read');kit.file('note.md').stat.size=NATIVE_TEXT_LIMIT+1;await kit.openFileMenu(kit.file('note.md')).items[0]!.click();
    await vi.waitFor(()=>expect(reports).toHaveLength(1));expect(read).not.toHaveBeenCalled();kit.file('note.md').stat.size=0;read.mockResolvedValue('é'.repeat(NATIVE_TEXT_LIMIT/2+1));
    await kit.openFileMenu(kit.file('note.md')).items[0]!.click();await vi.waitFor(()=>expect(reports).toHaveLength(2));expect(kit.modals).toHaveLength(0);
  });
  it('rejects malformed or unbounded handler results rather than showing success',async()=>{
    const {kit,reports}=await fixture([], [{...nativeAction,async run(){return {title:'x'.repeat(201),message:'no'};}}]);await kit.openFileMenu(kit.file('note.md')).items[0]!.click();
    await vi.waitFor(()=>expect(reports).toHaveLength(1));expect(kit.modals).toHaveLength(0);
  });
  it('does not retry duplicate in-flight action invocations',async()=>{
    const {kit}=await fixture(),pending=deferred<string>(),read=vi.spyOn(kit.vault,'read').mockReturnValue(pending.promise),menu=kit.openFileMenu(kit.file('note.md'));
    await menu.items[0]!.click();await menu.items[0]!.click();expect(read).toHaveBeenCalledOnce();pending.resolve('ok');await vi.waitFor(()=>expect(kit.modals).toHaveLength(1));
  });
  it('removes registrations and owned modals on unload without detaching leaves',async()=>{
    const {kit,plugin,stop}=await fixture();const leaf=await openNative(kit);await kit.openFileMenu(kit.file('note.md')).items[0]!.click();await vi.waitFor(()=>expect(kit.modals).toHaveLength(1));
    await kit.unloadPlugin(plugin);stop();expect(kit.commands()).toHaveLength(0);expect(kit.modals).toHaveLength(0);expect(kit.app.viewRegistry.typeByExtension.has('shellnote')).toBe(false);
    expect(kit.openFileMenu(kit.file('note.md')).items).toHaveLength(0);expect(kit.workspace.leaves).toContain(leaf);
  });
  it('a conflicting extension registration disables creation and matching menu action',async()=>{
    const {kit,plugin}=await fixture([],[]);const reports=vi.fn();vi.spyOn(plugin,'registerExtensions').mockImplementation(()=>{throw new Error('other plugin');});
    registerNativeIntegrations(plugin,[nativeType],[],reports);expect(kit.commands()).toHaveLength(0);expect(kit.openFileMenu(kit.file('a.shellnote')).items).toHaveLength(0);expect(reports).toHaveBeenCalledWith('native.registration-failed','native.integration');
  });
  it('rejects duplicate identity, invalid defaults and partial startup failure',async()=>{
    const {plugin}=await fixture([],[]);expect(()=>registerNativeIntegrations(plugin,[nativeType,nativeType],[],vi.fn())).toThrow('DUPLICATE');
    expect(()=>registerNativeIntegrations(plugin,[{...nativeType,defaultContent:'{'}],[],vi.fn())).toThrow('DEFAULT');
    vi.spyOn(plugin,'addCommand').mockImplementation(()=>{throw new Error('command fail');});expect(()=>registerNativeIntegrations(plugin,[],[nativeAction],vi.fn())).toThrow('command fail');
  });
  it('a throwing modal close cannot prevent the remaining scope from being revoked',async()=>{
    const {kit,stop,reports}=await fixture();await kit.openFileMenu(kit.file('note.md')).items[0]!.click();await vi.waitFor(()=>expect(kit.modals).toHaveLength(1));
    const close=vi.spyOn(Modal.prototype,'close').mockImplementation(()=>{throw new Error('close failed');});expect(()=>stop()).not.toThrow();expect(reports).toEqual([['native.cleanup-failed','native.integration']]);close.mockRestore();
    const menu=new Menu();kit.workspace.trigger('file-menu',menu,kit.file('note.md'),'file-explorer');expect(kit.notices).toHaveLength(0);
  });
});
