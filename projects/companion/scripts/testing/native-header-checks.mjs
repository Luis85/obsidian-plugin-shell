import { noteNativePhase } from './native-diagnostic-observer.mjs';
import { expect } from '@playwright/test';
import { join } from 'node:path';
import { nativeCommand as command } from './native-command.mjs';
import { setNativeTheme } from './native-theme.mjs';
export async function assertDiagnostics(page, identity) {
  const entries = await page.evaluate(id => window.app.plugins.plugins[id]?.runtime?.diagnosticSnapshot(), identity.id);
  expect(entries, 'Independent native application diagnostics must be available').toBeDefined();
  expect(entries).toEqual([]);
}
export async function qualifyHeaders(page, context, report, output, notePath, identity) {
  noteNativePhase(report, 'native-headers');
  const view = identity.viewSelector; const marker = identity.headerMarker;
  const owned = page.locator(view).first();
  await owned.getByRole('button', { name: 'Preferences', exact: true }).click();
  const header = owned.locator(':scope > .view-header');
  await expect(header).toBeVisible();
  await expect(header).toContainText(identity.name);
  report.headerContract = await header.evaluate(el => ({ tag: el.tagName, classes: el.className, ownerType: el.parentElement.dataset.type }));
  const tabs = await page.locator('.workspace-tabs').count();
  const controls = await page.locator('.titlebar-button').count();
  await page.screenshot({ path: join(output, 'native-preferences-header-shown.png') });
  // Persistence deliberately keeps this controlled input unchanged until the write commits.
  // Playwright check() assumes a synchronous mutation; click once, then await the real state.
  const headerToggle = owned.getByRole('checkbox', { name: 'Hide Obsidian view header', exact: true });
  await headerToggle.click(); await expect(headerToggle).toBeChecked();
  await expect(header).toBeHidden();
  await expect(owned.locator('.shell-header')).toBeVisible();
  expect(await page.locator('.workspace-tabs').count()).toBe(tabs);
  expect(await page.locator('.titlebar-button').count()).toBe(controls);
  await page.screenshot({ path: join(output, 'native-preferences-header-hidden.png') });
  report.checks.push('native-exact-title-row-hidden-not-tabs-or-window-controls');
  // A real unrelated Markdown leaf: no synthetic frame or HTML substitute.
  await page.evaluate(async path => {
    const app = window.app; const file = app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error('MISSING_CREATED_NOTE');
    await app.workspace.getLeaf('split').openFile(file);
  }, notePath);
  const foreign = page.locator('.workspace-leaf-content[data-type="markdown"]').filter({ has: page.locator('.view-header:visible') }).first();
  await expect(foreign).toBeVisible();
  const foreignStyles = () => foreign.evaluate(el => {
    const h = el.querySelector(':scope > .view-header'); const button = h.querySelector('.clickable-icon');
    return { header: getComputedStyle(h).display, height: h.getBoundingClientRect().height,
      button: button ? { font: getComputedStyle(button).fontSize, color: getComputedStyle(button).color } : null };
  });
  const before = await foreignStyles();
  await owned.getByRole('button', { name: 'View actions', exact: true }).click();
  await expect(page.locator('.menu:visible')).toBeVisible();
  await page.locator('.menu-item').filter({ hasText: 'Open showcase in a split' }).click();
  await expect(page.locator(view)).toHaveCount(2);
  await expect(page.locator(`${view} > .view-header:visible`)).toHaveCount(0);
  report.checks.push('native-essential-actions-accessible-and-new-leaf-inherits-hidden');
  for (let i = 0; i < 6; i++) {
    await command(page, 'Toggle Obsidian view header');
    await expect(page.locator(`${view} > .view-header:visible`)).toHaveCount(i % 2 === 0 ? 2 : 0);
    expect(await foreignStyles()).toEqual(before);
  }
  report.checks.push('native-command-palette-repeat-toggle-all-leaves-foreign-isolation');
  noteNativePhase(report, 'theme-transitions');
  report.themeTransitions = [];
  // Native host stylesheet transitions; each leaf retains its independent view state.
  for (const theme of ['dark', 'light']) {
    await setNativeTheme(page, context, theme, output);
    await expect(page.locator('body')).toHaveClass(new RegExp(`(?:^|\\s)theme-${theme}(?:\\s|$)`));
    for (const root of await page.locator(`${view} [data-plugin-ui]`).all()) await expect(root).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:\\s|$)`));
    report.themeTransitions.push(await page.evaluate(target => ({ target, bodyClass: document.body.className.slice(0, 2048),
      roots: Array.from(document.querySelectorAll('[data-plugin-ui]')).slice(0, 16).map(root => ({ className: String(root.className).slice(0, 2048), connected: root.isConnected,
        ownerIsCurrentDocument: root.ownerDocument === document, ownerBodyClass: root.ownerDocument.body?.className.slice(0, 2048) })) }), theme));
    await page.screenshot({ path: join(output, `native-split-preferences-${theme}.png`) });
  }
  await setNativeTheme(page, context, 'dark', output);
  report.checks.push('native-split-pane-light-dark-theme-transition');
  for (const factor of [1.25, 1.5]) {
    await page.evaluate(value => window.require('electron').webFrame.setZoomFactor(value), factor);
    await expect.poll(() => page.evaluate(() => window.require('electron').webFrame.getZoomFactor())).toBeCloseTo(factor, 2);
    await expect.poll(() => owned.locator('.shell-main').evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBe(true);
    const select = owned.getByLabel('Language', { exact: true });
    await select.scrollIntoViewIfNeeded(); await expect(select).toBeVisible();
    expect(await select.evaluate(el => { const s = getComputedStyle(el); return el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) >= parseFloat(s.lineHeight) - 1; })).toBe(true);
    await page.screenshot({ path: join(output, `native-preferences-zoom-${Math.round(factor * 100)}.png`) });
  }
  await page.evaluate(() => window.require('electron').webFrame.setZoomFactor(1));
  report.checks.push('native-electron-125-150-percent-zoom-no-clipped-language-control');
  noteNativePhase(report, 'popout-create');
  // The host may move this exact ItemView into another document rather than remount.
  const pagesBefore = new Set(context.pages());
  await owned.getByRole('button', { name: 'View actions', exact: true }).click();
  await page.locator('.menu-item').filter({ hasText: 'Move view to new window' }).click();
  let popout;
  await expect.poll(async () => {
    popout = context.pages().find(candidate => !pagesBefore.has(candidate));
    return !!popout && await popout.locator(view).count() === 1;
  }, { timeout: 15000 }).toBe(true);
  await expect(popout.locator(`${view} > .view-header`)).toBeHidden();
  noteNativePhase(report, 'popout-toggle');
  await popout.screenshot({ path: join(output, 'native-popout-created.png') });
  await command(page, 'Toggle Obsidian view header');
  await expect(popout.locator(`${view} > .view-header`)).toBeVisible();
  await command(page, 'Toggle Obsidian view header');
  await expect(popout.locator(`${view} > .view-header`)).toBeHidden();
  noteNativePhase(report, 'popout-theme');
  await setNativeTheme(popout, context, 'light', output);
  await expect(popout.locator(`${view} [data-plugin-ui]`)).toHaveClass(/(?:^|\s)light(?:\s|$)/);
  await setNativeTheme(popout, context, 'dark', output);
  await expect(popout.locator(`${view} [data-plugin-ui]`)).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  await popout.screenshot({ path: join(output, 'native-popout-header-hidden.png') });
  await assertDiagnostics(page, identity);
  report.checks.push('native-popout-inherits-preference-and-live-toggle');
  noteNativePhase(report, 'popout-close');
  // Close by the actual owned view menu; its cleanup must not affect the other view.
  await popout.getByRole('button', { name: 'View actions', exact: true }).click();
  await popout.locator('.menu-item').filter({ hasText: 'Close this view' }).click();
  await expect(page.locator(`${view} > .view-header:visible`)).toHaveCount(0);
  await assertDiagnostics(page, identity);
  // Compare foreign controls within the same theme, not across a legitimate host theme change.
  const beforeUnload = await foreignStyles();
  noteNativePhase(report, 'plugin-unload');
  // Record references before unload because Obsidian itself may replace view objects.
  const captured = await page.evaluate(({ selector, marker }) => {
    window.__ownedHeadersBeforeUnload = Array.from(document.querySelectorAll(selector));
    return { count: window.__ownedHeadersBeforeUnload.length, hidden: window.__ownedHeadersBeforeUnload.every(el => el.classList.contains(marker)) };
  }, { selector: view, marker });
  expect(captured.count).toBeGreaterThan(0); expect(captured.hidden).toBe(true);
  await page.evaluate(async id => window.app.plugins.disablePlugin(id), identity.id);
  expect(await page.evaluate(name => window.__ownedHeadersBeforeUnload.every(el => !el.classList.contains(name)), marker)).toBe(true);
  expect(await foreignStyles()).toEqual(beforeUnload);
  report.checks.push('native-unload-restores-retained-host-elements-without-foreign-mutation');
  await page.evaluate(async id => window.app.plugins.enablePlugin(id), identity.id);
  await command(page, 'Open capability showcase');
  await expect(page.locator(`${view} > .view-header:visible`)).toHaveCount(0);
  await assertDiagnostics(page, identity);
  report.checks.push('native-runtime-reload-restores-persisted-hidden-preference');
}
