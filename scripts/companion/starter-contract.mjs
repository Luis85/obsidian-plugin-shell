/** External starter projections are data. The retained browser fixture uses v5; current consumers also validate v6. */
import { validateCompanionDocument, validateCompanionFolders } from './project-contract.mjs';
import { validateAuthoringDocument, parseAuthoringDocument } from './authoring-contract.ts';
import { validateTooling } from './tooling-contract.mjs';
export const STARTER_CATALOG_VERSION = 1;
const STARTER_FIELDS = ['id', 'name', 'category', 'level', 'summary', 'outcome', 'includes', 'implementation', 'tags', 'version', 'file', 'sha256', 'document'];
function starterAssert(ok, message) { if (!ok) throw Error('STARTER_INVALID: ' + message); }
function starterText(value, limit = 400) { return typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f]/.test(value); }
/** v6 documents use the authoring contract; a v5 projection carries optional development tooling outside its frozen envelope. */
function starterDocument(value) {
  if (value?.schemaVersion === 6) { validateAuthoringDocument(value); return value; }
  const legacy = structuredClone(value);
  const tooling = legacy?.tooling; if (legacy) delete legacy.tooling;
  validateCompanionDocument(legacy); validateTooling(tooling);
  return value;
}
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
    starterDocument(entry.document);
    starterAssert([5, 6].includes(entry.document.schemaVersion), 'Starters require project v5 or v6.');
  }
  // Empty installations and a single custom starter are valid; no bundled blank fallback.
  return value;
}
export function customizeStarter(catalog, id, fields) {
  validateStarterCatalog(catalog);
  const entry = catalog.starters.find(s => s.id === id);
  starterAssert(entry, 'Unknown starter.');
  starterAssert(fields && Object.keys(fields).every(k => ['id','name','author','version','description','codebaseFolder','testsFolder','extension','extensions'].includes(k)), 'Unknown configuration.');
  starterAssert(Object.values(fields).every(v => typeof v === 'string'), 'Configuration values must be text.');
  const document = JSON.parse(JSON.stringify(entry.document));
  for (const key of ['id','name','author','version','description']) document.project[key] = String(fields[key] ?? document.project[key]).trim();
  document.settings = validateCompanionFolders({ codebaseFolder: fields.codebaseFolder ?? document.settings.codebaseFolder, testsFolder: fields.testsFolder ?? document.settings.testsFolder });
  for (const folder of Object.values(document.settings)) starterAssert(!['scripts','docs','harness','dist'].includes(folder.split('/')[0].toLowerCase()), 'Folder overlaps framework tooling.');
  if (fields.extension !== undefined) {
    starterAssert(document.design.nativeIntegrations?.fileTypes.length === 1, '--extension requires a starter with exactly one custom file type.');
    document.design.nativeIntegrations.fileTypes[0].extension = fields.extension;
  }
  if (fields.extensions !== undefined) {
    starterAssert(document.design.nativeIntegrations?.contextMenus.length === 1, '--extensions requires a starter with exactly one context action.');
    document.design.nativeIntegrations.contextMenus[0].extensions = fields.extensions.split(',');
  }
  // Provenance is informational Markdown, not a schema extension or execution authority.
  document.notes.push('# Project starter\n\nDefinition: ' + entry.id + ' @ ' + entry.version + '\nSource SHA-256: ' + entry.sha256 + '\n\nThis project is an independent editable copy. Catalog updates never overwrite it. No execution approvals, credentials, machine paths, test results or plugin installation are imported.\n');
  return document.schemaVersion === 6 ? parseAuthoringDocument(JSON.stringify(document)) : starterDocument(JSON.parse(JSON.stringify(document)));
}
