import { dirname, join, resolve } from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { parseDesignData } from '../contracts/json-data.ts';
import { exists, hash, readBounded, readJson } from '../../bin/adapters/framework/files.ts';
import { requireThat } from '../../bin/adapters/framework/contracts.ts';
import { portablePath, record, validateDefinition } from './validation.ts';
import type { LoadedStarter, StarterDefinition } from './types.ts';
import { STARTER_MAX_BYTES } from './browser.ts';
import { pluginStarterDefinitions } from '../../plugins/runtime.ts';
const defaultStarterFolder = 'configs/starters';
/** Only the invocation project's explicit preferences; never a fallback into the installed shell. */
export async function starterFolder(root: string): Promise<string> {
  const settingsPath = join(root, 'configs/user-settings.json');
  let folder = defaultStarterFolder;
  if (await exists(settingsPath)) {
    const settings = record(await readJson(settingsPath));
    if (settings.paths !== undefined) {
      const paths = record(settings.paths);
      if (paths.startersFolder !== undefined) {
        requireThat(typeof paths.startersFolder === 'string' && portablePath(paths.startersFolder), 'STARTER_PATH', 'paths.startersFolder must be a contained relative folder.');
        folder = paths.startersFolder;
      }
    }
  }
  await checkDirectoryChain(resolve(root, folder), true);
  return folder;
}
export async function checkDirectoryChain(path: string, missing = false): Promise<void> {
  for (let current = resolve(path); ; current = dirname(current)) {
    if (await exists(current)) {
      const stat = await lstat(current);
      requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'STARTER_LINK', 'Refusing a non-directory or symlink in the directory chain.');
    } else requireThat(missing, 'STARTER_DIRECTORY', 'Required directory does not exist.');
    if (dirname(current) === current) break;
  }
}
export function parseDefinition(bytes: Buffer) {
  return validateDefinition(parseDesignData(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
export async function loadDefinitions(root: string, contributed: readonly StarterDefinition[] = pluginStarterDefinitions()): Promise<LoadedStarter[]> {
  const folder = await starterFolder(root), path = resolve(root, folder);
  const results: LoadedStarter[] = [];
  let size = 0;
  if (await exists(path)) {
    const entries = await readdir(path, { withFileTypes: true });
    requireThat(entries.length <= 256, 'STARTER_LIMIT', 'A starter folder supports at most 256 entries.');
    // Order by definition ID (the name without .json), so webapp precedes webapp-angular.
    const key = (name: string) => name.replace(/\.json$/i, '');
    for (const entry of entries.sort((a, b) => key(a.name) < key(b.name) ? -1 : key(a.name) > key(b.name) ? 1 : 0)) {
      if (!entry.name.toLowerCase().endsWith('.json')) continue;
      requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json$/.test(entry.name) && entry.isFile() && !entry.isSymbolicLink(), 'STARTER_SOURCE', 'Definitions must be regular lower-case $starterName.json files.');
      const file = folder + '/' + entry.name, bytes = await readBounded(join(root, file), STARTER_MAX_BYTES); size += bytes.length;
      requireThat(size <= 16_000_000, 'STARTER_LIMIT', 'Starter folder exceeds 16 MB.');
      const definition = parseDefinition(bytes);
      requireThat(definition.id + '.json' === entry.name && !results.some(row => row.definition.id === definition.id), 'STARTER_ID', 'Starter ID must match its filename and be unique.');
      results.push({ definition, file, sha256: hash(bytes), bytes });
    }
  }
  for (const source of contributed) {
    const definition = validateDefinition(structuredClone(source));
    requireThat(!results.some(row => row.definition.id === definition.id), 'STARTER_ID', 'Plugin starter ID conflicts with an installed starter: ' + definition.id);
    const bytes = Buffer.from(JSON.stringify(definition, null, 2) + '\n');
    size += bytes.length;
    requireThat(size <= 16_000_000, 'STARTER_LIMIT', 'Starter definitions exceed 16 MB.');
    results.push({ definition, file: 'plugin:' + definition.id, sha256: hash(bytes), bytes });
  }
  return results.sort((a, b) => a.definition.id.localeCompare(b.definition.id, 'en'));
}
/** Adapter for the pre-existing Companion authoring/compiler contract. No separate source of truth. */
export function companionCatalog(entries: LoadedStarter[]) {
  return { schemaVersion: 1, starters: entries.filter(entry => entry.definition.generator.kind === 'companion').map(entry => {
    const d = entry.definition;
    requireThat(d.generator.kind === 'companion', 'STARTER_KIND', 'Expected a Companion definition.');
    return { id: d.id, name: d.name, category: d.category, level: d.level, summary: d.summary, outcome: d.outcome,
      includes: d.includes, implementation: d.implementation, tags: d.tags, version: d.version,
      file: d.id + '.companion.json', sha256: entry.sha256, document: d.generator.document };
  }) };
}
