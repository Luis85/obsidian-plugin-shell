import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { args, need, noLinks, readBytes, readText, sha256, isMain, cli } from './lib/io.mjs';
import { checkHtml } from './lib/offline.mjs';

// Requires the package's installed runner/browser. Never provisions/downloads them.
// The journey module is trusted test code; only run reviewed packages.
export async function verifyBrowser(directory) {
  const root = noLinks(directory);
  const artifact = path.join(root, 'prototype.html');
  const bytes = readBytes(artifact);
  const staticIssues = checkHtml(readText(artifact));
  if (staticIssues.length) throw new Error(staticIssues.join('; '));
  const packageFile = path.join(root, 'source/package.json');
  readBytes(packageFile);
  const require = createRequire(pathToFileURL(packageFile));
  let runner;
  try { runner = require('@playwright/test'); }
  catch { throw new Error('BLOCKED: install the source lockfile and provision its pinned Playwright browser explicitly'); }
  const modulePath = noLinks(path.join(root, 'tests/prototype.journeys.mjs'));
  readBytes(modulePath);
  const journeys = await import(pathToFileURL(modulePath).href);
  if (typeof journeys.runJourneys !== 'function') throw new Error('Journey module must export runJourneys({page, expect})');
  let browser;
  try { browser = await runner.chromium.launch({ headless: true }); }
  catch (error) { throw new Error(`BLOCKED: pinned browser unavailable: ${error.message}`); }
  const report = { kind: 'prototype-browser-verification', schemaVersion: 1,
    artifactSha256: sha256(bytes), checks: [], status: 'failed',
    limitations: ['No companion UI import/export or native tests performed by this helper.',
      'Named journey assertions must be reviewed; generic readiness is not product acceptance.'] };
  const url = pathToFileURL(artifact).href;
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, colorScheme,
          offline: true, serviceWorkers: 'block' });
        const requests = [], errors = [];
        await context.route('**/*', route => {
          if (route.request().url() === url) return route.continue();
          requests.push(route.request().url()); return route.abort();
        });
        await context.addInitScript(() => {
          for (const key of ['localStorage', 'sessionStorage']) {
            Object.defineProperty(window, key, { configurable: true, get() {
              throw new DOMException('Denied by prototype verification', 'SecurityError');
            } });
          }
          Object.defineProperty(window, 'WebSocket', { configurable: true, value: class {
            constructor() { throw new Error('Network sockets forbidden in offline prototype'); }
          } });
        });
        const page = await context.newPage();
        page.on('request', request => {
          if (request.url() !== url && !/^(data:|blob:)/.test(request.url())) requests.push(request.url());
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error' || message.text().includes('[Vue warn]')) errors.push(message.text());
        });
        const check = { name: `${width}x${height}-${colorScheme}-offline-storage-denied`, status: 'failed', journeys: [] };
        report.checks.push(check);
        try {
          await page.goto(url);
          await runner.expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
          const encoded = await page.locator('#prototype-project-data').textContent();
          const data = JSON.parse(encoded ?? 'null');
          if (data?.encoding !== 'base64') throw new Error('Missing exact embedded project bytes');
          const decoded = Buffer.from(data.content, 'base64');
          const actual = readBytes(path.join(root, 'companion.project.json'), 4_000_000);
          if (!decoded.equals(actual) || data.sha256 !== sha256(actual)) throw new Error('Embedded and sidecar project differ');
          const names = await journeys.runJourneys({ page, expect: runner.expect });
          if (!Array.isArray(names) || !names.length || names.some(name => typeof name !== 'string' || !name.trim()) || new Set(names).size !== names.length) {
            throw new Error('Journeys must return unique nonempty names of executed assertions');
          }
          check.journeys = names;
          await runner.expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
          if (requests.length) throw new Error(`Off-file requests: ${[...new Set(requests)].join(', ')}`);
          if (errors.length) throw new Error(`Runtime errors: ${errors.join('; ')}`);
          check.status = 'passed';
        } catch (error) { check.error = error.message; }
        finally { await context.close(); }
      }
    }
    report.status = report.checks.every(check => check.status === 'passed') ? 'passed' : 'failed';
    return report;
  } finally { await browser.close(); }
}
if (isMain(import.meta.url)) cli(async () => {
  const options = args(process.argv.slice(2), ['--root'], ['--help']);
  if (options.help) return console.log('Usage: node verify-browser.mjs --root <trusted-prototype-package>');
  const report = await verifyBrowser(need(options, 'root'));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
});
