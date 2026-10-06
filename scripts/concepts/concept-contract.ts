/** The standalone Companion concept's one project contract: schema 6 plus the external JSON starter model. Bundled into the page. */
export { COMPANION_FORMAT, AUTHORING_VERSION, COMPANION_MAX_BYTES, companionRelativeFolder, validateCompanionFolders,
  validateAuthoringDocument, parseAuthoringDocument, authoringDesignKey } from '../companion/authoring-contract.ts';
export { validateProjectTooling } from '../companion/tooling-contract.ts';
export { validateSitemapModel } from '../companion/sitemap/validate.ts';
export { canonicalKey } from '../companion/sitemap/safety.ts';
export { validateStarterCatalog } from '../companion/starter-contract.mjs';
export { parseBrowserStarter, starterProjection, configureBrowserStarter, exportBrowserStarter } from '../../src/cli/adapters/starters/browser.ts';
