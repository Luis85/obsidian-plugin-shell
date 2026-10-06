namespace Jev {
  export class BrowserLibrary implements LibraryPort {
    persistent=true; warning='';
    private readonly key='jev-studio.library.v1';
    read(): Library | undefined {
      try { const raw=localStorage.getItem(this.key); return raw?readLibrary(parseJson(raw)):undefined; }
      catch { this.persistent=false; this.warning='Browser storage is unavailable or contains an incompatible library. Original data is preserved. This session is memory-only; export JSON to keep your work.'; return undefined; }
    }
    write(value: Library): void {
      if (!this.persistent) return;
      try { localStorage.setItem(this.key,JSON.stringify(value)); }
      catch { throw new Error('Browser storage is full or blocked. Changes are still in the editor; export JSON before closing.'); }
    }
  }
  export function downloadJson(name: string, value: unknown): void { downloadText(name,JSON.stringify(value,null,2)+'\n','application/json'); }
  export function downloadText(name: string, content: string, type='text/plain'): void {
    const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'}));
    const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  export async function readMarkdownFiles(files: File[], current: VaultState): Promise<VaultState> {
    if (!files.length) throw new Error('No files were selected.');
    if (files.length>1500) throw new Error('Choose a smaller folder (at most 1,500 files inspected).');
    const eligible=files.filter(f=>f.name.toLowerCase().endsWith('.md'));
    if (!eligible.length) throw new Error('No Markdown files found. Select .md files or a folder containing them.');
    if (eligible.length>250) throw new Error('Import at most 250 Markdown notes at a time in this prototype.');
    if (eligible.reduce((n,f)=>n+f.size,0)>5_000_000) throw new Error('Selected Markdown exceeds 5 MB. Choose a smaller scope.');
    const notes: Note[]=[], excluded: string[]=[], seen=new Set<string>();
    for (const file of eligible) {
      const relative=file.webkitRelativePath;
      const path=normalizePath(relative?relative.split('/').slice(1).join('/'):file.name);
      if (excludedPath(path) || file.size>256_000) {excluded.push(path+(file.size>256_000?' (over 256 KB)':''));continue;}
      if (seen.has(path)) {excluded.push(path+' (duplicate path)');continue;} seen.add(path);
      const text=await file.text();
      if (text.includes('\u0000')) {excluded.push(path+' (not text)');continue;}
      const note=parseNote(path,text,file.lastModified,false);
      if (privateNote(note)) excluded.push(path+' (private/no-ai)'); else notes.push(note);
    }
    if (!notes.length) throw new Error('No eligible notes remain after privacy and size exclusions.');
    notes.sort((a,b)=>a.path.localeCompare(b.path));
    const root=files.find(f=>f.webkitRelativePath)?.webkitRelativePath.split('/')[0] || 'Selected notes';
    return {name:root,notes,activePath:notes.some(n=>n.path===current.activePath)?current.activePath:notes[0].path,references:[],selection:'',synthetic:false,importedAt:new Date().toISOString(),excluded};
  }
  export function slug(text: string): string { return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'jev-prompt'; }
}
