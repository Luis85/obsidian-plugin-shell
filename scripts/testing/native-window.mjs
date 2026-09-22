import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';
/** Resize the real window in the isolated Xvfb display; Electron omits Chrome's Browser CDP domain. */
export async function sizeNativeWindow(page) {
  if (process.platform === 'linux') {
    const options = { encoding: 'utf8', timeout: 15000 };
    const ids = execFileSync('xdotool', ['search', '--onlyvisible', '--class', '^obsidian$'], options).trim().split(/\s+/);
    if (ids.length !== 1 || !/^\d+$/.test(ids[0])) throw new Error('NATIVE_WINDOW_TARGET_AMBIGUOUS');
    execFileSync('xdotool', ['windowsize', '--sync', ids[0], '1920', '1080'], options);
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeGreaterThanOrEqual(1900);
  }
  return page.evaluate(() => ({ width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio,
    mode: 'actual-native-window-not-browser-viewport-emulation' }));
}
