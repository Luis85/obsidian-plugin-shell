import { hasControls, requireSketch } from './errors.ts';

/**
 * Opt-in Astro website templates. `templates/sites/` holds a shared `base` and one overlay folder per template; every
 * file there is non-executable `.tmpl` text, so no shell gate treats it as shell source. A path segment `dot-<name>`
 * becomes `.<name>` (`.gitignore`, `.nvmrc`, `.github`) and `__SITE_*__` tokens are replaced at render time.
 */
export const SITE_TEMPLATES = 'templates/sites';
export const SITE_BASE = 'base';
export const PROJECT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export interface SiteTemplateCollection { name: string; use: string }
export interface SiteTemplate { id: string; title: string; summary: string; collections: SiteTemplateCollection[] }
export interface SiteCatalog { astro: string; templates: SiteTemplate[] }
export interface SiteIdentity { name: string; title: string; template: SiteTemplate }

/** A plain JSON object, or null. */
export const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
/** A string with visible text. */
export const filled = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function readCollection(value: unknown): SiteTemplateCollection {
  const entry = record(value);
  requireSketch(entry && filled(entry.name) && filled(entry.use), 'SITE_CATALOG', `${SITE_TEMPLATES}/catalog.json: each template collection needs a name and a use.`);
  return { name: entry.name, use: entry.use };
}
function readTemplate(value: unknown): SiteTemplate {
  const item = record(value);
  requireSketch(item && typeof item.id === 'string' && PROJECT_NAME.test(item.id) && item.id !== SITE_BASE && filled(item.title) && filled(item.summary) && Array.isArray(item.collections),
    'SITE_CATALOG', `${SITE_TEMPLATES}/catalog.json: each template needs a kebab id (not "${SITE_BASE}"), a title, a summary and its collections.`);
  return { id: item.id, title: item.title, summary: item.summary, collections: item.collections.map(readCollection) };
}
/** The catalog is data shipped with the templates; it is the one list of template ids. */
export function readSiteCatalog(value: unknown): SiteCatalog {
  const catalog = record(value);
  requireSketch(catalog?.schemaVersion === 1 && filled(catalog.astro) && Array.isArray(catalog.templates), 'SITE_CATALOG', `${SITE_TEMPLATES}/catalog.json must be schemaVersion 1 with astro and templates.`);
  const templates = catalog.templates.map(readTemplate);
  requireSketch(new Set(templates.map(item => item.id)).size === templates.length, 'SITE_CATALOG', `${SITE_TEMPLATES}/catalog.json lists a template id twice.`);
  return { astro: catalog.astro, templates };
}
export function selectTemplate(catalog: SiteCatalog, id: string | undefined): SiteTemplate {
  const ids = catalog.templates.map(item => item.id).join(', ');
  requireSketch(id, 'SITE_TEMPLATE_REQUIRED', `Choose a template with --template: ${ids}.`);
  const template = catalog.templates.find(item => item.id === id);
  requireSketch(template, 'SITE_TEMPLATE_UNKNOWN', `No site template "${id}". Templates: ${ids}.`);
  return template;
}

/** `site` commands target only `projects/<kebab-name>`, relative to the shell root. Returns the project name. */
export function siteProjectName(target: string | undefined): string {
  const match = /^projects\/([^/]+)\/?$/.exec(target ?? '');
  requireSketch(match && PROJECT_NAME.test(match[1]!), 'SITE_TARGET', 'Name the site as projects/<name>, with lowercase words joined by single hyphens, for example projects/acme-docs.');
  return match[1]!;
}
export function siteTitle(value: string | undefined, name: string): string {
  if (value === undefined) return name.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' ');
  const title = value.trim();
  requireSketch(title.length > 0 && title.length <= 80 && !hasControls(title) && !/[<>`]|__/.test(title), 'SITE_TITLE', 'Use a single-line --title of 1 to 80 characters without <, >, backticks or double underscores.');
  return title;
}

/** Template file path (relative to its template folder) to the rendered project path. */
export function outputPath(templatePath: string): string {
  requireSketch(templatePath.endsWith('.tmpl') && !templatePath.split('/').some(part => part.startsWith('.')), 'SITE_TEMPLATE_FILE', `${templatePath}: site template files end in .tmpl and use dot-<name> for dot files.`);
  return templatePath.slice(0, -'.tmpl'.length).split('/').map(part => part.startsWith('dot-') ? `.${part.slice(4)}` : part).join('/');
}
function tokens(site: SiteIdentity): Record<string, string> {
  return {
    __SITE_NAME__: site.name, __SITE_TITLE__: site.title, __SITE_TEMPLATE__: site.template.id, __SITE_TEMPLATE_TITLE__: site.template.title,
    __SITE_TEMPLATE_SUMMARY__: site.template.summary,
    __SITE_TEMPLATE_COLLECTIONS__: site.template.collections.map(item => `- \`${item.name}\`: ${item.use}`).join('\n'),
  };
}
/** Replaces every known token; an unknown `__SITE_*__` token left in a template is a template defect, not output. */
export function renderTemplate(path: string, source: string, site: SiteIdentity): string {
  const values = tokens(site);
  const rendered = source.replace(/__SITE_[A-Z_]+__/g, token => values[token] ?? token);
  const left = /__SITE_[A-Z_]+__/.exec(rendered);
  requireSketch(!left, 'SITE_TEMPLATE_TOKEN', `${path}: unknown template token ${left?.[0]}.`);
  return rendered;
}
/** The project manifest of a new site: no prototypes (it starts from a template) and no collections yet. */
export function siteManifest(site: SiteIdentity): string {
  return JSON.stringify({
    schemaVersion: 1, name: site.name, title: site.title,
    summary: `${site.template.title} website built with Astro from Obsidian Bases collections.`,
    prototypes: [], site: { template: site.template.id, collections: [] },
  }, null, 2) + '\n';
}
