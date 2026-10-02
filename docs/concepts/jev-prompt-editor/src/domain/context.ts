namespace Jev {
  export function normalizePath(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.some(p => p === '..' || p === '.')) throw new Error('Unsafe relative note path.');
    return parts.join('/');
  }
  export function excludedPath(path: string, folders: string[] = []): boolean {
    const p = normalizePath(path).toLowerCase();
    if (p.split('/').some(s => s.startsWith('.') || ['private','secrets'].includes(s))) return true;
    return folders.some(f => { const prefix = f.trim().replace(/^\/+|\/+$/g,'').toLowerCase(); return !!prefix && (p === prefix || p.startsWith(prefix+'/')); });
  }
  function scalar(raw: string): string | boolean | number | string[] {
    const v = raw.trim();
    if (v === 'true' || v === 'false') return v === 'true';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.startsWith('[') && v.endsWith(']')) return v.slice(1,-1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean);
    return v.replace(/^['"]|['"]$/g,'');
  }
  /** Deliberately limited YAML subset for the offline reader; native uses MetadataCache. */
  export function parseNote(path: string, text: string, modifiedAt = 0, synthetic = false): Note {
    const properties: Note['properties'] = {}; let body = text.replace(/^\uFEFF/,'');
    const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (fm) {
      let listKey = '';
      for (const line of fm[1].split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
        if (match && !['constructor','prototype'].includes(match[1])) {
          listKey = match[1]; properties[listKey] = match[2] ? scalar(match[2]) : [];
        } else if (/^\s+-\s+/.test(line) && Array.isArray(properties[listKey])) {
          (properties[listKey] as string[]).push(line.replace(/^\s+-\s+/,'').trim().replace(/^['"]|['"]$/g,''));
        }
      }
      body = body.slice(fm[0].length);
    }
    const declared = properties.tags; const tags = Array.isArray(declared) ? declared : typeof declared === 'string' ? declared.split(/[,\s]+/) : [];
    const inlineTags = [...body.matchAll(/(?:^|\s)#([\p{L}\d_/-]+)/gu)].map(m => m[1]);
    return {
      path: normalizePath(path), name: path.split('/').pop()?.replace(/\.md$/i,'') || path, body, properties,
      tags: [...new Set([...tags, ...inlineTags])], links: [...new Set([...body.matchAll(/(?<!!)\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)].map(m => m[1].trim()))],
      headings: [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1]),
      tasks: [...body.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)].map(m => ({text:m[2],done:m[1].toLowerCase()==='x'})),
      modifiedAt, synthetic
    };
  }
  export function privateNote(note: Note): boolean {
    return note.properties.private === true || note.properties.ai === false || note.tags.some(t => ['private','no-ai'].includes(t.toLowerCase()));
  }
  export function resolveLink(link: string, notes: Note[]): Note | undefined {
    const target = link.replace(/\.md$/i,'').toLowerCase();
    const exact = notes.filter(n => n.path.replace(/\.md$/i,'').toLowerCase() === target);
    if (exact.length === 1) return exact[0];
    const named = notes.filter(n => n.name.toLowerCase() === target);
    return named.length === 1 ? named[0] : undefined;
  }
  export function compileSnapshot(recipe: Recipe, vault: VaultState): Snapshot {
    const b = recipe.bindings, warnings: string[] = [], included: string[] = [];
    const active = vault.notes.find(n => n.path === vault.activePath);
    const allowed = (note: Note) => !privateNote(note) && !excludedPath(note.path,b.excludedFolders);
    const select = (note: Note): Record<string, unknown> => {
      included.push(note.path);
      const out: Record<string, unknown> = {path:note.path,title:note.name};
      if (b.body) { out.content = note.body.slice(0,b.maxChars); if (note.body.length > b.maxChars) warnings.push(note.path+': body clipped at '+b.maxChars+' characters.'); }
      if (b.frontmatter) out.frontmatter = Object.fromEntries(b.fields.filter(k => Object.prototype.hasOwnProperty.call(note.properties,k)).map(k=>[k,note.properties[k]]));
      if (b.tasks) out.tasks = note.tasks.slice(0,100).map(t=>({text:t.text.slice(0,500),done:t.done}));
      if (b.headings) out.headings = note.headings.slice(0,60).map(h=>h.slice(0,200));
      if (b.tasks && note.tasks.length > 100) warnings.push(note.path+': only the first 100 tasks are included.');
      if (b.headings && note.headings.length > 60) warnings.push(note.path+': only the first 60 headings are included.');
      return out;
    };
    const state: Record<string, unknown> = {};
    if (!active || !allowed(active)) warnings.push('Select an allowed active note before exporting a request.');
    else state.active_note = select(active);
    const referencePaths = new Set(vault.references);
    if (active && b.linkedNotes) for (const link of active.links) {
      const note = resolveLink(link,vault.notes);
      if (note) referencePaths.add(note.path); else warnings.push('Unresolved or ambiguous link skipped: '+link);
    }
    const candidates = [...referencePaths].filter(p=>p!==active?.path).map(p=>vault.notes.find(n=>n.path===p)).filter((n): n is Note=>!!n);
    const refs = candidates.filter(n => { if (!allowed(n)) {warnings.push('Excluded reference: '+n.path); return false;} return true; });
    if (refs.length > b.maxReferences) warnings.push('Only the first '+b.maxReferences+' reference notes are included.');
    state.references = refs.slice(0,b.maxReferences).map(select);
    if (b.selection) { state.editor_selection = vault.selection.slice(0,b.maxChars); if (!vault.selection.trim()) warnings.push('The selection binding is enabled, but no text is selected.'); }
    const serialized = JSON.stringify(state);
    if (/(?:sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(serialized)) warnings.push('Possible secret detected. Remove it from the selected context before external use. This is not a complete secret scanner.');
    if (!b.body && !b.frontmatter && !b.tasks && !b.headings && !b.selection) warnings.push('Only note paths and titles are included. Check that your questions have enough evidence.');
    return {state,warnings,included,characters:serialized.length,fingerprint:fingerprint(state)};
  }
  export function compileRequest(recipe: Recipe, snapshot: Snapshot): RequestBody {
    const errors = validateRecipe(recipe); if (errors.length) throw new Error(errors[0].message);
    if (!snapshot.state.active_note) throw new Error('An allowed active note is required.');
    const questions: RequestBody['questions'] = {};
    for (const q of recipe.questions) {
      const question: Record<string, unknown> = {type:q.type,instructions:q.instructions};
      if (q.type === 'choice') question.criteria = Object.fromEntries(q.options.map(o=>[o.key,o.description]));
      if (q.type === 'score') question.criteria = [...q.levels];
      if (q.type === 'noul') question.criteria = {true:q.yes,false:q.no};
      questions[q.id] = question;
    }
    return {model:recipe.model,state:clone(snapshot.state),questions};
  }
  export function lintQuestions(recipe: Recipe): string[] {
    const messages: string[] = [];
    for (const q of recipe.questions) {
      if (!q.instructions.includes('active_note')) messages.push(q.id+': name the exact state field to evaluate. IDs are not model instructions.');
      if (q.type === 'choice' && !q.options.some(o=>['other','unknown','not_stated'].includes(o.key))) messages.push(q.id+': consider an explicit “other” or “not stated” option.');
      if (/\b(summarize|write a|generate|translate)\b/i.test(q.instructions)) messages.push(q.id+': Jev chooses bounded values; use another model for prose generation.');
    }
    return messages;
  }
}
