import { describe, it, expect, vi } from 'vitest';
import { NativeFileDraft } from '../../src/application/native-file-draft';
import { nativeTextIssue, NATIVE_TEXT_LIMIT, type NativeFileType } from '../../src/domain/native-file';
import { inspectNativeFile } from '../../src/application/inspect-native-file';
const json: NativeFileType = {id:'record',name:'Record',extension:'record',icon:'file',format:'json',defaultContent:'{}'};
const text: NativeFileType = {...json,format:'text'};
describe('custom file validation without mutation',()=>{
  it.each(['{}','[1,true,null]','null','{ "é": "😀" }\r\n'])('accepts JSON syntax and preserves exact bytes: %s',raw=>{
    expect(nativeTextIssue(raw,json)).toBeNull();const draft=new NativeFileDraft(json);draft.load(raw,true);expect(draft.content).toBe(raw);expect(draft.dirty).toBe(false);
  });
  it.each(['','{','undefined','{"a":1,}'])('rejects invalid JSON: %s',raw=>{expect(nativeTextIssue(raw,json)).toMatch(/valid JSON/);});
  it('allows plain text, but never NUL or oversized UTF-8',()=>{
    expect(nativeTextIssue('',text)).toBeNull();expect(nativeTextIssue('not JSON',text)).toBeNull();
    expect(nativeTextIssue('a\0b',text)).toMatch(/Binary/);
    expect(nativeTextIssue('a'.repeat(NATIVE_TEXT_LIMIT),text)).toBeNull();
    expect(nativeTextIssue('a'.repeat(NATIVE_TEXT_LIMIT+1),text)).toMatch(/2 MB/);
    expect(nativeTextIssue('é'.repeat(NATIVE_TEXT_LIMIT/2+1),text)).toMatch(/2 MB/);
  });
  it('calls the optional domain validator only after format validation and redacts its errors',()=>{
    const validate=vi.fn(()=> 'Title is required.');const type={...json,validate};
    expect(nativeTextIssue('{',type)).toMatch(/valid JSON/);expect(validate).not.toHaveBeenCalled();
    expect(nativeTextIssue('{}',type)).toBe('Title is required.');expect(validate).toHaveBeenCalledExactlyOnceWith('{}');
    expect(nativeTextIssue('{}',{...json,validate(){throw new Error('private content');}})).toBe('Document validation failed. The original file is preserved.');
  });
});
describe('per-view explicit-save state',()=>{
  it('invalid drafts never change accepted bytes and can be discarded',()=>{
    const draft=new NativeFileDraft(json);draft.load(' {"a":1}\n',true);draft.edit('{');expect(draft.dirty).toBe(true);expect(draft.accept()).toBe(false);
    expect(draft.content).toBe(' {"a":1}\n');draft.discard();expect(draft.dirty).toBe(false);expect(draft.draft).toBe(draft.content);
  });
  it('reports persistence only after a successful save, not acceptance',()=>{
    const draft=new NativeFileDraft(json);draft.load('{}',true);draft.edit('{"a":1}');expect(draft.accept()).toBe(true);expect(draft.dirty).toBe(true);
    draft.saved('stale');expect(draft.dirty).toBe(true);draft.saved(draft.content);expect(draft.dirty).toBe(false);
  });
  it('a clean external reload changes both buffers without formatting',()=>{
    const draft=new NativeFileDraft(json);draft.load('{}',true);draft.load('{ "incoming": true }\r\n');expect(draft.draft).toBe('{ "incoming": true }\r\n');expect(draft.blocked).toBe(false);
  });
  it('blocks conflicting incoming bytes while retaining the user draft',()=>{
    const draft=new NativeFileDraft(json);draft.load('{}',true);draft.edit('{"mine":1}');draft.load('{}');expect(draft.blocked).toBe(false);expect(draft.draft).toBe('{"mine":1}');
    draft.load('{"incoming":1}');expect(draft.blocked).toBe(true);expect(draft.issue).toMatch(/outside/);expect(draft.accept()).toBe(false);expect(draft.draft).toBe('{"mine":1}');expect(draft.content).toBe('{"incoming":1}');
    draft.discard();expect(draft.blocked).toBe(false);expect(draft.dirty).toBe(false);expect(draft.draft).toBe('{"incoming":1}');
  });
  it('uncertain writes cannot be silently retried or authorized by discard',()=>{
    const draft=new NativeFileDraft(json);draft.load('{}',true);draft.edit('{"mine":1}');draft.accept();draft.failed();draft.discard();expect(draft.blocked).toBe(true);expect(draft.accept()).toBe(false);expect(draft.issue).toMatch(/reopen/);
    draft.load('{"verified":1}',true);expect(draft.blocked).toBe(false);expect(draft.dirty).toBe(false);
  });
  it('switching files explicitly resets conflicts and never leaks a draft into another view',()=>{
    const first=new NativeFileDraft(json),second=new NativeFileDraft(json);first.load('{}',true);second.load('null',true);first.edit('{"mine":1}');first.load('{"external":2}');
    expect(second.draft).toBe('null');first.load('[]',true);expect(first.dirty).toBe(false);expect(first.blocked).toBe(false);expect(first.draft).toBe('[]');
  });
});
describe('read-only file summary application handler',()=>{
  it.each([['',0,0,0],['hello',1,5,5],['é😀',1,2,6],['a\r\nb\rc\n',4,7,7]])('counts %j correctly',async(content,lines,characters,bytes)=>{
    const read=vi.fn(async()=>String(content));const result=await inspectNativeFile({name:'a.txt',extension:'txt',read});
    expect(result).toEqual({title:'File summary',message:`${lines} lines · ${characters} characters · ${bytes} UTF-8 bytes`});expect(read).toHaveBeenCalledOnce();
  });
  it('propagates read failures rather than returning fake success',async()=>{await expect(inspectNativeFile({name:'a',extension:'txt',async read(){throw new Error('read failed');}})).rejects.toThrow('read failed');});
});
