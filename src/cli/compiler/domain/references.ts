import { sourceReferenceDiagnostics } from './source-references.ts';
import type { CompilerDiagnostic, SourceLocation } from './contracts.ts';
import { diagnostic, orderedDiagnostics } from './diagnostics.ts';

type Row = Record<string, unknown>;
type Locate = (pointer: string, id: unknown) => SourceLocation;
const object = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const collection = (value: unknown): Row[] | null => Array.isArray(value) && value.length <= 200 && value.every(object) ? value as Row[] : null;
const missing = (message: string, source: SourceLocation): CompilerDiagnostic => diagnostic('COMPILER_REFERENCE_MISSING', 'resolve', message, source);
function duplicates(items: readonly Row[], base: string, field: string, location: Locate): CompilerDiagnostic[] {
  const seen = new Map<string, SourceLocation>(), output: CompilerDiagnostic[] = [];
  for (const [index, row] of items.entries()) {
    const value = row[field]; if (typeof value !== 'string') continue;
    const here = location(`${base}/${index}/${field}`, row.id), previous = seen.get(value.toLowerCase());
    if (previous) output.push({ ...diagnostic('COMPILER_DUPLICATE_ID', 'resolve', `Duplicate ${field}: ${value}.`, here), related: [previous] });
    else seen.set(value.toLowerCase(), here);
  }
  return output;
}
function componentReferences(node: Row, index: number, componentIds: ReadonlySet<unknown> | null, location: Locate): CompilerDiagnostic[] {
  const components = collection(node.components);
  if (!components || !componentIds) return [];
  return components.flatMap((component, j) => typeof component.id === 'string' && !componentIds.has(component.id)
    ? [missing(`Surface ${String(node.id)} references missing component ${component.id}.`, location(`/design/nodes/${index}/components/${j}/id`, node.id))] : []);
}
function nodeReferences(nodes: readonly Row[], ids: ReadonlySet<unknown>, componentIds: ReadonlySet<unknown> | null, location: Locate): CompilerDiagnostic[] {
  return nodes.flatMap((node, index) => [
    ...(typeof node.parent === 'string' && !ids.has(node.parent)
      ? [missing(`Surface ${String(node.id)} references missing parent ${node.parent}.`, location(`/design/nodes/${index}/parent`, node.id))] : []),
    ...componentReferences(node, index, componentIds, location)]);
}
function linkReferences(links: readonly Row[], ids: ReadonlySet<unknown>, location: Locate): CompilerDiagnostic[] {
  return links.flatMap((link, index) => ['from', 'to'].filter(key => typeof link[key] === 'string' && !ids.has(link[key]))
    .map(key => missing(`Interaction ${String(link.id)} references missing surface ${String(link[key])}.`, location(`/design/links/${index}/${key}`, link.id))));
}
/** Independent, source-aware checks. Structural validation remains authoritative; invalid shapes cause no cascades. */
export function referenceDiagnostics(document: unknown, file: string): CompilerDiagnostic[] {
  const design = object(object(document)?.design);
  if (!design) return [];
  const nodes = collection(design.nodes), library = collection(design.library), links = collection(design.links);
  if (!nodes) return [];
  const location: Locate = (pointer, id) => ({ file, jsonPointer: pointer, ...(typeof id === 'string' ? { entityId: id } : {}) });
  const ids = new Set(nodes.map(n => n.id)), componentIds = library && new Set(library.map(c => c.id));
  return orderedDiagnostics([
    ...duplicates(nodes, '/design/nodes', 'id', location), ...duplicates(nodes, '/design/nodes', 'slug', location),
    ...(library ? duplicates(library, '/design/library', 'id', location) : []),
    ...nodeReferences(nodes, ids, componentIds, location), ...(links ? linkReferences(links, ids, location) : []),
    ...sourceReferenceDiagnostics(document, file)]);
}
