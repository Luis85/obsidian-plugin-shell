/** Actual served consumer output, not the repository harness or source-text assertions. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
async function serve(root) {
  const server = createServer((request, response) => {
    void (async () => {
      if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let file = resolve(root, '.' + path);
      assert.ok(file === root || file.startsWith(root + sep), 'Contained static path required.');
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    })().catch(() => { response.writeHead(404); response.end('Not found'); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done, reject) => server.close(error => error ? reject(error) : done())) };
}
async function checkSurface(browser, origin, target, frontend, javascript) {
  const context = await browser.newContext({ javaScriptEnabled: javascript });
  const failures = [], page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    failures.push('External request: ' + route.request().url()); return route.abort();
  });
  try {
    assert.equal((await page.goto(origin)).status(), 200);
    if (target === 'webapp') {
      await page.waitForFunction(() => ['true', 'failed'].includes(document.documentElement.dataset.prototypeReady));
      assert.equal(await page.evaluate(() => document.documentElement.dataset.prototypeReady), 'true', failures.join('\n'));
      await page.getByRole('button', { name: 'Issues', exact: true }).click();
      await page.getByRole('heading', { name: 'Issues', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    } else {
      await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Issues', exact: true }).click();
      await page.getByRole('heading', { name: 'Issues', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Overview', exact: true }).click();
      await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
      if (javascript && frontend === 'nuxt-ui') {
        await page.getByRole('button', { name: 'Try interaction', exact: true }).click();
        assert.equal(await page.getByRole('status').textContent(), 'Demonstration count: 1');
        await page.getByRole('button', { name: 'Reset', exact: true }).click();
        assert.equal(await page.getByRole('status').textContent(), 'Demonstration count: 0');
      }
    }
    assert.deepEqual(failures, []);
  } catch (error) {
    throw new Error(`${target}/${frontend}: ${error.message}; browser diagnostics: ${failures.join('; ') || 'none'}`, { cause: error });
  } finally { await context.close(); }
}
export async function verifyPresetBrowser(source, selection) {
  const targets = selection.targets.filter(target => target === 'webapp' || target === 'website');
  if (!targets.length) return { scope: 'no-browser-target' };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of targets) {
      const server = await serve(resolve(source, 'dist', target));
      try {
        await checkSurface(browser, server.origin, target, selection.frontend, true);
        if (target === 'website') await checkSurface(browser, server.origin, target, selection.frontend, false);
      } finally { await server.close(); }
    }
  } finally { await browser.close(); }
  return { scope: 'served-generated-output', targets, status: 'passed', native: 'not-run' };
}
