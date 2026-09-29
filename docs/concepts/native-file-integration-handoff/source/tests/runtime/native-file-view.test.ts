// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian',()=>import('@test/obsidian'));
import { TextFileView } from 'obsidian';
import { hostInstance } from '../support/obsidian';
import { nativeFixture,openNative,textArea,edit,button,deferred } from '../support/native-fixture';
const cleanups: Array<()=>Promise<void>>=[];
async function fixture(){const f=await nativeFixture();cleanups.push(()=>f.kit.unloadPlugin(f.plugin));return f;}
afterEach(async()=>{for(const clean of cleanups.splice(0))await clean();vi.restoreAllMocks();document.body.replaceChildren();});
describe('TextFileView adapter against explicit host protocol double',()=>{
  it('has constructor-safe identity, opens raw bytes and never writes on opening or clean close',async()=>{
    const {kit}=await fixture();const modify=vi.spyOn(kit.vault,'modify');const leaf=await openNative(kit),root=leaf.view.containerEl;
    expect(leaf.getIcon()).toBe('file-code');expect(leaf.getDisplayText()).toBe('a');expect(textArea(root).value).toBe('{ "title": "Original" }\n');
    expect(button(root,'Save').disabled).toBe(true);await leaf.view.closeView();expect(modify).not.toHaveBeenCalled();
  });
  it('writes exact valid text only on explicit save and refreshes the status',async()=>{
    const {kit}=await fixture();const modify=vi.spyOn(kit.vault,'modify');const leaf=await openNative(kit),root=leaf.view.containerEl;
    edit(root,'{ "title" : "Updated" }\r\n');expect(modify).not.toHaveBeenCalled();expect(button(root,'Save').disabled).toBe(false);button(root,'Save').click();
    await vi.waitFor(()=>expect(root.textContent).toContain('No unsaved changes.'));expect(kit.read('a.shellnote')).toBe('{ "title" : "Updated" }\r\n');expect(modify).toHaveBeenCalledOnce();
  });
  it('does not save invalid edits on click or close; the original is recoverable',async()=>{
    const {kit}=await fixture();const modify=vi.spyOn(kit.vault,'modify');const leaf=await openNative(kit),root=leaf.view.containerEl;
    edit(root,'{broken');expect(textArea(root).getAttribute('aria-invalid')).toBe('true');expect(button(root,'Save').disabled).toBe(true);button(root,'Save').click();
    await leaf.view.closeView();expect(modify).not.toHaveBeenCalled();expect(kit.read('a.shellnote')).toBe('{ "title": "Original" }\n');
  });
  it('does not repair or rewrite initially malformed JSON merely by opening it',async()=>{
    const {kit}=await fixture();await kit.vault.modify(kit.file('a.shellnote'),'{damaged');const modify=vi.spyOn(kit.vault,'modify');const leaf=await openNative(kit);
    expect(textArea(leaf.view.containerEl).value).toBe('{damaged');await leaf.view.closeView();expect(modify).not.toHaveBeenCalled();
  });
  it('keeps two different files and two independent view drafts separate',async()=>{
    const {kit}=await fixture();const a=await openNative(kit),b=await openNative(kit,'b.shellnote');edit(a.view.containerEl,'{"a":1}');
    expect(textArea(b.view.containerEl).value).toBe('{}');edit(b.view.containerEl,'{"b":2}');button(b.view.containerEl,'Save').click();
    await vi.waitFor(()=>expect(kit.read('b.shellnote')).toBe('{"b":2}'));expect(kit.read('a.shellnote')).toBe('{ "title": "Original" }\n');
  });
  it('incoming updates retain a conflicting draft and block saves until discard',async()=>{
    const {kit}=await fixture();const leaf=await openNative(kit),root=leaf.view.containerEl;edit(root,'{"mine":1}');
    await kit.vault.modify(kit.file('a.shellnote'),'{"incoming":1}');const view=hostInstance(leaf.view,TextFileView);view.data='{"incoming":1}';view.setViewData(view.data,false);
    expect(textArea(root).value).toBe('{"mine":1}');expect(button(root,'Save').disabled).toBe(true);expect(root.textContent).toContain('outside');
    button(root,'Discard draft / load incoming').click();expect(textArea(root).value).toBe('{"incoming":1}');expect(button(root,'Save').disabled).toBe(true);
  });
  it('failed saves display sanitized recovery instructions and are not retried by host close',async()=>{
    const {kit,reports}=await fixture();const leaf=await openNative(kit),root=leaf.view.containerEl;
    const modify=vi.spyOn(kit.vault,'modify').mockRejectedValue(new Error('/private/vault/secret'));edit(root,'{"mine":1}');button(root,'Save').click();
    await vi.waitFor(()=>expect(root.textContent).toContain('reopen'));expect(root.textContent).not.toContain('secret');expect(reports).toEqual([['native.save-failed','file.save']]);
    button(root,'Discard draft / load incoming').click();await leaf.view.closeView();expect(modify).toHaveBeenCalledOnce();
  });
  it('duplicate save clicks cannot issue concurrent writes',async()=>{
    const {kit}=await fixture();const leaf=await openNative(kit),root=leaf.view.containerEl,pending=deferred<void>();const modify=vi.spyOn(kit.vault,'modify').mockReturnValue(pending.promise);
    edit(root,'{"mine":1}');button(root,'Save').click();button(root,'Save').click();expect(textArea(root).readOnly).toBe(true);expect(modify).toHaveBeenCalledOnce();
    pending.resolve();await vi.waitFor(()=>expect(textArea(root).readOnly).toBe(false));
  });
  it('revokes save capability on disposal and does not detach the workspace leaf',async()=>{
    const {kit,stop}=await fixture();const leaf=await openNative(kit),root=leaf.view.containerEl;const modify=vi.spyOn(kit.vault,'modify');edit(root,'{"mine":1}');stop();button(root,'Save').click();await kit.flush();
    expect(modify).not.toHaveBeenCalled();expect(kit.workspace.leaves).toContain(leaf);
  });
  it('a late completion from an earlier file cannot mark the next file draft as saved',async()=>{
    const {kit}=await fixture();const leaf=await openNative(kit),root=leaf.view.containerEl,pending=deferred<void>();vi.spyOn(kit.vault,'modify').mockReturnValue(pending.promise);
    edit(root,'{"mine":1}');button(root,'Save').click();const view=hostInstance(leaf.view,TextFileView);view.setViewData('{}',true);edit(root,'{"other":2}');pending.resolve();
    await kit.flush();expect(textArea(root).value).toBe('{"other":2}');expect(kit.read('a.shellnote')).toBe('{ "title": "Original" }\n');
  });
});
