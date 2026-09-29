import { equal, docsObject as object, keyOf, type Entity, type Conflict, type Resolutions } from './contracts.ts';
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Omitted fields preserve the existing semantic value; arrays are ordered conflict units. */
function overlay(current: unknown, patch: unknown): unknown {
  if (!isRecord(current) || !isRecord(patch)) return structuredClone(patch);
  const result = structuredClone(current);
  for (const [key, value] of Object.entries(patch)) result[key] = Object.hasOwn(current, key) ? overlay(current[key], value) : structuredClone(value);
  return result;
}
export function mergeEntity(base: Entity | undefined, markdown: Entity, project: Entity | undefined, resolutions: Resolutions = {}) {
  const conflicts: Conflict[] = [], used: string[] = [], entity = keyOf(markdown);
  if (!project) return { value: structuredClone(markdown), conflicts, used };
  const incoming = object(overlay(base ?? project, markdown));
  function merge(b: unknown, m: unknown, p: unknown, path: string): unknown {
    if (equal(m, p)) return p;
    if (base && equal(m, b)) return p;
    if (base && equal(p, b)) return m;
    if (isRecord(m) && isRecord(p)) {
      const result: Record<string, unknown> = {};
      for (const key of [...new Set([...Object.keys(m), ...Object.keys(p)])].sort()) {
        const value = merge(isRecord(b) ? b[key] : undefined, m[key], p[key], path + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'));
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    const resolutionKey = entity + '#' + path;
    if (resolutions[resolutionKey]) { used.push(resolutionKey); return resolutions[resolutionKey] === 'markdown' ? m : p; }
    conflicts.push({ entity, field: path, reason: base ? 'Both representations changed this field.' : 'Existing values differ without a synchronization baseline.' });
    return p;
  }
  // Identity is already indexed and validated; only managed properties and payloads merge.
  const value: Entity = { ...project, title: String(merge(base?.title, incoming.title, project.title, '/title')),
    fields: object(merge(base?.fields, incoming.fields, project.fields, '/fields')),
    data: object(merge(base?.data, incoming.data, project.data, '/data')) };
  return { value, conflicts, used };
}
