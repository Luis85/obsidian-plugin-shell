import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import '../../harness/app/test-api';
import { controlMetrics } from './control-metrics';
const observed = new WeakMap<Page, { browser: string[]; expected: { code: string; operation: string }[] }>();
const primary = (page: Page) => page.locator('[data-leaf="primary"]');
async function open(page: Page) {
  await page.goto('/harness/app/'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}
function expectedFault(page: Page, code: string, operation: string) { observed.get(page)?.expected.push({ code, operation }); }
async function geometry(page: Page) {
  return primary(page).evaluate(el => {
    const required = (selector: string) => { const node = el.querySelector<HTMLElement>(selector); if (!node) throw new Error(`Missing ${selector}`); return node; };
    const main = required('.shell-main'); const content = required('.shell-page'); const breadcrumb = required('.shell-breadcrumb'); const footer = required('.shell-footer');
    const style = getComputedStyle(main); const box = content.getBoundingClientRect();
    return {
      leaf: el.getBoundingClientRect().width, content: box.width,
      usable: main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      aligned: [breadcrumb, footer].map(node => Math.abs(node.getBoundingClientRect().left - box.left)),
      overflow: main.scrollWidth - main.clientWidth,
      rootOverflow: required('.shell-app').scrollWidth - required('.shell-app').clientWidth,
      gutter: parseFloat(style.paddingLeft),
    };
  });
}
test.beforeEach(async ({ page }) => {
  const record = { browser: [] as string[], expected: [] as { code: string; operation: string }[] }; observed.set(page, record);
  page.on('pageerror', error => record.browser.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.browser.push(message.text()); });
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4180' ? route.continue() : route.abort());
});
test.afterEach(async ({ page }) => {
  expect(observed.get(page)?.browser).toEqual([]);
  expect(await page.evaluate(() => window.__SHELL_TEST__?.faults ?? [])).toEqual(observed.get(page)?.expected);
});
for (const width of [320, 480, 768, 1280, 1920]) {
  test(`[UI-02-L${width}] all panels use their own leaf width with aligned gutters and contained overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 2000, height: 1080 }); await open(page);
    await page.evaluate(value => window.__SHELL_TEST__.leafWidth(value), width);
    for (const panel of ['Overview', 'Documents', 'Events & feedback', 'Preferences']) {
      await primary(page).getByRole('button', { name: panel, exact: true }).click();
      const result = await geometry(page);
      expect(result.leaf).toBeCloseTo(width, 0);
      expect(Math.abs(result.content - result.usable)).toBeLessThan(2);
      expect(result.aligned.every(delta => delta < 2)).toBe(true);
      expect(result.overflow).toBeLessThanOrEqual(1); expect(result.rootOverflow).toBeLessThanOrEqual(1);
      expect(result.gutter).toBe(width <= 600 ? 16 : width >= 1440 ? 32 : 24);
    }
    const select = primary(page).getByLabel('Language', { exact: true });
    const metrics = await controlMetrics(select);
    expect(metrics.glyphHeight).toBeGreaterThan(0);
    expect(metrics.height - metrics.padding).toBeGreaterThanOrEqual(metrics.glyphHeight + 2);
    await select.focus(); await expect(select).toBeFocused(); await select.selectOption('de');
    await primary(page).getByRole('button', { name: 'Save preferences' }).click();
    expect((await geometry(page)).overflow).toBeLessThanOrEqual(1);
  });
}
test('[UI-02-DOC] preview expands in wide panes and stacks without page overflow on resize', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  await primary(page).getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('A very long filename with German characters: Übersicht und zuverlässige Auslieferung '.repeat(1));
  await page.getByRole('textbox', { name: 'Tags' }).fill('implementation,review,release');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const pre = page.getByTestId('markdown-preview'); await expect(pre).toBeVisible();
  const wide = await pre.boundingBox(); expect(wide?.width).toBeGreaterThan(600);
  for (const width of [1280, 768, 480, 320, 1920]) {
    await page.evaluate(value => window.__SHELL_TEST__.leafWidth(value), width);
    expect((await geometry(page)).overflow).toBeLessThanOrEqual(1);
    const cards = page.locator('.shell-document-grid > *'); const a = await cards.nth(0).boundingBox(); const b = await cards.nth(1).boundingBox();
    if (!a || !b) throw new Error('Missing cards');
    if (width <= 1000) expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    else expect(Math.abs(b.y - a.y)).toBeLessThan(2);
  }
  expect(await page.evaluate(() => Object.keys(window.__SHELL_TEST__.files()))).toHaveLength(0);
});
test('[UI-02-HDR] immediate toggle is shared, isolated, persisted and restorable', async ({ page }) => {
  await open(page); await primary(page).getByRole('button', { name: 'Preferences', exact: true }).click();
  const header = primary(page).locator(':scope > .view-header'); await expect(header).toBeVisible();
  const sentinel = await page.locator('#non-plugin-leaf').evaluate(el => el.outerHTML);
  const control = primary(page).getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true });
  await control.click(); await expect(control).toBeChecked(); await expect(header).toBeHidden();
  await page.evaluate(() => window.__SHELL_TEST__.mountSecond());
  await expect(page.locator('[data-leaf="secondary"] > .view-header')).toBeHidden();
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__SHELL_TEST__.toggleHeader());
  await expect(header).toBeHidden();
  expect(await page.locator('#non-plugin-leaf').evaluate(el => el.outerHTML)).toBe(sentinel);
  await primary(page).getByRole('button', { name: 'View actions', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(control).toBeChecked(); await expect(header).toBeHidden();
  await control.click(); await expect(control).not.toBeChecked(); await expect(header).toBeVisible();
});
test('[UI-02-DRAFT] header changes and another leaf’s save preserve local drafts without stale overwrites', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page.getByLabel('Task note folder', { exact: true }).fill('My/Unsaved/Draft');
  const headerToggle = page.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true });
  await headerToggle.click(); await expect(headerToggle).toBeChecked();
  await expect(page.getByLabel('Task note folder', { exact: true })).toHaveValue('My/Unsaved/Draft');
  await page.evaluate(() => window.__SHELL_TEST__.setPreferences({ notifySuccess: false }));
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Task note folder', { exact: true })).toHaveValue('My/Unsaved/Draft');
  await expect(page.getByRole('checkbox', { name: 'Success notices', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true })).toBeChecked();
});
test('[UI-02-FAIL] failed header save keeps presentation and checked state truthful', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  expectedFault(page, 'settings.write', 'settings.save'); await page.evaluate(() => window.__SHELL_TEST__.fault('settings'));
  await page.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not saved');
  await expect(page.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true })).not.toBeChecked();
  await expect(primary(page).locator(':scope > .view-header')).toBeVisible();
});
test('[UI-02-NOTICE] notification failure preserves the created note and provides one inline fallback', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Successful write with failed notice');
  await page.getByRole('button', { name: 'Preview Markdown', exact: true }).click();
  const preview = await page.getByTestId('markdown-preview').innerText();
  expectedFault(page, 'notice.sink', 'notice.show'); await page.evaluate(() => window.__SHELL_TEST__.fault('notice'));
  await page.getByRole('button', { name: 'Create Task note', exact: true }).click();
  await expect(page.getByText('Task note created', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.values(window.__SHELL_TEST__.files()))).toEqual([preview]);
  await expect(page.locator('.shell-feedback-item')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('[UI-02-SCALE] live themes and explicitly simulated 125/150 percent UI scaling keep controls usable', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  for (const scale of [1.25, 1.5, 1]) {
    await primary(page).evaluate((el, value) => { el.style.zoom = String(value); }, scale);
    for (const theme of ['light', 'dark']) {
      await page.locator(`#theme-${theme}`).click();
      const select = page.getByLabel('Language', { exact: true }); await select.focus(); await expect(select).toBeFocused();
      expect((await geometry(page)).overflow).toBeLessThanOrEqual(1);
      expect(await select.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    }
  }
});
test('[UI-02-EVIDENCE] capture actual served Documents and Preferences states', async ({ page }) => {
  await mkdir('reports/iteration-two/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 }); await open(page);
  for (const width of [1920, 480]) for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.__SHELL_TEST__.leafWidth(value), width); await page.locator(`#theme-${theme}`).click();
    for (const panel of ['Documents', 'Preferences']) {
      await primary(page).getByRole('button', { name: panel, exact: true }).click();
      if (panel === 'Documents') {
        await primary(page).getByRole('textbox', { name: 'Title' }).fill('Prepare the Iteration 02 release');
        await primary(page).getByRole('button', { name: 'Preview Markdown', exact: true }).click();
      }
      for (const hidden of [false, true]) {
        await page.evaluate(value => window.__SHELL_TEST__.setPreferences({ hideObsidianViewHeader: value }), hidden);
        await primary(page).screenshot({ path: `reports/iteration-two/screenshots/harness-${panel.toLowerCase()}-${width}-${theme}-header-${hidden ? 'hidden' : 'shown'}.png` });
      }
    }
  }
});
