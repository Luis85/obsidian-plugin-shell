namespace Jev {
  export interface LibraryPort { read(): Library | undefined; write(value: Library): void; readonly persistent: boolean; readonly warning: string }
  export class StudioService {
    library: Library;
    constructor(private readonly repository: LibraryPort, private readonly id: () => string, private readonly clock: () => string) { this.library = repository.read() || initialLibrary(); }
    get persistent(): boolean { return this.repository.persistent; }
    get warning(): string { return this.repository.warning; }
    private commit(next: Library): void { readLibrary(next); if(JSON.stringify(next).length>2_000_000)throw new Error('Workspace exceeds 2 MB. Export a backup and reduce retained checkpoints.'); this.repository.write(next); this.library = clone(next); }
    save(recipe: Recipe): void {
      const errors = validateRecipe(recipe); if (errors.length) throw new Error(errors[0].path+': '+errors[0].message);
      const next = clone(this.library); const index = next.prompts.findIndex(p=>p.id===recipe.id);
      if (index < 0) next.prompts.push(clone(recipe)); else next.prompts[index]=clone(recipe);
      if (recipe.schemaVersion===2) next.schemaVersion=2;
      this.commit(next);
    }
    saveLogic(logic: LogicLibrary): void {
      const next=clone(this.library); next.logic=readLogic(logic); next.schemaVersion=2; this.commit(next);
    }
    replaceWorkspace(library: Library): void { this.commit(readLibrary(library)); }
    create(template: string): Recipe { const recipe = makeRecipe(template,this.id()); this.save(recipe); return clone(recipe); }
    duplicate(recipe: Recipe): Recipe { const copy = clone(recipe); copy.id=this.id(); copy.name=(copy.name+' · copy').slice(0,160); copy.status='draft'; this.save(copy); return copy; }
    revision(recipe: Recipe, message: string): void {
      const errors = validateRecipe(recipe); if (errors.length) throw new Error(errors[0].message);
      const next = clone(this.library); const i = next.prompts.findIndex(p=>p.id===recipe.id);
      if (i<0) throw new Error('Save the recipe before versioning it.');
      next.prompts[i]=clone(recipe); if(recipe.schemaVersion===2)next.schemaVersion=2; const revisions = next.revisions[recipe.id] || [];
      if (revisions.length >= 50) throw new Error('This prototype keeps up to 50 versions per recipe. Export a library backup before starting a new recipe.');
      next.revisions[recipe.id]=[{id:this.id(),createdAt:this.clock(),message:message.trim().slice(0,400)||'Saved revision',recipe:clone(recipe)},...revisions]; this.commit(next);
    }
    importCopies(candidate: Library): string {
      if(candidate.logic)throw new Error('Use Business logic → Import workspace for a linked workspace; prompt-only import must not discard its logic.');
      const next = clone(this.library); let first = '';
      for (const recipe of candidate.prompts) {
        const copy=clone(recipe), oldId=copy.id; copy.id=this.id(); if (!first) first=copy.id;
        if (next.prompts.some(p=>p.name===copy.name)) copy.name=(copy.name+' · imported').slice(0,160);
        next.prompts.push(copy); if(copy.schemaVersion===2)next.schemaVersion=2;
        next.revisions[copy.id]=(candidate.revisions[oldId]||[]).map(r=>({...clone(r),id:this.id(),recipe:{...clone(r.recipe),id:copy.id}}));
      }
      this.commit(next); return first;
    }
  }
}
