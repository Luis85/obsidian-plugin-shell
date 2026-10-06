import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { requireSketch } from '../domain/errors.ts';
import { outputPath, readSiteCatalog, SITE_BASE, SITE_TEMPLATES, type SiteCatalog, type SiteTemplate } from '../domain/site-template.ts';
import { exists, readBounded, readJson } from './framework/files.ts';
import { resolveTemplateRoot } from './template-root.ts';

/**
 * Reads the Astro site templates shipped under templates/sites (in a source checkout, or verified from an installed
 * kit). Bounded: a template set has at most 200 files of 1 MB each, and links are refused.
 */
const LIMITS = Object.freeze({ files: 200, fileBytes: 1_048_576 });
export interface SiteTemplates { root: string; catalog: SiteCatalog }

export async function loadSiteTemplates(frameworkRoot: string): Promise<SiteTemplates> {
  const root = await resolveTemplateRoot(frameworkRoot);
  const path = join(root, SITE_TEMPLATES, 'catalog.json');
  requireSketch(await exists(path), 'SITE_TEMPLATES_MISSING', `This Workbench copy has no ${SITE_TEMPLATES}/catalog.json; the Astro site templates are not installed.`);
  return { root, catalog: readSiteCatalog(await readJson(path)) };
}

async function collect(folder: string, prefix: string, files: Map<string, string>): Promise<void> {
  for (const name of (await readdir(folder)).sort()) {
    const path = join(folder, name), relative = prefix ? `${prefix}/${name}` : name, stat = await lstat(path);
    requireSketch(!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile()), 'SITE_TEMPLATE_FILE', `${relative}: site templates hold only plain files and folders.`);
    if (stat.isDirectory()) { await collect(path, relative, files); continue; }
    files.set(outputPath(relative), (await readBounded(path, LIMITS.fileBytes)).toString('utf8'));
    requireSketch(files.size <= LIMITS.files, 'SITE_TEMPLATE_LIMIT', `A site template has at most ${LIMITS.files} files.`);
  }
}
/** The shared base, then the template's overlay; an overlay file replaces the base file with the same output path. */
export async function templateFiles(templates: SiteTemplates, template: SiteTemplate): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const folder of [SITE_BASE, template.id]) {
    const path = join(templates.root, SITE_TEMPLATES, folder);
    requireSketch(await exists(path), 'SITE_TEMPLATES_MISSING', `${SITE_TEMPLATES}/${folder} is missing.`);
    await collect(path, '', files);
  }
  return files;
}
