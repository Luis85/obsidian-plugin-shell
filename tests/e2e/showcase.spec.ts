import { test, expect, type Page } from '@playwright/test';
import '../../harness/app/test-api';
async function open(page: Page) {
  await page.goto('/harness/app/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('showcase')).toBeVisible();
}
async function task(page: Page, title = 'Prepare release checklist') {
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByLabel('Due date', { exact: true }).fill('2026-09-30');
  await page.getByRole('textbox', { name: 'Tags' }).fill('work,release');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  await expect(page.getByTestId('markdown-preview')).toContainText('due: "2026-09-30"');
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4180' ? route.continue() : route.abort());
  Object.assign(page, { observedErrors: errors });
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { observedErrors: string[] }).observedErrors).toEqual([]);
  if (!page.isClosed()) expect(await page.evaluate(() => window.__SHELL_TEST__?.faults ?? [])).toEqual([]);
});
test('[UI-I01] real Nuxt components render without global CSS, head injection or network dependencies', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Your plugin starts here.' })).toBeVisible();
  expect(await page.locator('head style').count()).toBe(0);
  const primary = page.getByRole('button', { name: 'Create your first Task note' });
  expect(await primary.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await page.locator('#theme-light').evaluate(el => getComputedStyle(el).backgroundColor));
  // The toolbar has intentional fixture CSS; probe a neutral host control instead.
  await page.evaluate(() => { const button = document.createElement('button'); button.id = 'host-style-sentinel'; button.hidden = true; document.body.append(button); });
  const before = await page.locator('#host-style-sentinel').evaluate(el => ({ font: getComputedStyle(el).fontSize, radius: getComputedStyle(el).borderRadius }));
  await page.evaluate(() => { for (const style of document.querySelectorAll('link[rel=stylesheet]')) { if ((style as HTMLLinkElement).href.includes('/assets/')) (style as HTMLLinkElement).disabled = true; } });
  expect(await page.locator('#host-style-sentinel').evaluate(el => ({ font: getComputedStyle(el).fontSize, radius: getComputedStyle(el).borderRadius }))).toEqual(before);
});
test('[UI-I02] validates, previews exact Markdown, commits once and persists real browser storage', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a title');
  await expect(page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title' })).toBeFocused();
  expect(await page.evaluate(() => Object.keys(window.__SHELL_TEST__.files()))).toHaveLength(0);
  await task(page);
  const preview = await page.getByTestId('markdown-preview').innerText();
  expect(await page.evaluate(() => Object.keys(window.__SHELL_TEST__.files()))).toHaveLength(0);
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const files = await page.evaluate(() => window.__SHELL_TEST__.files()); expect(files).toEqual({ 'Tasks/Prepare release checklist.md': preview });
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(files);
  await task(page); await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The destination already exists.');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(files);
  await task(page, 'Übersicht – Release Plan');
  await expect(page.locator('.shell-destination code')).toHaveText('Tasks/Übersicht – Release Plan.md');
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__SHELL_TEST__.files()).length)).toBe(2);
});
test('[UI-FILENAME] unsafe titles stay visible for correction and never become sanitized filenames', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Documents', exact: true }).click();
  const title = page.locator('.shell-document-grid').getByRole('textbox', { name: 'Title', exact: true });
  for (const invalid of ['Forbidden/name', 'CON', 'Title ']) {
    await title.fill(invalid); await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Use a nonblank note title');
    await expect(title).toHaveValue(invalid); await expect(title).toBeFocused();
    expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({});
  }
});
test('[UI-I03] known write failure produces no note and no success', async ({ page }) => {
  await open(page); await task(page); await page.evaluate(() => window.__SHELL_TEST__.fault('write'));
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The note could not be saved.');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual({});
  await expect(page.getByText('Task note created', { exact: true })).toHaveCount(0);
});
test('[UI-I04] opening failure preserves successful document creation', async ({ page }) => {
  await open(page); await task(page); await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  const before = await page.evaluate(() => window.__SHELL_TEST__.files());
  await page.evaluate(() => window.__SHELL_TEST__.fault('open')); await page.getByRole('button', { name: 'Open created note' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be opened');
  expect(await page.evaluate(() => window.__SHELL_TEST__.files())).toEqual(before);
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
});
test('[UI-I05] settings save, switch language immediately and survive reload', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Task note folder', { exact: true }).fill('Projects/Tasks');
  await page.getByLabel('Language', { exact: true }).selectOption('de');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('button', { name: 'Einstellungen speichern' })).toBeVisible();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Ordner für Aufgabennotizen', { exact: true })).toHaveValue('Projects/Tasks');
});
test('[UI-I06] real event publication, owner feedback and native-adapter modal work', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Events & feedback', exact: true }).click();
  await page.getByRole('button', { name: 'Publish a typed event' }).click(); await expect(page.locator('table')).toContainText('showcase.ping');
  await page.getByRole('button', { name: 'Try recoverable feedback' }).click(); await expect(page.locator('.shell-feedback').getByRole('status')).toContainText('deliberate feedback');
  await page.getByRole('button', { name: 'Dismiss notification' }).click(); await expect(page.locator('.shell-feedback-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open native modal', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open native modal', exact: true })).toBeFocused();
});
test('[UI-I07] responsive and live host theme changes do not remount the view', async ({ page }) => {
  await open(page);
  for (const width of [320, 600, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  const dark = await page.getByTestId('showcase').evaluate(el => getComputedStyle(el).backgroundColor);
  await page.locator('#theme-light').click();
  await expect.poll(() => page.getByTestId('showcase').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(dark);
  await page.locator('#theme-dark').click();
  await expect.poll(() => page.getByTestId('showcase').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(dark);
  expect(await page.getByTestId('showcase').count()).toBe(1);
});
test('[UI-I08] two views have unique DOM IDs and dispose independently', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  const initial = await page.evaluate(() => window.__SHELL_TEST__.resourceCount());
  // Per-view item drafts/subscriptions survive panel navigation and are acquired once.
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  expect(await page.evaluate(() => window.__SHELL_TEST__.resourceCount())).toBe(initial);
  await page.evaluate(() => window.__SHELL_TEST__.mountSecond()); await expect(page.getByTestId('showcase')).toHaveCount(2);
  const ids = await page.locator('[data-testid=showcase] [id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  expect(await page.evaluate(() => window.__SHELL_TEST__.resourceCount())).toBeGreaterThan(initial);
  await page.evaluate(() => window.__SHELL_TEST__.closeSecond()); await expect(page.getByTestId('showcase')).toHaveCount(1);
  expect(await page.evaluate(() => window.__SHELL_TEST__.resourceCount())).toBe(initial);
  await page.evaluate(() => window.__SHELL_TEST__.dispose());
  expect(await page.evaluate(() => window.__SHELL_TEST__.resourceCount())).toBe(0);
});
