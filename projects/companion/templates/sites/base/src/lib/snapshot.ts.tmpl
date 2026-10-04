/**
 * The Bases collection snapshots in src/data/collections/. `node bin/app site collections` (in the Workbench shell)
 * writes each one as <name>.collection.json; the site loads no other file there. Each snapshot is checked before use,
 * so a foreign or outdated file fails the build with its file name instead of rendering wrong data.
 */
export const SNAPSHOT_SUFFIX = '.collection.json';
export const SNAPSHOT_SCHEMA = 2;
export const GENERATED_BY = 'node bin/app site collections';

/** The collection name of a snapshot path, such as faq for ./data/collections/faq.collection.json. */
export function snapshotName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1, -SNAPSHOT_SUFFIX.length);
}

export function snapshotFile(name: string): string {
  return `src/data/collections/${name}${SNAPSHOT_SUFFIX}`;
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The snapshot itself, or an error naming the file when it is not a snapshot this site can read. */
export function checkSnapshot<T>(name: string, value: unknown): T {
  const file = snapshotFile(name), regenerate = 'regenerate it with node bin/app site collections in the Workbench shell';
  if (!plain(value) || value.generatedBy !== GENERATED_BY) {
    throw new Error(`${file} is not a Workbench collection snapshot (generatedBy must be "${GENERATED_BY}"). Move it out of src/data/collections, or ${regenerate}.`);
  }
  if (value.schemaVersion !== SNAPSHOT_SCHEMA) {
    throw new Error(`${file} has snapshot schemaVersion ${String(value.schemaVersion)}; this site reads schemaVersion ${SNAPSHOT_SCHEMA}. ${regenerate[0]!.toUpperCase()}${regenerate.slice(1)}.`);
  }
  if (!plain(value.collection) || !Array.isArray(value.collection.fields) || !Array.isArray(value.records)) {
    throw new Error(`${file} is incomplete: it needs collection.fields and records. Do not edit snapshots by hand; ${regenerate}.`);
  }
  return value as T;
}

/** Parses snapshot text, naming the file when it is not JSON. */
export function parseSnapshot(name: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${snapshotFile(name)} is not valid JSON; regenerate it with node bin/app site collections in the Workbench shell.`);
  }
}
