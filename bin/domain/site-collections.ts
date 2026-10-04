import { requireSketch } from './errors.ts';
import type { CollectionResult } from './base-collection.ts';
import { filled, PROJECT_NAME, record } from './site-template.ts';

/**
 * The `site` section of a site project's workbench.project.json and the collection snapshots it implies. Shared by
 * `node bin/app site collections` and `check:projects`, so both read the same contract. Framework-free: existence of
 * the named files is checked by the callers.
 */
export const SNAPSHOT_FOLDER = 'src/data/collections';
export const GENERATED_BY = 'node bin/app site collections';
export interface SiteCollectionEntry { name: string; base: string; view: string; vault: string }
export interface SiteSection { template: string; collections: SiteCollectionEntry[] }

/** A normalized, relative, forward-slash repository path that never leaves the repository. */
export function repositoryPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/')) return null;
  const parts = value.replace(/\/$/, '').split('/');
  if (value === '.') return '.';
  return parts.every(part => part && part !== '.' && part !== '..') ? parts.join('/') : null;
}
const kebab = (value: unknown): boolean => typeof value === 'string' && PROJECT_NAME.test(value);
function vaultIssue(base: string | null, value: unknown, at: string): string[] {
  const vault = value === undefined ? '.' : repositoryPath(value);
  if (!vault) return [`SITE_COLLECTION_VAULT: ${at}.vault must be a normalized repository folder (default ".")`];
  return base && vault !== '.' && !base.startsWith(`${vault}/`) ? [`SITE_COLLECTION_VAULT: ${at}.base must be inside its vault ${vault}`] : [];
}
function entryIssues(value: unknown, at: string): string[] {
  const entry = record(value);
  if (!entry) return [`SITE_COLLECTION: ${at} must be an object with name, base and view`];
  const base = repositoryPath(entry.base);
  const rules: Array<[boolean, string]> = [
    [kebab(entry.name), `SITE_COLLECTION_NAME: ${at}.name must be lowercase words joined by single hyphens`],
    [Boolean(base?.endsWith('.base')), `SITE_COLLECTION_BASE: ${at}.base must be a normalized repository path ending in .base`],
    [filled(entry.view), `SITE_COLLECTION_VIEW: ${at}.view must name a view of the base`],
  ];
  return [...rules.filter(([valid]) => !valid).map(([, issue]) => issue), ...vaultIssue(base, entry.vault, at)];
}
/** Every reason the `site` section is invalid; empty when it is valid. */
export function siteIssues(value: unknown, templateIds: readonly string[]): string[] {
  const site = record(value);
  if (!site) return ['SITE_MANIFEST: site must be an object with template and collections'];
  const issues: string[] = [];
  if (typeof site.template !== 'string' || !templateIds.includes(site.template)) issues.push(`SITE_TEMPLATE: site.template must be one of ${templateIds.join(', ')}`);
  if (!Array.isArray(site.collections)) return [...issues, 'SITE_COLLECTIONS: site.collections must be a list (it may be empty)'];
  const names = site.collections.map(entry => record(entry)?.name);
  site.collections.forEach((entry, index) => issues.push(...entryIssues(entry, `site.collections[${index}]`)));
  names.forEach((name, index) => { if (typeof name === 'string' && names.indexOf(name) !== index) issues.push(`SITE_COLLECTION_DUPLICATE: site.collections[${index}].name "${name}" is used twice`); });
  return issues;
}
export function readSiteSection(value: unknown, templateIds: readonly string[]): SiteSection {
  const issues = siteIssues(value, templateIds);
  requireSketch(!issues.length, 'SITE_MANIFEST', `workbench.project.json: ${issues.join('; ')}.`);
  const site = record(value)!;
  const entries = Array.isArray(site.collections) ? site.collections.map(record) : [];
  return { template: String(site.template), collections: entries.map(entry => ({
    name: String(entry?.name), base: repositoryPath(entry?.base) ?? '', view: String(entry?.view), vault: repositoryPath(entry?.vault ?? '.') ?? '.',
  })) };
}

export const snapshotPath = (name: string): string => `${SNAPSHOT_FOLDER}/${name}.json`;
/** The snapshot a site build reads: deterministic for the same notes and base, without timestamps. */
export function snapshotText(collected: Pick<CollectionResult, 'collection' | 'records'>): string {
  return JSON.stringify({ schemaVersion: 1, generatedBy: GENERATED_BY, collection: collected.collection, records: collected.records }, null, 2) + '\n';
}
/** True only for a snapshot this command wrote; any other file is never replaced or removed. */
export function generatedSnapshot(text: string): boolean {
  try { const value = record(JSON.parse(text)); return value?.schemaVersion === 1 && value.generatedBy === GENERATED_BY; } catch { return false; }
}
