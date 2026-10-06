import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { checkSnapshot, parseSnapshot, snapshotFile, snapshotName } from './lib/snapshot';

/**
 * Every Bases collection snapshot (src/data/collections/<name>.collection.json) becomes one Astro content collection
 * named after its file; other files in that folder are ignored. `node bin/app site collections` (in the Workbench shell)
 * writes those snapshots; this file never needs editing. Each record becomes an entry whose id is the note path, with
 * its view position kept in `order`.
 */
const names = Object.keys(import.meta.glob('./data/collections/*.collection.json')).map(snapshotName);

const record = z.looseObject({
  order: z.number().int().nonnegative(),
  path: z.string(),
  group: z.unknown().optional(),
  values: z.record(z.string(), z.unknown()),
});
const snapshot = z.object({ records: z.array(z.looseObject({ path: z.string() })) });

function parser(name: string) {
  return (text: string): Array<Record<string, unknown>> => {
    const parsed = snapshot.parse(checkSnapshot(name, parseSnapshot(name, text)));
    return parsed.records.map((entry, order) => ({ ...entry, id: entry.path, order }));
  };
}

export const collections = Object.fromEntries(names.map(name => [name, defineCollection({
  loader: file(snapshotFile(name), { parser: parser(name) }),
  schema: record,
})]));
