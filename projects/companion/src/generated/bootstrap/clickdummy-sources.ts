import { createGAuthoringVaultService } from '../application/authoring-vault/service.ts';
import { createGTestRecipesService } from '../application/test-recipes/service.ts';
import type { Sources } from '../application/sources.ts';
/** Synthetic read values, not production records. Each call returns an independent value. */
export function createClickdummySources(): Sources { return {"authoring-vault": createGAuthoringVaultService({"list-requirements": async () => { return [{"id":"fixture","type":"requirement","title":"fixture"}]; },
"list-sitemap": async () => { return [{"id":"fixture","type":"screen","title":"fixture"}]; },
"list-components": async () => { return [{"id":"fixture","type":"component","title":"fixture"}]; }}),
"test-recipes": createGTestRecipesService({"list": async () => { return [{"record":{"id":"fixture","type":"test-recipe","title":"fixture"},"revision":1}]; },
"create": async () => { throw new Error('NOT_IMPLEMENTED: Clickdummy has no business-write adapter.'); },
"update": async () => { throw new Error('NOT_IMPLEMENTED: Clickdummy has no business-write adapter.'); },
"delete": async () => { throw new Error('NOT_IMPLEMENTED: Clickdummy has no business-write adapter.'); }})}; }
