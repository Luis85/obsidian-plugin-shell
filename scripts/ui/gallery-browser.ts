import type { Browser, Page } from '@playwright/test';
import { chromiumLaunchOptions } from '../testing/browser-executable.mjs';
import type { Theme, Width } from './gallery-matrix.ts';

const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}';
/** Chromium from `SHELL_CHROMIUM` when set, otherwise the pinned Playwright browser. Never downloads one. */
export async function launchBrowser(root: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<Browser> {
  const { chromium } = await import('@playwright/test');
  return chromium.launch({ headless: true, ...chromiumLaunchOptions({ root, env }) });
}
/** Runs one task on a fresh page with fixed locale, time zone, scale, reduced motion and color scheme. */
export async function withPage<T>(browser: Browser, theme: Theme, width: Width, task: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({
    viewport: { width, height: 1400 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Europe/Berlin',
    colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  try { return await task(await context.newPage()); } finally { await context.close(); }
}
/** Waits for network idle, fonts and two animation frames, then freezes any remaining motion. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate('document.fonts.ready.then(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))');
}
/** Applies the host-style theme classes both the harness and the clickdummy use. */
export async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add(${JSON.stringify(`theme-${theme}`)})`);
}
export async function shoot(page: Page): Promise<Uint8Array> {
  await settle(page);
  return page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', type: 'png' });
}
