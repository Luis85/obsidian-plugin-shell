/** Explicit browser qualification of an already built optional generated Storybook. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, extname, join } from 'node:path';
import { chromium } from '@playwright/test';

const project = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/compiler/verify-storybook.mjs <generated-project>');
const root = join(project, 'reports/storybook-static');
const output = resolve('reports/storybook'); await mkdir(output, { recursive: true });
const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter(entry => entry.type === 'story');
assert.ok(stories.length > 0, 'The built Storybook must index generated stories');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const path = relative(root, file);
    if (path === '..' || path.startsWith('..' + sep)) { response.writeHead(403); response.end(); return; }
    const bytes = await readFile(file); response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream'); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
const address = server.address(); assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
let browser;
const report = { status: 'failed', indexedStories: stories.length, checked: [], runtimeErrors: [], remoteRequests: [], nativeAcceptance: 'not-run' };
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => report.runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.runtimeErrors.push(message.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    report.remoteRequests.push(url); return route.abort();
  });
  const selected = [
    stories.find(entry => entry.id.startsWith('generated-pages-visual-') && entry.name === 'Default'),
    stories.find(entry => entry.id.startsWith('generated-components-visual-') && entry.name === 'Default'),
    stories.find(entry => entry.id.startsWith('generated-components-visual-') && entry.name === 'Loading'),
    stories.find(entry => entry.id.includes('--scenario-')),
  ].filter(Boolean);
  assert.ok(selected.length >= 3, 'Fixture needs page, component and state coverage');
  for (const story of selected) {
    await page.goto(`${origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
    await page.locator('[data-storybook-preview="synthetic"]').waitFor({ state: 'visible' });
    await page.locator('[data-design-document]').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('[role="status"]').filter({ hasText: 'Preview error:' }).count(), 0);
    if (story.name === 'Loading') assert.equal(await page.locator('[data-design-document]').first().getAttribute('data-design-state'), 'loading');
    report.checked.push({ id: story.id, name: story.name });
  }
  await page.screenshot({ path: join(output, 'generated-story.png'), fullPage: true });
  assert.deepEqual(report.runtimeErrors, []); assert.deepEqual(report.remoteRequests, []);
  report.status = 'passed';
} finally {
  await browser?.close(); await new Promise(done => server.close(done));
  await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
