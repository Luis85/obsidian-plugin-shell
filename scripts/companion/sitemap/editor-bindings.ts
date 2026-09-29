import type { SitemapDesign } from './model.ts';
import { id, list, record, requireSitemap, sitemapObject } from './safety.ts';

/** A closed registry of shipped editors, not code, package names or filesystem permissions. */
export interface EditorBinding { surface: string; editor: 'journey-lens' }
export function editorBindings(design: SitemapDesign): EditorBinding[] {
  if (design.editors === undefined) return [];
  sitemapObject(design.editors, ['schema', 'bindings']);
  requireSitemap(design.editors.schema === 1, 'EDITOR_VERSION', 'Unsupported editor binding version.');
  list(design.editors.bindings, 60);
  const seen = new Set<string>();
  return design.editors.bindings.map(value => {
    requireSitemap(record(value), 'EDITOR_BINDING', 'Expected an editor binding.');
    sitemapObject(value, ['surface', 'editor']); id(value.surface);
    requireSitemap(value.editor === 'journey-lens', 'EDITOR_UNKNOWN', 'Choose a shipped editor capability.');
    requireSitemap(!seen.has(value.surface), 'EDITOR_DUPLICATE', 'A surface can have only one editor.');
    seen.add(value.surface);
    requireSitemap(design.nodes.some(node => node.id === value.surface && ['page', 'view'].includes(node.kind)),
      'EDITOR_SURFACE', 'Editors require an existing page or view.');
    return { surface: value.surface, editor: 'journey-lens' };
  });
}
