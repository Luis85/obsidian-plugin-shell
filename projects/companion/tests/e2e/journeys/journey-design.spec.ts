// Generated from design.sitemap.journeys["journey-design"]. Regenerating replaces this file; edit the journey in design/project.json.
import { test, type Page } from '@playwright/test';
import { openSurface, followControl } from './journey-support';

test.describe("[journey-design] Design a plugin", () => {
  // Steps are one connected walk through the preview: a failed step skips the rest.
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });
  test("[journey-design/step-1] Open \"Project overview\"", async () => {
    await openSurface(page, "/#surface=node-3", "Project overview");
  });
  test("[journey-design/step-2] Follow \"Define the outcome\" from \"Project overview\" to \"Product requirements\"", async () => {
    await followControl(page, "Define the outcome", 0, "/#surface=node-7", "Product requirements");
  });
  test("[journey-design/step-3] Follow \"Shape the experience\" from \"Product requirements\" to \"Sitemap & views\"", async () => {
    await followControl(page, "Shape the experience", 0, "/#surface=node-13", "Sitemap & views");
  });
  test.fixme("[journey-design/step-4] Reach \"Page editor\" (TODO the source screen hosts an editor instead of generated transition controls; interaction edge-60)", { annotation: [{"type":"journey-step","description":"journey-design/step-4"},{"type":"reason","description":"the source screen hosts an editor instead of generated transition controls"},{"type":"interaction","description":"edge-60"}] }, async () => {
    // TODO "Reach \"Page editor\" (TODO the source screen hosts an editor instead of generated transition controls; interaction edge-60)"
  });
});
