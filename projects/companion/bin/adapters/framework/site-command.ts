import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SketchError, requireSketch } from '../../domain/errors.ts';
import { collectRecords } from '../../domain/base-collection.ts';
import { selectView } from '../../domain/obsidian-base.ts';
import { readSiteSection, snapshotDecisions, SNAPSHOT_FOLDER, snapshotPath, snapshotState, snapshotText, type SiteCollectionEntry, type SnapshotFile } from '../../domain/site-collections.ts';
import { record, renderTemplate, selectTemplate, siteManifest, siteNextSteps, siteProjectName, siteTitle } from '../../domain/site-template.ts';
import type { BaseNote } from '../../domain/base-expression.ts';
import type { LoadedBase, VaultScan } from '../obsidian-base.ts';
import { createFilePlan, type FilePlan, type FilePlanEntry } from '../../../scripts/shared/file-plan.ts';
import { loadSiteTemplates, templateFiles } from '../site-templates.ts';
import { exists, hash, readBounded, readJson } from './files.ts';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';

/**
 * Opt-in Astro website projects. `site templates` lists the templates; `site new` renders one into projects/<name>;
 * `site collections` snapshots the Bases collections a site lists into its src/data/collections. The shell never
 * installs or runs Astro: the generated site owns that dependency.
 */
interface Planned { plan: FilePlan; summary: unknown; conflicts: string[] }
const SNAPSHOT_BYTES = 64 * 1_048_576;
async function translating<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) {
    if (error instanceof SketchError) throw new OperationError(error.code, error.message);
    throw error;
  }
}

export function siteTemplatesOperation(request: Request, context: Context): Promise<Result> {
  return translating(async () => {
    const { catalog } = await loadSiteTemplates(context.frameworkRoot);
    return result(request.command, { astro: catalog.astro, templates: catalog.templates });
  });
}

async function requireEmptyTarget(directory: string, target: string): Promise<void> {
  if (!await exists(directory)) return;
  const stat = await lstat(directory);
  requireSketch(stat.isDirectory() && !stat.isSymbolicLink(), 'TARGET_NOT_DIRECTORY', `${target} exists and is not a plain directory.`);
  requireSketch((await readdir(directory)).length === 0, 'TARGET_NOT_EMPTY', `${target} is not empty; choose a new or empty folder. Existing files are never overwritten.`);
}
export function siteNewPlan(request: Request, context: Context): Promise<Planned> {
  return translating(async () => {
    const name = siteProjectName(request.args[0]), target = `projects/${name}`;
    const templates = await loadSiteTemplates(context.frameworkRoot);
    const template = selectTemplate(templates.catalog, stringOption(request.options, 'template'));
    const site = { name, title: siteTitle(stringOption(request.options, 'title'), name), template };
    await requireEmptyTarget(join(context.root, target), target);
    const entries: FilePlanEntry[] = [...await templateFiles(templates, template)].map(([path, source]) => ({ path: `${target}/${path}`, content: renderTemplate(path, source, site) }));
    entries.push({ path: `${target}/workbench.project.json`, content: siteManifest(site) });
    entries.sort((a, b) => a.path < b.path ? -1 : 1);
    return { plan: await createFilePlan(context.root, entries), conflicts: [], summary: {
      site: name, title: site.title, template: template.id, astro: templates.catalog.astro, files: entries.map(entry => entry.path),
      // Only the maintainer checkout carries the projects tooling; kits and generated projects wire the site's CI by hand.
      next: siteNextSteps(target, await exists(join(context.root, 'scripts/projects/projects.mjs'))),
      notPerformed: 'Nothing is installed or built: Astro is a dependency of the generated site only.',
    } };
  });
}

async function readSite(context: Context, target: string) {
  const path = join(context.root, target, 'workbench.project.json');
  requireSketch(await exists(path), 'SITE_PROJECT_MISSING', `${target}/workbench.project.json does not exist; create the site with node bin/app site new ${target} --template <id>.`);
  const manifest = record(await readJson(path));
  requireSketch(manifest?.site !== undefined, 'SITE_NOT_A_SITE', `${target} is not a site project: its workbench.project.json has no site section.`);
  const { catalog } = await loadSiteTemplates(context.frameworkRoot);
  return readSiteSection(manifest.site, catalog.templates.map(item => item.id));
}
interface Scanned { loaded: LoadedBase; notes: BaseNote[]; skipped: VaultScan['skipped'] }
/** One read of a base and one scan of its vault, shared by every listed view of that base. */
async function scanBase(context: Context, entry: SiteCollectionEntry, scans: Map<string, Scanned>): Promise<Scanned> {
  const key = `${entry.vault}\n${entry.base}`, known = scans.get(key);
  if (known) return known;
  // Loaded on use: the YAML parser is a project dependency, and the CLI must start before `npm ci` in a new project.
  const { loadBase, resolveVault, scanVault } = await import('../obsidian-base.ts');
  const vault = await resolveVault(context.root, entry.vault);
  requireSketch(await exists(join(context.root, entry.base)), 'SITE_COLLECTION_BASE_MISSING', `Collection ${entry.name}: ${entry.base} does not exist.`);
  const loaded = await loadBase(context.root, vault, entry.base);
  const scan = await scanVault(vault, loaded.definition);
  const scanned = { loaded, notes: scan.notes, skipped: scan.skipped };
  scans.set(key, scanned);
  return scanned;
}
async function snapshot(context: Context, entry: SiteCollectionEntry, scans: Map<string, Scanned>) {
  const { loaded, notes, skipped } = await scanBase(context, entry, scans);
  const collected = collectRecords(loaded.definition, selectView(loaded.definition, entry.view), notes, loaded.source);
  return { text: snapshotText(collected, hash), summary: { name: entry.name, base: entry.base, view: entry.view, vault: entry.vault, records: collected.records.length, matched: collected.matched, skipped } };
}
/** Every JSON file already in the snapshot folder, with whether this command wrote it and left it untouched. */
async function existingSnapshots(context: Context, folder: string): Promise<SnapshotFile[]> {
  if (!await exists(join(context.root, folder))) return [];
  const files: SnapshotFile[] = [];
  for (const name of (await readdir(join(context.root, folder))).filter(file => file.endsWith('.json')).sort()) {
    const path = `${folder}/${name}`, file = (await lstat(join(context.root, path))).isFile();
    files.push({ path, state: file ? snapshotState((await readBounded(join(context.root, path), SNAPSHOT_BYTES)).toString('utf8'), hash) : 'foreign' });
  }
  return files;
}
export function siteCollectionsPlan(request: Request, context: Context): Promise<Planned> {
  return translating(async () => {
    const target = `projects/${siteProjectName(request.args[0])}`, folder = `${target}/${SNAPSHOT_FOLDER}`;
    const site = await readSite(context, target);
    const entries: FilePlanEntry[] = [], collections: unknown[] = [], scans = new Map<string, Scanned>();
    for (const entry of site.collections) {
      const made = await snapshot(context, entry, scans);
      entries.push({ path: `${target}/${snapshotPath(entry.name)}`, content: made.text }); collections.push(made.summary);
    }
    const listed = entries.map(entry => entry.path);
    const decided = snapshotDecisions(listed, await existingSnapshots(context, folder));
    entries.push(...decided.remove.map(path => ({ path, content: null })));
    return { plan: await createFilePlan(context.root, entries), conflicts: decided.conflicts, summary: {
      site: target, template: site.template, collections, removed: decided.remove, kept: decided.keep,
      next: listed.length ? [`cd ${target} && npm run check`] : [`List Bases collections under site.collections in ${target}/workbench.project.json`],
    } };
  });
}
