import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from '@playwright/test';
import { applyTheme, launchBrowser, shoot, withPage } from './gallery-browser.ts';
import { STATES, type GalleryJob, type Surface, type Variant } from './gallery-matrix.ts';
import type { CaptureSession } from './gallery-run.ts';

const SURFACE = '#clickdummy-surface', STATE = '#clickdummy-state', SCENARIO = '#clickdummy-scenario';
const noScenario: Variant = { state: 'default', scenario: null };

async function values(page: Page, selector: string): Promise<Array<{ value: string; label: string }>> {
  const options = page.locator(`${selector} option`), count = await options.count(), found = [];
  for (let index = 0; index < count; index++) {
    const option = options.nth(index);
    found.push({ value: (await option.getAttribute('value')) ?? '', label: ((await option.textContent()) ?? '').trim() });
  }
  return found;
}
/** Opens one surface through its hash address, the clickdummy's own navigation contract. */
async function openSurface(page: Page, url: string, id: string): Promise<void> {
  await page.goto(`${url}#surface=${encodeURIComponent(id)}`);
  await page.waitForSelector('html[data-prototype-ready="true"]');
  await page.waitForFunction(`document.querySelector(${JSON.stringify(SURFACE)}).value === ${JSON.stringify(id)}`);
}
async function scenarioVariants(page: Page): Promise<Variant[]> {
  const variants: Variant[] = [];
  for (const scenario of (await values(page, SCENARIO)).filter(option => option.value !== '')) {
    await page.selectOption(SCENARIO, scenario.value);
    variants.push({ state: await page.inputValue(STATE), scenario: scenario.value });
  }
  await page.selectOption(SCENARIO, '');
  return variants;
}
/** Editor surfaces disable the state picker, so only their default state is real. */
async function stateVariants(page: Page): Promise<Variant[]> {
  if (await page.locator(STATE).isDisabled()) return [noScenario];
  return STATES.map(state => ({ state, scenario: null }));
}
async function discover(browser: Browser, url: string): Promise<Surface[]> {
  return withPage(browser, 'light', 1280, async page => {
    await page.goto(url);
    await page.waitForSelector('html[data-prototype-ready="true"]');
    const surfaces: Surface[] = [];
    for (const surface of await values(page, SURFACE)) {
      await openSurface(page, url, surface.value);
      const variants = [...await stateVariants(page), ...await scenarioVariants(page)];
      surfaces.push({ id: surface.value, label: surface.label, variants });
    }
    return surfaces;
  });
}
async function select(page: Page, job: GalleryJob): Promise<void> {
  if (job.scenario !== null) await page.selectOption(SCENARIO, job.scenario);
  else if (job.state !== 'default') await page.selectOption(STATE, job.state);
}
/** A built clickdummy.html opened from disk; the state picker and scenario selector choose each variant. */
export async function clickdummySession(root: string, input: string): Promise<CaptureSession> {
  const file = resolve(root, input);
  try { await access(file); } catch { throw new Error(`GALLERY_CLICKDUMMY_MISSING: ${input} not found; run npm run build:clickdummy first.`); }
  const url = pathToFileURL(file).href, browser = await launchBrowser(root);
  return {
    surfaces: () => discover(browser, url),
    capture: (job: GalleryJob) => withPage(browser, job.theme, job.width, async page => {
      await openSurface(page, url, job.surfaceId);
      await applyTheme(page, job.theme);
      await select(page, job);
      return shoot(page);
    }),
    close: () => browser.close(),
  };
}
