import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Browser, Page } from '@playwright/test';
import { applyTheme, launchBrowser, shoot, withPage } from './gallery-browser.ts';
import { slugify, type GalleryJob, type Surface } from './gallery-matrix.ts';
import type { CaptureSession } from './gallery-run.ts';

const run = promisify(execFile);
const config = 'configs/bundling/vite.harness.config.mjs';
const vite = 'node_modules/vite/bin/vite.js';
const built = 'dist-harness/harness/app/index.html';
const NAV = '[data-leaf="primary"] .shell-nav button';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('GALLERY_PORT'))));
    });
  });
}
async function ensureBuilt(root: string): Promise<void> {
  try { await access(join(root, built)); return; } catch { /* build below */ }
  await run(process.execPath, [vite, 'build', '--config', config], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
}
async function waitUntilServed(url: string, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('GALLERY_SERVER: the harness preview server exited early.');
    try { if ((await fetch(url)).ok) return; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('GALLERY_SERVER: the harness preview server did not become ready.');
}
async function open(page: Page, base: string): Promise<void> {
  await page.goto(`${base}/harness/app/`);
  await page.waitForSelector('html[data-ready="true"]');
}
async function discover(browser: Browser, base: string): Promise<Surface[]> {
  const labels = await withPage(browser, 'light', 1280, async page => { await open(page, base); return (await page.locator(NAV).allTextContents()).map(text => text.trim()); });
  return labels.map(label => ({ id: slugify(label), label, variants: [{ state: 'default', scenario: null }] }));
}
/** The served harness: one page per navigation button, default state, no authored scenarios. */
export async function harnessSession(root: string): Promise<CaptureSession> {
  await ensureBuilt(root);
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [vite, 'preview', '--config', config, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser: Browser | undefined;
  try {
    await waitUntilServed(`${base}/harness/app/`, server);
    browser = await launchBrowser(root);
  } catch (error) { server.kill(); throw error; }
  const opened = browser;
  return {
    surfaces: () => discover(opened, base),
    capture: (job: GalleryJob) => withPage(opened, job.theme, job.width, async page => {
      await open(page, base);
      await applyTheme(page, job.theme);
      await page.locator('[data-leaf="primary"] .shell-nav').getByRole('button', { name: job.surfaceLabel, exact: true }).click();
      return shoot(page);
    }),
    async close() { try { await opened.close(); } finally { server.kill(); } },
  };
}
