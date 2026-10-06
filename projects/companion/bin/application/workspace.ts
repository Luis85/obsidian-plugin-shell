import { documentText, editDocument, type SketchDocument } from '../domain/document.ts';
import { instantiateComponentTemplate } from '../domain/template-instantiation.ts';
import type { ComponentTemplate } from '../domain/component-template.ts';
import { runOperations } from './operations.ts';
/** In-memory editing history; only the persistence adapter can commit it. */
export class Workspace {
  document: SketchDocument;
  beforeHash: string | null;
  private savedText: string;
  private past: SketchDocument[] = [];
  private future: SketchDocument[] = [];
  constructor(document: SketchDocument, beforeHash: string | null) {
    this.document = document; this.beforeHash = beforeHash;
    this.savedText = beforeHash ? documentText(document) : '';
  }
  get dirty(): boolean { return documentText(this.document) !== this.savedText; }
  edit(operations: unknown): ReturnType<typeof runOperations> {
    const result = runOperations(this.document, operations);
    this.past.push(this.document); if (this.past.length > 50) this.past.shift();
    this.future = []; this.document = result.document; return result;
  }
  instantiateTemplate(templates: readonly ComponentTemplate[], templateId: string, name?: string) {
    let created: ReturnType<typeof instantiateComponentTemplate> | undefined;
    const next = editDocument(this.document, draft => { created = instantiateComponentTemplate(draft, templates, templateId, name); });
    this.past.push(this.document); if (this.past.length > 50) this.past.shift();
    this.future = []; this.document = next; return created!;
  }
  undo(): boolean {
    const previous = this.past.pop(); if (!previous) return false;
    this.future.push(this.document); this.document = previous; return true;
  }
  redo(): boolean {
    const next = this.future.pop(); if (!next) return false;
    this.past.push(this.document); this.document = next; return true;
  }
  saved(hash: string): void { this.beforeHash = hash; this.savedText = documentText(this.document); }
}
