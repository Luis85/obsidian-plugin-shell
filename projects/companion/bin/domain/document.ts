import { validateAuthoringDocument, type AuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { emptyVisualDesigns, type VisualDesigns } from '../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../scripts/companion/visual/visual-validate.mjs';
import { record } from '../../scripts/companion/sitemap/safety.ts';
import { requireSketch, slug, title } from './errors.ts';

export interface LibraryEntry { id: string; name: string; description?: string; [key: string]: unknown }
export interface SketchDocument extends AuthoringDocument {
  design: AuthoringDocument['design'] & { library: LibraryEntry[]; visualDesigns: VisualDesigns; nextId: number };
}
function assertLibrary(value: unknown): asserts value is LibraryEntry[] {
  requireSketch(Array.isArray(value) && value.every(item => record(item) && typeof item.id === 'string' && typeof item.name === 'string'),
    'SKETCH_LIBRARY', 'Library entries need IDs and names. Repair the source in Companion; it has not been overwritten.');
}
function assertVisual(value: unknown): asserts value is VisualDesigns { validateVisualDesigns(value); }
function assertDocument(value: AuthoringDocument): asserts value is SketchDocument {
  assertLibrary(value.design.library); assertVisual(value.design.visualDesigns);
  requireSketch(typeof value.design.nextId === 'number', 'SKETCH_COUNTER', 'Missing design identity counter.');
}
/** The Companion v6 envelope is the only saved model; no private CLI format or executable expressions. */
export function openDocument(input: unknown): SketchDocument {
  const document = validateAuthoringDocument(structuredClone(input));
  if (document.design.visualDesigns === undefined) document.design.visualDesigns = emptyVisualDesigns();
  validateAuthoringDocument(document); assertDocument(document);
  return document;
}
export function newDocument(name: string): SketchDocument {
  const label = title(name, 80);
  return openDocument({ kind: 'obsidian-companion-project', schemaVersion: 6, executable: false,
    project: { id: slug(label, 'project'), name: label, author: 'Your name', version: '0.1.0', description: '' },
    settings: { codebaseFolder: 'src', testsFolder: 'tests' }, notes: [],
    design: { schema: 6, blueprint: label, goal: '', platform: 'desktop', nextId: 1,
      nodes: [], links: [], library: [], librarySchema: 2, prds: [], visualDesigns: emptyVisualDesigns() },
  });
}
export function documentText(document: SketchDocument): string {
  validateAuthoringDocument(document);
  return JSON.stringify(document, null, 2) + '\n';
}
/** Caller-owned mutations are isolated: a failed batch never partially edits the original. */
export function editDocument(document: SketchDocument, edit: (draft: SketchDocument) => void): SketchDocument {
  const draft = structuredClone(document); edit(draft);
  validateAuthoringDocument(draft); assertDocument(draft);
  return draft;
}
