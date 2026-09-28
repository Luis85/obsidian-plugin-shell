/** Current authoring format. The retained v1–v5 contract remains the validator for unchanged subsystems. */
import {
  COMPANION_FORMAT, COMPANION_MAX_BYTES, companionDesignKey,
  validateCompanionDocument, migrateCompanionDocument,
} from './project-contract.mjs';
import { validateProjectTooling, type ProjectTooling } from './tooling-contract.ts';
import type { SitemapDesign } from './sitemap/model.ts';
import { assertJson, record, requireSitemap, utf8Length } from './sitemap/safety.ts';
import { validateSitemapModel } from './sitemap/validate.ts';

export { COMPANION_FORMAT, COMPANION_MAX_BYTES };
export const AUTHORING_VERSION = 6;
export interface AuthoringDocument {
  kind: 'obsidian-companion-project';
  schemaVersion: number;
  executable: false;
  project: { id: string; name: string; author: string; version: string; description: string };
  settings: { codebaseFolder: string; testsFolder: string };
  design: SitemapDesign & { schema: number };
  notes: string[];
  tooling?: ProjectTooling;
}
export interface AuthoringMigration {
  fromVersion: number;
  toVersion: 6;
  legacy: Record<string, unknown> | null;
}

/** No permissive fallback: v6 first validates inert data, then every v5 subsystem and the new references. */
function assertAuthoringDocument(input: unknown): asserts input is AuthoringDocument {
  assertJson(input);
  requireSitemap(record(input) && Number.isInteger(input.schemaVersion) &&
    [1, 2, 3, 4, 5, 6].includes(Number(input.schemaVersion)), 'COMPANION_VERSION', 'Unsupported authoring format/version.');
  validateProjectTooling(input.tooling);
  const legacy = structuredClone(input);
  delete legacy.tooling;
  if (input.schemaVersion !== 6) {
    validateCompanionDocument(legacy);
  } else {
    requireSitemap(record(input.design) && input.design.schema === 6,
      'COMPANION_VERSION', 'Transfer and design schema versions must match.');
    // Only explicitly validated additions are removed for legacy-field validation. Unknown fields still fail.
    requireSitemap(record(legacy.design), 'COMPANION_INVALID', 'Expected a saved design.');
    delete legacy.tooling;
    delete legacy.design.sitemap; delete legacy.design.features;
    legacy.schemaVersion = 5; legacy.design.schema = 5;
    validateCompanionDocument(legacy);
    validateSitemapModel(input.design);
  }

}

export function validateAuthoringDocument(input: unknown): AuthoringDocument {
  assertAuthoringDocument(input);
  return input;
}

export function parseAuthoringDocument(text: string): AuthoringDocument {
  requireSitemap(typeof text === 'string' && utf8Length(text) <= COMPANION_MAX_BYTES,
    'COMPANION_LIMIT', 'Project exceeds the 4 MB input limit.');
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error('COMPANION_INVALID: Expected valid JSON.'); }
  return validateAuthoringDocument(input);
}

/** Migration never guesses routes/features from layout; v5→v6 only changes the two version fields. */
export function migrateAuthoringDocument(input: unknown): { document: AuthoringDocument; report: AuthoringMigration | null } {
  const source = validateAuthoringDocument(input);
  if (source.schemaVersion === 6) return { document: source, report: null };
  const migrated = legacyMigration(source);
  const document = structuredClone(migrated.document);
  document.schemaVersion = 6; document.design.schema = 6;
  return { document: validateAuthoringDocument(document), report: {
    fromVersion: source.schemaVersion, toVersion: 6, legacy: migrated.report,
  } };
}

/** Preserve optional tooling across legacy migration without changing the frozen legacy validator. */
function legacyMigration(source: AuthoringDocument) {
  const { tooling, ...legacy } = source;
  const migrated = migrateCompanionDocument(legacy);
  return { ...migrated, document: { ...migrated.document, ...(tooling === undefined ? {} : { tooling }) } };
}

/** Source readers keep legacy inputs at their original normalized v5 version; new inputs retain v6. */
export const authoringReader = {
  parse: parseAuthoringDocument,
  migrate(input: unknown) {
    const document = validateAuthoringDocument(input);
    return document.schemaVersion === 6 ? { document, report: null } : legacyMigration(document);
  },
};
export function authoringDesignKey(key: string): boolean {
  return key === 'sitemap' || key === 'features' || companionDesignKey(key);
}
