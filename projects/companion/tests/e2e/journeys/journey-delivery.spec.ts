// Generated from design.sitemap.journeys["journey-delivery"]. Regenerating replaces this file; edit the journey in design/project.json.
import { test, type Page } from '@playwright/test';
import { openSurface, followControl } from './journey-support';

test.describe("[journey-delivery] Prepare and verify", () => {
  // Steps are one connected walk through the preview: a failed step skips the rest.
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });
  test("[journey-delivery/step-1] Open \"Prepare project\"", async () => {
    await openSurface(page, "/#surface=node-35", "Prepare project");
  });
  test("[journey-delivery/step-2] Follow \"Continue after preparation\" from \"Prepare project\" to \"Development\"", async () => {
    await followControl(page, "Continue after preparation", 0, "/#surface=node-39", "Development");
  });
  test("[journey-delivery/step-3] Follow \"Inspect current evidence\" from \"Development\" to \"Quality & verification\"", async () => {
    await followControl(page, "Inspect current evidence", 0, "/#surface=node-41", "Quality & verification");
  });
  test("[journey-delivery/step-4] Follow \"Review publication gates\" from \"Quality & verification\" to \"Release readiness\"", async () => {
    await followControl(page, "Review publication gates", 0, "/#surface=node-45", "Release readiness");
  });
});
