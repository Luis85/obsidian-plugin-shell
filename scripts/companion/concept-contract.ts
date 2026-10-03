/** The standalone Companion concept's one project contract: schema 6 plus the external JSON starter model. Bundled into the page. */
export { COMPANION_FORMAT, AUTHORING_VERSION, COMPANION_MAX_BYTES, companionRelativeFolder, validateCompanionFolders,
  validateAuthoringDocument, parseAuthoringDocument, authoringDesignKey } from './authoring-contract.ts';
export { validateProjectTooling } from './tooling-contract.ts';
export { validateSitemapModel } from './sitemap/validate.ts';
export { canonicalKey } from './sitemap/safety.ts';
export { validateStarterCatalog } from './starter-contract.mjs';
export { parseBrowserStarter, starterProjection, configureBrowserStarter, exportBrowserStarter } from '../../bin/adapters/starters/browser.ts';
