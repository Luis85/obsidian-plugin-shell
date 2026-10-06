/** Browser-backed test workflow runs: real headless Chromium through scripts/testing/browser-executable.mjs, real loopback serving. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { test } from 'node:test';
import { chromiumLaunchOptions, resolveBrowserExecutable } from '../../src/cli/tooling/testing/browser-executable.mjs';
import { testWorkflowCommand } from '../../src/cli/adapters/test-workflow-command.ts';
import { previewAssets } from '../../src/cli/adapters/first-run-preview.ts';
import { serveTestWorkflowAssets } from '../../src/cli/adapters/test-workflow-serve.ts';
const repository = resolve(import.meta.dirname, '../..'), fixture = 'tests/fixtures/workflows/sign-up';
const resolution = resolveBrowserExecutable({ root: repository });
assert.ok(['pinned', 'override'].includes(resolution.status), `This suite needs the chromium prerequisite: ${resolution.hint}`);
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'workflow-browser-'));
  try {
    await mkdir(join(root, 'configs/tests/workflows'), { recursive: true });
    await cp(join(repository, fixture), join(root, fixture), { recursive: true });
    await cp(join(repository, 'configs/tests/workflows/sign-up.json'), join(root, 'configs/tests/workflows/sign-up.json'));
    await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const run = (root, action, flags = {}) => testWorkflowCommand({ command: 'workflow', action, flags }, { root, frameworkRoot: repository });
const statuses = report => report.steps.map(step => step.status);

test('the shipped sign-up workflow passes against its offline fixture and its result can be recorded', async () => scratch(async root => {
  const result = await run(root, 'run', { name: 'sign-up' });
  assert.equal(result.status, 'ok', JSON.stringify(result.report.steps.find(step => step.status === 'failed')));
  assert.deepEqual(statuses(result.report), Array(18).fill('passed'));
  const folder = `reports/workflows/sign-up/${result.report.runId}`;
  assert.deepEqual(result.report.screenshots.map(item => [item.step, item.name, item.path, item.caption]), [
    [11, 'sign-up-filled', `${folder}/screenshots/sign-up-filled.png`, 'The completed form before submitting; the email is masked.'],
    [17, 'welcome-greeting', `${folder}/screenshots/welcome-greeting.png`, 'The welcome page content for the seeded customer.']]);
  assert.deepEqual(result.screenshots, result.report.screenshots.map(item => item.path));
  for (const shot of result.report.screenshots) {
    const bytes = await readFile(join(root, shot.path));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${shot.name} is a PNG`);
    assert.ok(bytes.length > 1000 && bytes.length === shot.bytes, `${shot.name} is non-empty and matches the report`);
    assert.equal(shot.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.match(shot.browser, resolution.status === 'pinned' ? /^pinned Playwright Chromium revision \d+, version [0-9.]+$/ : /^non-pinned Chromium \(SHELL_CHROMIUM override\); Playwright [0-9.]+ expects revision \d+, version [0-9.]+$/);
  }
  assert.ok(result.reports.includes(`${folder}/report.json`) && result.reports.includes('reports/workflows/sign-up/latest.json'));
  assert.deepEqual([result.report.blockedRequests, result.report.pageErrors], [[], []]);
  assert.match(result.report.target.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.match(result.report.evidence, resolution.status === 'pinned' ? /^headless pinned Playwright Chromium/ : /^headless non-pinned Chromium \(SHELL_CHROMIUM override\)/);
  assert.ok(result.report.steps.every(step => Number.isInteger(step.durationMs) && step.durationMs >= 0));
  const planned = await run(root, 'record', { name: 'sign-up' });
  assert.equal(planned.run.result, 'passed');
  assert.match(planned.run.summary, /^18\/18 steps passed in \d+ ms with Chromium [0-9.]+ \((?:pinned Playwright revision|non-pinned SHELL_CHROMIUM override)\)\.$/);
  assert.deepEqual(planned.run.screenshots, result.screenshots);
}));

test('a failing locator stops the run at that step, names it, and remote requests are blocked and listed', async () => scratch(async root => {
  await writeFile(join(root, fixture, 'remote.html'), '<!doctype html><title>Remote</title><img src="https://example.invalid/pixel.png" alt="remote pixel"><h1>Remote</h1>');
  await writeFile(join(root, 'configs/tests/workflows/broken.json'), JSON.stringify({ schemaVersion: 1, id: 'broken', title: 'Broken', purpose: 'Fails on purpose.', status: 'draft',
    target: { kind: 'static', folder: fixture }, timeoutMs: 700, steps: [{ kind: 'goto', path: '/remote.html' }, { kind: 'expectVisible', target: { role: 'heading', name: 'Remote' } },
      { kind: 'click', target: { role: 'button', name: 'Does not exist' } }, { kind: 'expectTitle', text: 'Remote' }] }));
  const result = await run(root, 'run', { name: 'broken' });
  assert.equal(result.status, 'failed');
  assert.deepEqual(statuses(result.report), ['passed', 'passed', 'failed', 'not-run']);
  const failed = result.report.steps[2];
  assert.equal(failed.locator, 'button "Does not exist"');
  assert.match(failed.error, /Timeout 700ms exceeded|getByRole\('button', \{ name: 'Does not exist' \}\)/);
  assert.ok(failed.durationMs >= 600, `the step timeout applied (${failed.durationMs} ms)`);
  assert.deepEqual(result.report.blockedRequests, ['https://example.invalid/pixel.png']);
}));

test('a masked screenshot paints the masked element over, and screenshots are never compared', async () => scratch(async root => {
  await writeFile(join(root, fixture, 'secret.html'), '<!doctype html><title>Secret</title><p data-testid="secret" style="font-size:40px;padding:20px;background:#fff;color:#000">Secret 123</p>');
  await writeFile(join(root, 'configs/tests/workflows/masked.json'), JSON.stringify({ schemaVersion: 1, id: 'masked', title: 'Masked', purpose: 'Masks dynamic data.', status: 'draft',
    target: { kind: 'static', folder: fixture }, steps: [{ kind: 'goto', path: '/secret.html' }, { kind: 'screenshot', name: 'plain', target: { testId: 'secret' } },
      { kind: 'screenshot', name: 'masked', target: { testId: 'secret' }, mask: [{ testId: 'secret' }] }, { kind: 'screenshot', name: 'page', fullPage: true, mask: [{ text: 'Secret 123' }] }] }));
  const result = await run(root, 'run', { name: 'masked' });
  assert.equal(result.status, 'ok');
  const [plain, masked, page] = await Promise.all(result.report.screenshots.map(shot => readFile(join(root, shot.path))));
  assert.notEqual(createHash('sha256').update(plain).digest('hex'), createHash('sha256').update(masked).digest('hex'));
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true, ...chromiumLaunchOptions({ root: repository }) });
  try {
    const viewer = await browser.newPage();
    // Test-only decoding: draw each PNG into a canvas and read its centre pixel.
    const centre = image => viewer.evaluate(async source => {
      const bitmap = await createImageBitmap(await (await fetch(source)).blob()), canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return [...context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data].slice(0, 3);
    }, `data:image/png;base64,${image.toString('base64')}`);
    assert.deepEqual(await centre(masked), [255, 0, 255], 'Playwright paints masked elements magenta');
    assert.notDeepEqual(await centre(plain), [255, 0, 255]);
    assert.ok(page.length > 0);
  } finally { await browser.close(); }
}));

test('loopback URL and prototype package targets run the same steps', async () => scratch(async root => {
  const server = await serveTestWorkflowAssets(await previewAssets(join(root, fixture)));
  try {
    const result = await run(root, 'run', { name: 'sign-up', target: server.url });
    assert.equal(result.status, 'ok');
    assert.equal(result.report.target.description, `url ${server.url}`);
  } finally { await server.close(); }
  await mkdir(join(root, 'prototypes/demo'), { recursive: true });
  await writeFile(join(root, 'prototypes/demo/prototype.manifest.json'), JSON.stringify({ kind: 'obsidian-prototype-package', artifact: { path: 'prototype.html' } }));
  await writeFile(join(root, 'prototypes/demo/prototype.html'), '<!doctype html><title>Demo prototype</title><main><h1>Board</h1><button>Add card</button></main>');
  await writeFile(join(root, 'configs/tests/workflows/prototype-smoke.json'), JSON.stringify({ ...JSON.parse(await readFile(join(repository, 'configs/tests/workflows/prototype-smoke.json'), 'utf8')), target: { kind: 'prototype', package: 'prototypes/demo' } }));
  const prototype = await run(root, 'run', { name: 'prototype-smoke' });
  assert.equal(prototype.status, 'ok', JSON.stringify(prototype.report.steps));
  assert.equal(prototype.report.target.source, 'prototypes/demo/prototype.html');
  await rm(join(root, 'prototypes/demo/prototype.html'));
  const unbuilt = await run(root, 'run', { name: 'prototype-smoke' });
  assert.deepEqual([unbuilt.status, unbuilt.report.status], ['blocked', 'not-run']);
  assert.match(unbuilt.report.reason, /^target-unavailable: prototypes\/demo\/prototype\.html is not built yet/);
}));

test('the exported @playwright/test spec passes in the Playwright test runner against the same fixture', async () => scratch(async root => {
  await run(root, 'export', { name: 'sign-up', out: 'e2e', apply: (await run(root, 'export', { name: 'sign-up', out: 'e2e' })).planHash });
  const folder = join(repository, 'reports/workflow-browser-check', randomUUID());
  const server = await serveTestWorkflowAssets(await previewAssets(join(root, fixture)));
  try {
    await mkdir(folder, { recursive: true });
    await cp(join(root, 'e2e/sign-up.workflow.spec.ts'), join(folder, 'sign-up.workflow.spec.ts'));
    const use = { baseURL: server.url, headless: true, launchOptions: chromiumLaunchOptions({ root: repository }) };
    await writeFile(join(folder, 'playwright.config.mjs'), `export default ${JSON.stringify({ testDir: '.', testMatch: '*.workflow.spec.ts', workers: 1, reporter: 'line', outputDir: 'results', use })};\n`);
    // The runner is a child process; it must not block this process, which serves the fixture.
    const result = await new Promise(done => execFile(process.execPath, [join(repository, 'node_modules/@playwright/test/cli.js'), 'test', '--config', join(folder, 'playwright.config.mjs')],
      { cwd: repository, encoding: 'utf8', timeout: 120000 }, (error, stdout, stderr) => done({ status: error ? error.code ?? 1 : 0, stdout, stderr })));
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /1 passed/);
    const pngs = (await readdir(join(folder, 'results'), { recursive: true })).filter(name => name.endsWith('.png')).map(name => basename(name)).sort();
    assert.deepEqual(pngs, ['sign-up-filled.png', 'welcome-greeting.png'], 'the exported spec writes its review screenshots to the test output folder');
  } finally { await server.close(); await rm(folder, { recursive: true, force: true }); }
}));
