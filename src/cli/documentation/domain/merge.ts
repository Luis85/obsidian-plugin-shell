import { equal, docsObject as object, keyOf, type Entity, type Conflict, type Resolutions } from './contracts.ts';
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Omitted fields preserve the existing semantic value; arrays are ordered conflict units. */
function overlay(current: unknown, patch: unknown): unknown {
  if (!isRecord(current) || !isRecord(patch)) return structuredClone(patch);
  const result = structuredClone(current);
  for (const [key, value] of Object.entries(patch)) result[key] = Object.hasOwn(current, key) ? overlay(current[key], value) : structuredClone(value);
  return result;
}
interface MergeContext { entity: string; hasBase: boolean; resolutions: Resolutions; conflicts: Conflict[]; used: string[] }
const pointer = (key: string): string => key.replace(/~/g, '~0').replace(/\//g, '~1');
function mergeRecords(context: MergeContext, b: unknown, m: Record<string, unknown>, p: Record<string, unknown>, path: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of [...new Set([...Object.keys(m), ...Object.keys(p)])].sort()) {
    const value = mergeValue(context, isRecord(b) ? b[key] : undefined, m[key], p[key], path + '/' + pointer(key));
    if (value !== undefined) result[key] = value;
  }
  return result;
}
function resolveScalar(context: MergeContext, m: unknown, p: unknown, path: string): unknown {
  const resolutionKey = context.entity + '#' + path, resolution = context.resolutions[resolutionKey];
  if (resolution) { context.used.push(resolutionKey); return resolution === 'markdown' ? m : p; }
  context.conflicts.push({ entity: context.entity, field: path, reason: context.hasBase ? 'Both representations changed this field.' : 'Existing values differ without a synchronization baseline.' });
  return p;
}
function mergeValue(context: MergeContext, b: unknown, m: unknown, p: unknown, path: string): unknown {
  if (equal(m, p)) return p;
  if (context.hasBase && equal(m, b)) return p;
  if (context.hasBase && equal(p, b)) return m;
  if (isRecord(m) && isRecord(p)) return mergeRecords(context, b, m, p, path);
  return resolveScalar(context, m, p, path);
}
export function mergeEntity(base: Entity | undefined, markdown: Entity, project: Entity | undefined, resolutions: Resolutions = {}) {
  const conflicts: Conflict[] = [], used: string[] = [], entity = keyOf(markdown);
  if (!project) return { value: structuredClone(markdown), conflicts, used };
  const incoming = object(overlay(base ?? project, markdown));
  const context: MergeContext = { entity, hasBase: base !== undefined, resolutions, conflicts, used };
  // Identity is already indexed and validated; only managed properties and payloads merge.
  const value: Entity = { ...project, title: String(mergeValue(context, base?.title, incoming.title, project.title, '/title')),
    fields: object(mergeValue(context, base?.fields, incoming.fields, project.fields, '/fields')),
    data: object(mergeValue(context, base?.data, incoming.data, project.data, '/data')) };
  return { value, conflicts, used };
}
