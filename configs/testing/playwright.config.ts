import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { resolveBrowserExecutable } from '../../scripts/testing/browser-executable.mjs';
// Paths resolve from the project root, not from this config's folder.
const root = fileURLToPath(new URL('../../', import.meta.url));
// SHELL_CHROMIUM is the only browser override. A mismatched Chromium revision is reported, never picked up silently.
const browser = resolveBrowserExecutable({ root });
if (browser.reason === 'override-missing') throw new Error(`BROWSER_UNAVAILABLE: ${browser.hint}`);
if (browser.status === 'revision-mismatch') console.warn(`[playwright] ${browser.hint}`);
export default defineConfig({
  testDir: `${root}tests/e2e`, fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
  reporter: [['list'], ['json', { outputFile: `${root}reports/e2e/results.json` }], ['html', { outputFolder: `${root}reports/e2e/html`, open: 'never' }]],
  outputDir: `${root}reports/e2e/artifacts`,
  use: { baseURL: 'http://127.0.0.1:4180', browserName: 'chromium', locale: 'en-US', timezoneId: 'Europe/Berlin', viewport: { width: 1360, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: browser.status === 'override' ? { executablePath: browser.executablePath } : {},
  },
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --config configs/bundling/vite.harness.config.mjs --host 127.0.0.1 --port 4180 --strictPort`, url: 'http://127.0.0.1:4180/harness/app/', reuseExistingServer: false, timeout: 30000, cwd: root },
});
