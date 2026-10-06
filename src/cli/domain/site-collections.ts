import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { BaseRecord, CollectionResult } from './base-collection.ts';
import type { BaseValue } from './base-expression.ts';
import { filled, PROJECT_NAME, record } from './site-template.ts';

/**
 * The `site` section of a site project's workbench.project.json and the collection snapshots it implies. Shared by
 * `node bin/app site collections` and `check:projects`, so both read the same contract. Framework-free: existence of
 * the named files is checked by the callers.
 */
export const SNAPSHOT_FOLDER = 'src/data/collections';
/** The site loads only files with this suffix, so other JSON in the folder never reaches its build. */
export const SNAPSHOT_SUFFIX = '.collection.json';
const SNAPSHOT_SCHEMA = 2;
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

export const snapshotPath = (name: string): string => `${SNAPSHOT_FOLDER}/${name}${SNAPSHOT_SUFFIX}`;
/** A site record carries only what pages render: never the note's other frontmatter. */
interface SiteRecord { path: string; group?: BaseValue; values: Record<string, BaseValue> }
/** SHA-256 hex of UTF-8 text; injected so this module stays framework-free. */
export type Sha256 = (text: string) => string;
const siteRecords = (records: readonly BaseRecord[]): SiteRecord[] =>
  records.map(item => ({ path: item.path, ...(Object.hasOwn(item, 'group') ? { group: item.group } : {}), values: item.values }));
/** The canonical bytes `recordsSha256` covers: the records array as compact JSON. */
const recordsJson = (records: unknown): string => JSON.stringify(records);

/** The snapshot a site build reads: deterministic for the same notes and base, without timestamps. */
export function snapshotText(collected: Pick<CollectionResult, 'collection' | 'records'>, sha256: Sha256): string {
  const records = siteRecords(collected.records);
  return JSON.stringify({ schemaVersion: SNAPSHOT_SCHEMA, generatedBy: GENERATED_BY, recordsSha256: sha256(recordsJson(records)), collection: collected.collection, records }, null, 2) + '\n';
}
/**
 * `generated`: written by this command and untouched since (its records still match `recordsSha256`). `edited`: written
 * by it, then changed by hand. `legacy`: the schemaVersion 1 format, which embedded full frontmatter. `foreign`: anything else.
 */
export type SnapshotState = 'generated' | 'edited' | 'legacy' | 'foreign';
export function snapshotState(text: string, sha256: Sha256): SnapshotState {
  let value: Record<string, unknown> | null;
  try { value = record(JSON.parse(text)); } catch { return 'foreign'; }
  if (value?.generatedBy !== GENERATED_BY) return 'foreign';
  if (value.schemaVersion === 1) return 'legacy';
  if (value.schemaVersion !== SNAPSHOT_SCHEMA) return 'foreign';
  return Array.isArray(value.records) && value.recordsSha256 === sha256(recordsJson(value.records)) ? 'generated' : 'edited';
}

export interface SnapshotFile { path: string; state: SnapshotState }
export interface SnapshotDecision { remove: string[]; keep: string[]; conflicts: string[] }
const conflict = (file: SnapshotFile): string => file.state === 'edited'
  ? `${file.path} was edited by hand: its records no longer match its recordsSha256. It is never replaced or removed; restore it, or move it out of ${SNAPSHOT_FOLDER}, then run site collections again.`
  : `${file.path} was not written by site collections; it is never replaced or removed. Rename the collection or move the file.`;
/**
 * What `site collections` may do with the JSON files already in the snapshot folder, given the snapshot paths it will
 * write. Only an intact generated snapshot is replaced, or removed when no collection lists it. Old-format snapshots
 * (`<name>.json`, schemaVersion 1) are removed: the site no longer loads them. Any other `*.collection.json` blocks the
 * plan, because the site would load it; any other `*.json` is kept, because the site never loads it.
 */
export function snapshotDecisions(listed: readonly string[], existing: readonly SnapshotFile[]): SnapshotDecision {
  const decision: SnapshotDecision = { remove: [], keep: [], conflicts: [] };
  for (const file of existing) {
    if (!file.path.endsWith(SNAPSHOT_SUFFIX)) (file.state === 'legacy' ? decision.remove : decision.keep).push(file.path);
    else if (file.state !== 'generated') decision.conflicts.push(conflict(file));
    else if (!listed.includes(file.path)) decision.remove.push(file.path);
  }
  return decision;
}
