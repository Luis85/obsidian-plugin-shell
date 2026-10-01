import { join, resolve } from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { parseDesignData } from '../../scripts/contracts/json-data.ts';
import { exists, hash, readBounded } from './framework/files.ts';
import { requireThat } from './framework/contracts.ts';
import { validateComponentTemplate, validateComponentTemplateCatalog, type ComponentTemplate } from '../domain/component-template.ts';

export interface LoadedComponentTemplate {
  template: ComponentTemplate;
  file: string;
  sha256: string;
  origin: 'baseline' | 'project' | 'plugin';
}

export const TEMPLATE_FOLDER = 'configs/templates';
const MAX_FILE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 12_000_000;

function safeName(name: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(name);
}

async function scanFolder(folder: string, displayRoot: string, origin: LoadedComponentTemplate['origin']): Promise<LoadedComponentTemplate[]> {
  if (!await exists(folder)) return [];
  const stat = await lstat(folder);
  requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'TEMPLATE_SOURCE', 'Component-template root must be a regular directory.');
  const result: LoadedComponentTemplate[] = [];
  let total = 0;

  async function visit(path: string, relative: string, depth: number): Promise<void> {
    requireThat(depth <= 5, 'TEMPLATE_LIMIT', 'Component-template folders may be nested at most five levels.');
    const entries = await readdir(path, { withFileTypes: true });
    requireThat(entries.length <= 256, 'TEMPLATE_LIMIT', 'A component-template directory contains too many entries.');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      requireThat(!entry.isSymbolicLink(), 'TEMPLATE_SOURCE', 'Symlinked component-template sources are refused.');
      if (entry.isDirectory()) {
        requireThat(safeName(entry.name), 'TEMPLATE_SOURCE', 'Template directories use lower-case kebab-case.');
        await visit(join(path, entry.name), relative ? relative + '/' + entry.name : entry.name, depth + 1);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith('.json')) continue;
      requireThat(entry.isFile() && /^[a-z][a-z0-9-]*\.json$/.test(entry.name),
        'TEMPLATE_SOURCE', 'Template files use lower-case kebab-case .json names.');
      const absolute = join(path, entry.name);
      const bytes = await readBounded(absolute, MAX_FILE_BYTES);
      total += bytes.length;
      requireThat(total <= MAX_TOTAL_BYTES, 'TEMPLATE_LIMIT', 'Component-template library exceeds 12 MB.');
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const template = validateComponentTemplate(parseDesignData(decoded));
      const local = relative ? relative + '/' + entry.name : entry.name;
      result.push({ template, file: displayRoot + '/' + local, sha256: hash(bytes), origin });
    }
  }

  await visit(folder, '', 0);
  return result;
}

async function baselineFolder(frameworkRoot: string): Promise<{ path: string; display: string } | null> {
  const source = resolve(frameworkRoot, TEMPLATE_FOLDER);
  if (await exists(source)) return { path: source, display: TEMPLATE_FOLDER };
  const kit = resolve(frameworkRoot, '.framework/template', TEMPLATE_FOLDER);
  if (await exists(kit)) return { path: kit, display: TEMPLATE_FOLDER };
  return null;
}

function uniqueSource(entries: readonly LoadedComponentTemplate[], label: string): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    requireThat(!ids.has(entry.template.id), 'TEMPLATE_DUPLICATE', label + ' defines ' + entry.template.id + ' more than once.');
    ids.add(entry.template.id);
  }
}

export async function loadComponentTemplates(
  root: string,
  frameworkRoot: string,
  contributed: readonly ComponentTemplate[] = [],
): Promise<LoadedComponentTemplate[]> {
  const baseline = await baselineFolder(frameworkRoot);
  const project = resolve(root, TEMPLATE_FOLDER);
  const baselineEntries = baseline ? await scanFolder(baseline.path, baseline.display, 'baseline') : [];
  const projectEntries = (!baseline || resolve(project) !== resolve(baseline.path)) && await exists(project)
    ? await scanFolder(project, TEMPLATE_FOLDER, 'project') : [];
  uniqueSource(baselineEntries, 'Framework baseline');
  uniqueSource(projectEntries, 'Project template library');
  const merged = new Map(baselineEntries.map(entry => [entry.template.id, entry]));
  for (const entry of projectEntries) merged.set(entry.template.id, entry);
  for (const raw of contributed) {
    const template = validateComponentTemplate(structuredClone(raw));
    requireThat(!merged.has(template.id), 'TEMPLATE_PLUGIN_COLLISION', 'Plugin template collides with installed template ' + template.id + '.');
    const bytes = Buffer.from(JSON.stringify(template, null, 2) + '\n');
    merged.set(template.id, { template, file: 'plugin:' + template.id, sha256: hash(bytes), origin: 'plugin' });
  }
  const sources = [...merged.values()].sort((a, b) => a.template.id.localeCompare(b.template.id, 'en'));
  validateComponentTemplateCatalog(sources.map(entry => entry.template));
  return sources;
}
