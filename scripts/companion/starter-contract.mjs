/** Session catalog of external starter projections. Entries are data; each carries a current (schema 6) project. */
import { validateAuthoringDocument, AUTHORING_VERSION } from './authoring-contract.ts';
export const STARTER_CATALOG_VERSION = 1;
const STARTER_FIELDS = ['id', 'name', 'category', 'level', 'summary', 'outcome', 'includes', 'implementation', 'tags', 'version', 'file', 'sha256', 'document'];
function starterAssert(ok, message) { if (!ok) throw Error('STARTER_INVALID: ' + message); }
function starterText(value, limit = 400) { return typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f]/.test(value); }
export function validateStarterCatalog(value) {
  starterAssert(value && value.schemaVersion === STARTER_CATALOG_VERSION && Array.isArray(value.starters), 'Unsupported catalog.');
  starterAssert(Object.keys(value).every(k => ['schemaVersion', 'starters'].includes(k)), 'Unknown catalog field.');
  starterAssert(value.starters.length <= 256, 'Catalog size.');
  const ids = new Set();
  for (const entry of value.starters) {
    starterAssert(entry && typeof entry === 'object' && Object.keys(entry).every(k => STARTER_FIELDS.includes(k)), 'Unknown starter field.');
    starterAssert(starterText(entry.id, 60) && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.id) && !ids.has(entry.id), 'Duplicate or invalid ID.'); ids.add(entry.id);
    for (const key of ['name', 'category', 'level', 'summary', 'outcome', 'version']) starterAssert(starterText(entry[key]), 'Missing ' + key + '.');
    starterAssert(/^\d+\.\d+\.\d+$/.test(entry.version), 'Starter version.');
    starterAssert(['Foundation', 'Everyday', 'Advanced'].includes(entry.level), 'Unknown difficulty.');
    starterAssert(entry.file === entry.id + '.companion.json' && /^[a-f0-9]{64}$/.test(entry.sha256), 'Invalid local source identity.');
    for (const key of ['includes', 'implementation', 'tags']) starterAssert(Array.isArray(entry[key]) && entry[key].length > 0 && entry[key].length <= 32 && entry[key].every(v => starterText(v)), 'Invalid ' + key + '.');
    starterAssert(entry.document?.schemaVersion === AUTHORING_VERSION, 'Starters require project schema ' + AUTHORING_VERSION + '.');
    validateAuthoringDocument(entry.document);
  }
  // Empty installations and a single custom starter are valid; no bundled blank fallback.
  return value;
}

