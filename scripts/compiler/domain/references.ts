import { sourceReferenceDiagnostics } from './source-references.ts';
import type { Diagnostic, SourceLocation } from './contracts.ts';
import { diagnostic, orderedDiagnostics } from './diagnostics.ts';

type Row = Record<string, unknown>;
const object = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const collection = (value: unknown): Row[] | null => Array.isArray(value) && value.length <= 200 && value.every(object) ? value as Row[] : null;
/** Independent, source-aware checks. Structural validation remains authoritative; invalid shapes cause no cascades. */
export function referenceDiagnostics(document: unknown, file: string): Diagnostic[] {
  const design = object(object(document)?.design);
  if (!design) return [];
  const nodes = collection(design.nodes), library = collection(design.library), links = collection(design.links);
  if (!nodes) return [];
  const output: Diagnostic[] = [];
  const location = (pointer: string, id: unknown): SourceLocation => ({ file, jsonPointer: pointer, ...(typeof id === 'string' ? { entityId: id } : {}) });
  function unique(items: Row[], base: string, field: string) {
    const seen = new Map<string, SourceLocation>();
    for (const [index, row] of items.entries()) {
      const value = row[field]; if (typeof value !== 'string') continue;
      const here = location(`${base}/${index}/${field}`, row.id), previous = seen.get(value.toLowerCase());
      if (previous) output.push({ ...diagnostic('COMPILER_DUPLICATE_ID', 'resolve', `Duplicate ${field}: ${value}.`, here), related: [previous] });
      else seen.set(value.toLowerCase(), here);
    }
  }
  unique(nodes, '/design/nodes', 'id'); unique(nodes, '/design/nodes', 'slug');
  if (library) unique(library, '/design/library', 'id');
  const ids = new Set(nodes.map(n => n.id)), componentIds = library && new Set(library.map(c => c.id));
  for (const [index, node] of nodes.entries()) {
    if (typeof node.parent === 'string' && !ids.has(node.parent)) output.push(diagnostic('COMPILER_REFERENCE_MISSING', 'resolve',
      `Surface ${String(node.id)} references missing parent ${node.parent}.`, location(`/design/nodes/${index}/parent`, node.id)));
    const components = collection(node.components);
    if (components && componentIds) for (const [j, component] of components.entries()) {
      if (typeof component.id === 'string' && !componentIds.has(component.id)) output.push(diagnostic('COMPILER_REFERENCE_MISSING', 'resolve',
        `Surface ${String(node.id)} references missing component ${component.id}.`, location(`/design/nodes/${index}/components/${j}/id`, node.id)));
    }
  }
  if (links) for (const [index, link] of links.entries()) for (const key of ['from', 'to']) {
    if (typeof link[key] === 'string' && !ids.has(link[key])) output.push(diagnostic('COMPILER_REFERENCE_MISSING', 'resolve',
      `Interaction ${String(link.id)} references missing surface ${String(link[key])}.`, location(`/design/links/${index}/${key}`, link.id)));
  }
  return orderedDiagnostics([...output,...sourceReferenceDiagnostics(document,file)]);
}
