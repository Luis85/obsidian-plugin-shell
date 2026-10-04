import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SketchError, requireSketch } from '../../domain/errors.ts';
import { collectRecords } from '../../domain/base-collection.ts';
import { selectView } from '../../domain/obsidian-base.ts';
import { generatedSnapshot, readSiteSection, SNAPSHOT_FOLDER, snapshotPath, snapshotText, type SiteCollectionEntry } from '../../domain/site-collections.ts';
import { record, renderTemplate, selectTemplate, siteManifest, siteProjectName, siteTitle } from '../../domain/site-template.ts';
import { createFilePlan, type FilePlan, type FilePlanEntry } from '../../../scripts/shared/file-plan.ts';
import { loadSiteTemplates, templateFiles } from '../site-templates.ts';
import { exists, readBounded, readJson } from './files.ts';
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
      next: [`Add an npm entry for /${target} to .github/dependabot.yml`, 'npm run projects:sync', 'npm run check:projects',
        `List Bases collections under site.collections in ${target}/workbench.project.json, then node bin/app site collections ${target}`,
        `cd ${target} && npm ci && npm run check`],
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
async function snapshot(context: Context, entry: SiteCollectionEntry) {
  // Loaded on use: the YAML parser is a project dependency, and the CLI must start before `npm ci` in a new project.
  const { loadBase, resolveVault, scanVault } = await import('../obsidian-base.ts');
  const vault = await resolveVault(context.root, entry.vault);
  requireSketch(await exists(join(context.root, entry.base)), 'SITE_COLLECTION_BASE_MISSING', `Collection ${entry.name}: ${entry.base} does not exist.`);
  const loaded = await loadBase(context.root, vault, entry.base);
  const view = selectView(loaded.definition, entry.view);
  const scan = await scanVault(vault, loaded.definition);
  const collected = collectRecords(loaded.definition, view, scan.notes, loaded.source);
  return { text: snapshotText(collected), summary: { name: entry.name, base: entry.base, view: entry.view, vault: entry.vault, records: collected.records.length, matched: collected.matched, skipped: scan.skipped } };
}
/** Snapshot files in the folder that no listed collection produces: generated ones are removed, other files kept. */
async function staleSnapshots(context: Context, folder: string, listed: readonly string[]): Promise<{ removed: string[]; kept: string[] }> {
  const removed: string[] = [], kept: string[] = [];
  if (!await exists(join(context.root, folder))) return { removed, kept };
  for (const name of (await readdir(join(context.root, folder))).filter(file => file.endsWith('.json')).sort()) {
    const path = `${folder}/${name}`;
    if (listed.includes(path)) continue;
    (generatedSnapshot((await readBounded(join(context.root, path), SNAPSHOT_BYTES)).toString('utf8')) ? removed : kept).push(path);
  }
  return { removed, kept };
}
async function replacementConflicts(context: Context, paths: readonly string[]): Promise<string[]> {
  const conflicts: string[] = [];
  for (const path of paths) {
    if (await exists(join(context.root, path)) && !generatedSnapshot((await readBounded(join(context.root, path), SNAPSHOT_BYTES)).toString('utf8')))
      conflicts.push(`${path} exists and was not written by site collections; it is never replaced. Rename the collection or move the file.`);
  }
  return conflicts;
}
export function siteCollectionsPlan(request: Request, context: Context): Promise<Planned> {
  return translating(async () => {
    const target = `projects/${siteProjectName(request.args[0])}`, folder = `${target}/${SNAPSHOT_FOLDER}`;
    const site = await readSite(context, target);
    const entries: FilePlanEntry[] = [], collections: unknown[] = [];
    for (const entry of site.collections) {
      const made = await snapshot(context, entry);
      entries.push({ path: `${target}/${snapshotPath(entry.name)}`, content: made.text }); collections.push(made.summary);
    }
    const listed = entries.map(entry => entry.path);
    const stale = await staleSnapshots(context, folder, listed);
    entries.push(...stale.removed.map(path => ({ path, content: null })));
    return { plan: await createFilePlan(context.root, entries), conflicts: await replacementConflicts(context, listed), summary: {
      site: target, template: site.template, collections, removed: stale.removed, kept: stale.kept,
      next: listed.length ? [`cd ${target} && npm run check`] : [`List Bases collections under site.collections in ${target}/workbench.project.json`],
    } };
  });
}
