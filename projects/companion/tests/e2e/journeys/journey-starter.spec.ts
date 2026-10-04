// Generated from design.sitemap.journeys["journey-starter"]. Regenerating replaces this file; edit the journey in design/project.json.
import { test, type Page } from '@playwright/test';
import { openSurface, followControl, followToDialog } from './journey-support';

test.describe("[journey-starter] Start from a template", () => {
  // Steps are one connected walk through the preview: a failed step skips the rest.
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });
  test("[journey-starter/step-1] Open \"Project overview\"", async () => {
    await openSurface(page, "/#surface=node-3", "Project overview");
  });
  test("[journey-starter/step-2] Follow \"Choose a project starter\" from \"Project overview\" to \"Project Starters\"", async () => {
    await followControl(page, "Choose a project starter", 0, "/#surface=node-5", "Project Starters");
  });
  test("[journey-starter/step-3] Follow \"Review configured starter\" from \"Project Starters\" to dialog \"Import project JSON\"", async () => {
    await followToDialog(page, "Review configured starter", 0, "Import project JSON");
  });
});
