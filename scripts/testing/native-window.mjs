import { spawnSync } from 'node:child_process';
import { expect } from '@playwright/test';
/** Only used in the fresh isolated Xvfb display, before any secondary native windows open. */
export async function sizeNativeWindow(page) {
  let inventory = [];
  if (process.platform === 'linux') {
    const options = { encoding: 'utf8', timeout: 15000 };
    const title = await page.title();
    const probe = args => {
      const result = spawnSync('xdotool', args, options);
      if (result.error) throw result.error;
      return result.status === 0 ? result.stdout.trim() : '';
    };
    let candidates = [];
    // DOM readiness does not imply that the native window is mapped yet. Observe real titles,
    // not an assumed WM_CLASS; the packaged host may use a versioned executable class name.
    await expect.poll(() => {
      const ids = probe(['search', '--maxdepth', '1', '--name', '.*']).split(/\s+/).filter(id => /^\d+$/.test(id));
      inventory = ids.map(id => ({ id, title: probe(['getwindowname', id]) }));
      candidates = inventory.filter(item => /obsidian/i.test(item.title) || (title && item.title === title));
      return candidates.length;
    }, { timeout: 15000, message: 'Exactly one native Obsidian window must be identified in the isolated display' }).toBe(1);
    const resized = spawnSync('xdotool', ['windowsize', '--sync', candidates[0].id, '1920', '1080'], options);
    if (resized.error || resized.status !== 0) throw new Error(`NATIVE_WINDOW_RESIZE_FAILED: ${resized.error?.message ?? resized.stderr}`);
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeGreaterThanOrEqual(1900);
  }
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio }));
  return { ...dimensions, inventory, mode: 'actual-native-window-not-browser-viewport-emulation' };
}
