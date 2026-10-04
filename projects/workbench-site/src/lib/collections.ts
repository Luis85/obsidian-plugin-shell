import { getCollection, type CollectionKey } from 'astro:content';

/**
 * Read access to the Bases collection snapshots for pages and components. The field list (with display names and
 * types) comes from the snapshot itself; the records come from the Astro content collection of the same name.
 */
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'list' | 'object' | 'empty' | 'mixed';
export interface CollectionField { property: string; displayName: string; type: FieldType }
export interface CollectionInfo {
  name: string;
  base: { path: string; view: string };
  view: { name: string; type: string };
  fields: CollectionField[];
}
export interface SiteRecord { order: number; path: string; group?: unknown; values: Record<string, unknown>; properties: Record<string, unknown> }
interface Snapshot { schemaVersion: number; collection: Omit<CollectionInfo, 'name'> }

const SNAPSHOTS = '../data/collections/';
const snapshots = import.meta.glob<Snapshot>('../data/collections/*.json', { eager: true, import: 'default' });
const infos = new Map(Object.entries(snapshots).map(([path, snapshot]) => {
  const name = path.slice(SNAPSHOTS.length, -'.json'.length);
  if (snapshot.schemaVersion !== 1) throw new Error(`src/data/collections/${name}.json: unsupported snapshot schemaVersion ${snapshot.schemaVersion}.`);
  const { base, view, fields } = snapshot.collection;
  return [name, { name, base, view, fields }];
}));

/** Collection names in alphabetical order; empty when no snapshot has been written yet. */
export function collectionNames(): string[] {
  return [...infos.keys()].sort();
}

export function collectionInfo(name: string): CollectionInfo | null {
  return infos.get(name) ?? null;
}

/** Every snapshot file is registered as a content collection by src/content.config.ts, so its name is a collection key. */
function isCollection(name: string): name is CollectionKey {
  return infos.has(name);
}

/** The records of one collection in the order of its Bases view; an unknown collection has none. */
export async function collectionRecords(name: string): Promise<SiteRecord[]> {
  if (!isCollection(name)) return [];
  const entries: ReadonlyArray<{ data: SiteRecord }> = await getCollection(name);
  return entries.map(entry => entry.data).sort((a, b) => a.order - b.order);
}

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
/** Plain text for one Bases value: lists are joined, empty values become an empty string. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replace(WIKILINK, (_match, target: string, alias?: string) => alias ?? target);
}

/** The heading of a record: its first column, without the .md extension when that column is the file name. */
export function recordTitle(info: CollectionInfo, record: SiteRecord): string {
  const first = info.fields[0];
  if (!first) return record.path.replace(/\.md$/, '');
  const text = formatValue(record.values[first.property]);
  return (first.property === 'file.name' ? text.replace(/\.md$/, '') : text) || record.path;
}

/** A link inside the site that respects the configured base path. */
export function href(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
