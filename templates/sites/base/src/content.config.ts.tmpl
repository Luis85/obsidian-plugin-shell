import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Every Bases collection snapshot in src/data/collections/ becomes one Astro content collection named after its file.
 * `node bin/app site collections` (in the Workbench shell) writes those snapshots; this file never needs editing.
 * Each record becomes an entry whose id is the note path, with its view position kept in `order`.
 */
const SNAPSHOTS = './data/collections/';
const names = Object.keys(import.meta.glob('./data/collections/*.json')).map(path => path.slice(SNAPSHOTS.length, -'.json'.length));

const record = z.looseObject({
  order: z.number().int().nonnegative(),
  path: z.string(),
  group: z.unknown().optional(),
  values: z.record(z.string(), z.unknown()),
  properties: z.record(z.string(), z.unknown()),
});
const snapshot = z.object({ schemaVersion: z.literal(1), records: z.array(z.looseObject({ path: z.string() })) });

function parseSnapshot(text: string): Array<Record<string, unknown>> {
  const parsed = snapshot.parse(JSON.parse(text));
  return parsed.records.map((entry, order) => ({ ...entry, id: entry.path, order }));
}

export const collections = Object.fromEntries(names.map(name => [name, defineCollection({
  loader: file(`src/data/collections/${name}.json`, { parser: parseSnapshot }),
  schema: record,
})]));
