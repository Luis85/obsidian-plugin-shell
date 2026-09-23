import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'reports/e2e/results.json' }], ['html', { outputFolder: 'reports/e2e/html', open: 'never' }]],
  outputDir: 'reports/e2e/artifacts',
  use: { baseURL: 'http://127.0.0.1:4180', browserName: 'chromium', locale: 'en-US', timezoneId: 'Europe/Berlin', viewport: { width: 1360, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.SHELL_CHROMIUM ? { executablePath: process.env.SHELL_CHROMIUM } : {},
  },
  webServer: { command: `"${process.execPath}" node_modules/vite/bin/vite.js preview --config vite.harness.config.mjs --host 127.0.0.1 --port 4180 --strictPort`, url: 'http://127.0.0.1:4180/harness/app/', reuseExistingServer: false, timeout: 30000 },
});
