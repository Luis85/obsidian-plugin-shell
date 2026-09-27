namespace Jev {
  export function assertSafe(value: unknown, depth = 0): void {
    if (depth > 30) throw new Error('JSON nesting exceeds 30 levels.');
    if (Array.isArray(value)) { value.forEach(v => assertSafe(v, depth + 1)); return; }
    if (record(value)) for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe JSON property: ' + key);
      assertSafe(child, depth + 1);
    }
  }
  export function parseJson(text: string): unknown {
    if (text.length > 2_000_000) throw new Error('JSON exceeds the prototype’s 2 MB character limit.');
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error('Not valid JSON. Check commas, quotes, and brackets.'); }
    assertSafe(value); return value;
  }
  export function validateRecipe(value: unknown): Check[] {
    const issues: Check[] = [];
    const issue = (path: string, message: string) => issues.push({path, message});
    if (!record(value)) return [{path: '$', message: 'Expected a prompt recipe object.'}];
    if (value.kind !== 'jev-prompt' || value.schemaVersion !== 1) issue('$', 'Expected jev-prompt schemaVersion 1. Unknown formats are not converted.');
    const allowed = ['kind','schemaVersion','id','name','description','tags','model','status','bindings','questions','policy'];
    for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(key, 'Unknown field. Nothing will be silently discarded.');
    for (const key of ['id','name','description','model']) if (typeof value[key] !== 'string' || String(value[key]).length > (key === 'description' ? 4000 : 160)) issue(key, 'Expected bounded text.');
    if (typeof value.id === 'string' && !/^[a-zA-Z0-9_-]{1,80}$/.test(value.id)) issue('id','Use a portable ID (letters, numbers, hyphens, underscores).');
    if (typeof value.name === 'string' && !value.name.trim()) issue('name', 'Name your prompt.');
    if (!['jev-1.13.0','jev-latest','jev-preview'].includes(String(value.model))) issue('model','Choose a documented model ID.');
    if (!['draft','ready','archived'].includes(String(value.status))) issue('status', 'Unknown lifecycle status.');
    if (!Array.isArray(value.tags) || value.tags.length > 12 || value.tags.some(t => typeof t !== 'string' || t.length > 40)) issue('tags', 'Use up to 12 short tags.');
    if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 24) issue('questions','Use 1–24 independent questions in this editor.');
    const ids = new Set<string>();
    if (Array.isArray(value.questions)) value.questions.forEach((q: unknown, i: number) => {
      const p = 'questions.' + i;
      if (!record(q)) { issue(p, 'Expected a question.'); return; }
      for (const k of Object.keys(q)) if (!['id','type','instructions','options','levels','yes','no'].includes(k)) issue(p+'.'+k,'Unknown question field.');
      if (typeof q.id !== 'string' || !safeKey(q.id) || ids.has(q.id)) issue(p+'.id','Use a unique lowercase ID: letters, numbers, underscores.');
      ids.add(String(q.id));
      if (!['choice','score','noul'].includes(String(q.type))) issue(p+'.type','Choose Choice, Score, or Noul.');
      if (typeof q.instructions !== 'string' || !q.instructions.trim() || q.instructions.length > 16000) issue(p+'.instructions','Write an instruction (up to 16,000 characters).');
      if (!Array.isArray(q.options) || !Array.isArray(q.levels) || typeof q.yes !== 'string' || typeof q.no !== 'string') { issue(p,'Question editor fields are incomplete.'); return; }
      if (q.type === 'choice') {
        if (q.options.length < 2 || q.options.length > 255) issue(p+'.options','Choice needs 2–255 options in this editor.');
        const keys = new Set<string>();
        q.options.forEach((o: unknown, n: number) => {
          if (!record(o) || typeof o.key !== 'string' || !safeKey(o.key) || keys.has(o.key) || typeof o.description !== 'string' || !o.description.trim() || o.description.length > 4000) issue(p+'.options.'+n,'Give each option a unique safe key and a description (up to 4,000 characters).');
          if (record(o)) { keys.add(String(o.key)); for (const k of Object.keys(o)) if (!['key','description'].includes(k)) issue(p+'.options.'+n+'.'+k,'Unknown option field.'); }
        });
      }
      if (q.type === 'score' && (q.levels.length < 2 || q.levels.length > 10 || q.levels.some(s => typeof s !== 'string' || !s.trim() || s.length > 4000))) issue(p+'.levels','Score needs 2–10 independently meaningful rubric descriptions.');
      if (q.type === 'noul' && (!q.yes.trim() || !q.no.trim() || q.yes.length > 4000 || q.no.length > 4000)) issue(p+'.criteria','Describe both yes and no (up to 4,000 characters each).');
    });
    const b = value.bindings;
    if (!record(b)) issue('bindings', 'State bindings are required.');
    else {
      for (const k of ['body','frontmatter','tasks','headings','selection','linkedNotes']) if (typeof b[k] !== 'boolean') issue('bindings.'+k,'Expected a boolean.');
      if (!Number.isInteger(b.maxChars) || Number(b.maxChars) < 200 || Number(b.maxChars) > 30000) issue('bindings.maxChars','Use 200–30,000 characters per note.');
      if (!Number.isInteger(b.maxReferences) || Number(b.maxReferences) < 0 || Number(b.maxReferences) > 20) issue('bindings.maxReferences','Use 0–20 references.');
      for (const k of ['fields','excludedFolders']) if (!Array.isArray(b[k]) || (b[k] as unknown[]).length > 30 || (b[k] as unknown[]).some(v => typeof v !== 'string' || v.length > 100)) issue('bindings.'+k,'Expected a bounded list of text values.');
      if (Array.isArray(b.fields) && b.fields.some(k => typeof k === 'string' && ['__proto__','constructor','prototype'].includes(k))) issue('bindings.fields','Unsafe property name.');
      for (const k of Object.keys(b)) if (!['body','frontmatter','tasks','headings','selection','linkedNotes','maxChars','maxReferences','fields','excludedFolders'].includes(k)) issue('bindings.'+k,'Unknown binding.');
    }
    const p = value.policy;
    if (!record(p)) issue('policy','A decision policy is required.');
    else {
      for (const k of ['confidence','yes','no']) if (typeof p[k] !== 'number' || Number(p[k]) < 0 || Number(p[k]) > 1) issue('policy.'+k,'Use a number from 0 to 1.');
      if (Number(p.no) >= Number(p.yes)) issue('policy','Noul no threshold must be below its yes threshold.');
      for (const k of Object.keys(p)) if (!['confidence','yes','no'].includes(k)) issue('policy.'+k,'Unknown policy field.');
    }
    return issues;
  }
  export function readLibrary(value: unknown): Library {
    assertSafe(value);
    if (!record(value)) throw new Error('Expected a JSON object.');
    if (value.kind === 'jev-prompt') {
      const errors = validateRecipe(value); if (errors.length) throw new Error(errors.map(e => e.path+': '+e.message).slice(0,4).join('\n'));
      return {kind:'jev-prompt-library',schemaVersion:1,prompts:[clone(value) as unknown as Recipe],revisions:{}};
    }
    if (value.kind !== 'jev-prompt-library' || value.schemaVersion !== 1 || !Array.isArray(value.prompts) || !record(value.revisions)) throw new Error('Import a Jev Studio recipe or library, not an API request or companion project.');
    for (const k of Object.keys(value)) if (!['kind','schemaVersion','prompts','revisions'].includes(k)) throw new Error('Unknown library field: '+k);
    if (!value.prompts.length || value.prompts.length > 100) throw new Error('A library contains 1–100 prompts.');
    const ids = new Set<string>();
    for (const prompt of value.prompts) {
      const errors = validateRecipe(prompt); if (errors.length) throw new Error(errors[0].path+': '+errors[0].message);
      const id = (prompt as Recipe).id; if (ids.has(id)) throw new Error('Duplicate prompt ID: '+id); ids.add(id);
    }
    for (const [id,revisions] of Object.entries(value.revisions)) {
      if (!ids.has(id) || !Array.isArray(revisions) || revisions.length > 50) throw new Error('Invalid revision collection.');
      for (const rev of revisions) if (!record(rev) || typeof rev.id !== 'string' || typeof rev.createdAt !== 'string' || typeof rev.message !== 'string' || !record(rev.recipe) || rev.recipe.id !== id || validateRecipe(rev.recipe).length) throw new Error('Invalid revision snapshot.');
    }
    return clone(value) as unknown as Library;
  }
}
