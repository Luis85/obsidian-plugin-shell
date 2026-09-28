/** Real browser smoke for a generated static Storybook. No external network or native host access. */
import { createServer } from 'node:http';
import { readFile, writeFile, realpath, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const target = await realpath(process.argv[2]), output = await realpath(process.argv[3]);
const root = await realpath(join(target, 'storybook/storybook-static'));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = await realpath(resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw Error('outside static files');
    response.setHeader('Content-Type', types[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
const report = { schemaVersion: 1, status: 'failed', assertions: [], errors: [], externalRequests: [] };
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== base) { report.externalRequests.push(route.request().url()); await route.abort(); }
    else await route.continue();
  });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(join(target, 'design/storybook.json'), 'utf8'));
  const subject = inventory.stories.find(item => item.entityId === 'vc-1'); assert.ok(subject);
  const prefix = 'generated-component-project-json-review--';
  assert.ok(index.entries[prefix + 'default']); report.assertions.push('Generated component indexed');
  assert.ok(Object.values(index.entries).some(item => item.title.startsWith('Pages/'))); report.assertions.push('Generated pages indexed');
  async function open(id, query = '') {
    await page.goto(base + '/iframe.html?id=' + id + '&viewMode=story' + query);
    await page.locator('[data-story-host] [data-design-document]').waitFor();
    assert.equal(await page.locator('#error-message').isVisible(), false);
  }
  await open(prefix + 'default'); report.assertions.push('Real generated Vue mounted with its isolated project context');
  await open(prefix + 'empty'); assert.equal(await page.locator('[data-design-state]').first().getAttribute('data-design-state'), 'empty');
  report.assertions.push('Empty state rendered');
  const scenario = Object.values(index.entries).find(item => item.id.startsWith(prefix + 'scenario'));
  assert.ok(scenario); await open(scenario.id);
  assert.equal(await page.locator('[data-story-host]').evaluate(el => getComputedStyle(el).maxWidth), '360px');
  report.assertions.push('Authored narrow scenario rendered');
  await open(prefix + 'default', '&globals=theme:dark');
  await page.locator('[data-story-host].theme-dark').waitFor(); report.assertions.push('Theme selection applied');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []);
  report.status = 'passed';
} finally {
  await writeFile(join(output, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  try { await browser?.close(); } finally { await new Promise(resolve => server.close(resolve)); }
}
