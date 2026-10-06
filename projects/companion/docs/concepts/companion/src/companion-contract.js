// The concept's names for the bundled project contract (CompanionContract). Schema 6 is the only project format:
// earlier versions are rejected, never migrated. Declared ahead of the program so saved-state restore can use them.
const COMPANION_FORMAT = CompanionContract.COMPANION_FORMAT;
const COMPANION_VERSION = CompanionContract.AUTHORING_VERSION;
const COMPANION_MAX_BYTES = CompanionContract.COMPANION_MAX_BYTES;
const COMPANION_DEFAULT_FOLDERS = Object.freeze({ codebaseFolder: 'src', testsFolder: 'tests' });
function validateCompanionDocument(value) { return CompanionContract.validateAuthoringDocument(value); }
function parseCompanionDocument(text) { return CompanionContract.parseAuthoringDocument(text); }
function validateCompanionFolders(value) { return CompanionContract.validateCompanionFolders(value); }
function companionDesignKey(key) { return CompanionContract.authoringDesignKey(key); }
function validateStarterCatalog(value) { return CompanionContract.validateStarterCatalog(value); }
// Optional project tooling and the sitemap, feature and editor records travel unchanged with the project.
function companionValidTooling(value) { try { CompanionContract.validateProjectTooling(value); return true; } catch { return false; } }
// Validates the persisted (JSON) form of the fields the sitemap model reads; in-memory unset fields are not saved.
function companionValidSitemap(design) {
  try {
    const view = Object.fromEntries(['nodes', 'links', 'canvas', 'library', 'prds', 'sitemap', 'features', 'editors'].filter(key => design?.[key] !== undefined).map(key => [key, design[key]]));
    CompanionContract.validateSitemapModel(JSON.parse(JSON.stringify(view))); return true;
  } catch { return false; }
}
