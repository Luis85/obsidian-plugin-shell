import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { testWorkflowCommand, interactiveTestWorkflow } from '../../src/cli/adapters/test-workflow-command.ts';
import { serveTestWorkflowAssets, testWorkflowServable } from '../../src/cli/adapters/test-workflow-serve.ts';
import { testWorkflowSpec } from '../../src/cli/adapters/test-workflow-export.ts';
import { readTestWorkflow, testWorkflowJson } from '../../src/cli/domain/test-workflow.ts';
import { hash } from '../../src/cli/adapters/framework/files.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'workflow-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const definition = (extra = {}) => ({ schemaVersion: 1, id: 'order', title: 'Order', purpose: 'Order one item.', status: 'active', target: { kind: 'static', folder: 'site' },
  data: { values: { size: 'M' }, fakeData: { buyer: { config: 'contacts-demo', index: 0 }, other: { entity: 'contact', seed: 7, index: 1 } } },
  steps: [{ kind: 'goto', path: '/' }, { kind: 'fill', target: { label: 'Name' }, value: '{{data.buyer.name}}' }, { kind: 'fill', target: { label: 'Friend' }, value: '{{data.other.email}}' },
    { kind: 'select', target: { label: 'Size' }, value: '{{data.size}}' }, { kind: 'expectTitle', text: 'Shop', match: 'contains' }], ...extra });
async function seed(root, value = definition()) {
  await mkdir(join(root, 'configs/tests/workflows'), { recursive: true }); await mkdir(join(root, 'site'), { recursive: true });
  if (value) await writeFile(join(root, 'configs/tests/workflows', value.id + '.json'), JSON.stringify(value));
  await writeFile(join(root, 'site/index.html'), '<!doctype html><title>Shop</title><h1>Shop</h1>');
}
const missingBrowser = { SHELL_CHROMIUM: '/nonexistent/workflow-test-chrome' };
const run = (root, action, flags = {}, env = missingBrowser) => testWorkflowCommand({ command: 'workflow', action, flags }, { root, frameworkRoot, env });
const applied = async (root, action, flags = {}) => run(root, action, { ...flags, apply: (await run(root, action, flags)).planHash });

test('list, show and check report each workflow on its own, with resolved seeded test data', async () => scratch(async root => {
  await seed(root);
  await writeFile(join(root, 'configs/tests/workflows/broken.json'), '{"schemaVersion":1,"id":"broken"');
  await writeFile(join(root, 'configs/tests/workflows/misnamed.json'), JSON.stringify(definition({ id: 'renamed' })));
  const list = await run(root, 'list');
  assert.deepEqual(list.workflows.map(item => [item.id, item.status, item.steps ?? null]), [['broken', 'invalid', null], ['misnamed', 'active', 5], ['order', 'active', 5]]);
  assert.equal(list.workflows[0].issues[0].code, 'WORKFLOW_INVALID');
  assert.equal(list.workflows[1].issues[0].message, 'misnamed.json must be named renamed.json.');
  assert.equal(list.status, 'failed');
  const show = await run(root, 'show', { name: 'order' }), again = await run(root, 'show', { name: 'order' });
  assert.deepEqual(show.data.map(row => row.reference), ['{{data.buyer.name}}', '{{data.other.email}}', '{{data.size}}']);
  assert.deepEqual(show.data.map(row => row.source), ['fake-data config contacts-demo, record 1', 'fake-data entity contact (seed 7), record 2', 'inline value']);
  assert.match(show.data[1].value, /@example\.(?:com|net|org)$/);
  assert.deepEqual(again.data, show.data, 'seeded records repeat exactly');
  assert.equal(show.summary.target, 'static site');
  await assert.rejects(() => run(root, 'show', { name: 'ghost' }), /Unknown workflow ghost/);
  await assert.rejects(() => run(root, 'show'), /missing --name/);
}));

test('check reports missing targets, unknown fake data, missing data values and unprobed targets', async () => scratch(async root => {
  await seed(root, definition({ target: { kind: 'static', folder: 'nowhere' }, data: { fakeData: { a: { config: 'no-such-config' }, b: { config: 'contacts-demo', index: 999 }, c: { entity: 'no-entity' } } },
    steps: [{ kind: 'goto', path: '/' }, { kind: 'fill', target: { label: 'X' }, value: '{{data.missing.value}}' }] }));
  const found = (await run(root, 'check')).workflows[0].issues.map(item => item.code);
  for (const code of ['WORKFLOW_FAKE_DATA', 'FAKE_DATA_ENTITY_UNKNOWN', 'WORKFLOW_DATA_MISSING', 'WORKFLOW_TARGET_MISSING']) assert.ok(found.includes(code), code);
  assert.equal(found.filter(code => code === 'WORKFLOW_FAKE_DATA').length, 2, 'unknown config and an index outside the config');
  await writeFile(join(root, 'configs/tests/workflows/order.json'), JSON.stringify(definition({ id: 'order', target: { kind: 'url', url: 'http://127.0.0.1:4173/' } })));
  assert.match((await run(root, 'list')).workflows[0].warnings[0], /not probed by check/);
  await writeFile(join(root, 'configs/tests/workflows/order.json'), JSON.stringify(definition({ target: { kind: 'prototype', package: 'prototypes/demo' } })));
  assert.match((await run(root, 'list')).workflows[0].warnings[0], /prototype\.manifest\.json does not exist/);
  await assert.rejects(() => run(root, 'run', { name: 'nothing' }), /Unknown workflow/);
}));

test('save writes the definition and its note together through one reviewed plan, and refuses findings', async () => scratch(async root => {
  await seed(root, null);
  await writeFile(join(root, 'input.json'), JSON.stringify(definition()));
  const planned = await run(root, 'save', { input: 'input.json' });
  assert.equal(planned.status, 'planned');
  assert.deepEqual(planned.changes.map(change => [change.path, change.status]), [['configs/tests/workflows/order.json', 'create'], ['docs/tests/workflows/order.md', 'create']]);
  await assert.rejects(() => run(root, 'save', { input: 'input.json', apply: '0'.repeat(64) }), /plan changed/);
  assert.equal((await applied(root, 'save', { input: 'input.json' })).status, 'applied');
  assert.deepEqual(readTestWorkflow(JSON.parse(await readFile(join(root, 'configs/tests/workflows/order.json'), 'utf8'))), readTestWorkflow(definition()));
  assert.equal((await run(root, 'check')).status, 'ok');
  await writeFile(join(root, 'bad.json'), JSON.stringify(definition({ target: { kind: 'static', folder: 'missing' } })));
  await assert.rejects(() => run(root, 'save', { input: 'bad.json' }), error => error.code === 'WORKFLOW_INVALID' && /missing\/index\.html does not exist/.test(error.message));
  await assert.rejects(() => run(root, 'save'), /workflow save --input/);
  await assert.rejects(() => run(root, 'launch'), error => error.code === 'WORKFLOW_COMMAND' && /workflow list/.test(error.message));
  await assert.rejects(() => run(root, 'new'), /workflow new is interactive/);
  assert.deepEqual(['', 'new', 'edit', 'run'].map(action => interactiveTestWorkflow({ command: 'workflow', action, flags: {} })), [true, true, true, false]);
}));

test('run without a usable browser reports not-run with the hint and writes the local report', async () => scratch(async root => {
  await seed(root);
  const result = await run(root, 'run', { name: 'order' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.report.status, 'not-run');
  assert.match(result.report.reason, /^browser-unavailable: SHELL_CHROMIUM points to \/nonexistent\/workflow-test-chrome/);
  assert.deepEqual(result.report.steps.map(step => step.status), ['not-run', 'not-run', 'not-run', 'not-run', 'not-run']);
  assert.equal(result.report.evidence, 'not-run: no browser evidence');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'reports/workflows/order/latest.json'), 'utf8')), result.report);
  assert.equal(result.reports.length, 2);
  await assert.rejects(() => run(root, 'record', { name: 'order' }), /not-run report has no result/);
  await assert.rejects(() => run(root, 'run', { name: 'order', target: 'https://example.com:443/' }), /loopback http URL/);
}));

test('record plans the result of a finished run into the note, only for the definition that ran', async () => scratch(async root => {
  await seed(root);
  await applied(root, 'docs', { name: 'order' });
  const digest = hash(testWorkflowJson(readTestWorkflow(definition())));
  const report = { schemaVersion: 1, workflow: 'order', definitionSha256: digest, status: 'failed', finishedAt: '2026-10-03T09:30:00.000Z', durationMs: 812,
    browser: { status: 'override', version: '141.0.7390.37' }, steps: [{ status: 'passed' }, { status: 'failed' }, { status: 'not-run' }],
    screenshots: [{ path: 'reports/workflows/order/run-2026-10-03T09-29-59-000Z/screenshots/cart.png' }] };
  await mkdir(join(root, 'reports/workflows/order'), { recursive: true });
  await writeFile(join(root, 'reports/workflows/order/latest.json'), JSON.stringify(report));
  const planned = await run(root, 'record', { name: 'order' });
  assert.deepEqual(planned.run, { result: 'failed', at: '2026-10-03T09:30:00.000Z', summary: '1/3 steps passed in 812 ms with Chromium 141.0.7390.37 (non-pinned SHELL_CHROMIUM override).', definition: digest,
    screenshots: ['reports/workflows/order/run-2026-10-03T09-29-59-000Z/screenshots/cart.png'] });
  assert.equal((await applied(root, 'record', { name: 'order' })).status, 'applied');
  const note = await readFile(join(root, 'docs/tests/workflows/order.md'), 'utf8');
  assert.ok(note.includes('lastRun: "failed"') && note.includes('Failed at 2026-10-03T09:30:00.000Z: 1/3 steps passed in 812 ms'));
  assert.ok(note.includes('lastRunScreenshots:\n  - "reports/workflows/order/run-2026-10-03T09-29-59-000Z/screenshots/cart.png"') && note.includes('- `reports/workflows/order/run-2026-10-03T09-29-59-000Z/screenshots/cart.png`'));
  assert.equal((await run(root, 'check')).status, 'ok', 'the recorded note is the expected note');
  await writeFile(join(root, 'pinned.json'), JSON.stringify({ ...report, status: 'passed', browser: { status: 'pinned', version: '142.0.1' } }));
  assert.match((await run(root, 'record', { name: 'order', input: 'pinned.json' })).run.summary, /Chromium 142\.0\.1 \(pinned Playwright revision\)/);
  for (const [change, pattern] of [[{ definitionSha256: '0'.repeat(64) }, /changed since this run/], [{ workflow: 'other' }, /belongs to workflow other/],
    [{ finishedAt: 'yesterday' }, /malformed/], [{ browser: { version: '1; rm' } }, /malformed/], [{ screenshots: [{ path: '../../etc/passwd.png' }] }, /outside its report folder/]]) {
    await writeFile(join(root, 'stale.json'), JSON.stringify({ ...report, ...change }));
    await assert.rejects(() => run(root, 'record', { name: 'order', input: 'stale.json' }), pattern, String(pattern));
  }
}));

test('export plans an equivalent @playwright/test spec with resolved literal data and no evaluated code', async () => scratch(async root => {
  await seed(root);
  const result = await run(root, 'export', { name: 'order', out: 'tests/e2e/workflows' });
  assert.deepEqual(result.changes.map(change => [change.path, change.status]), [['tests/e2e/workflows/order.workflow.spec.ts', 'create']]);
  for (const out of ['../x', '.git/x', 'node_modules/x', 'configs/x', '/abs']) await assert.rejects(() => run(root, 'export', { name: 'order', out }), /project-relative test folder/, out);
  await assert.rejects(() => run(root, 'export', { name: 'order' }), /--out/);
  const hostile = readTestWorkflow({ ...definition(), data: { values: { evil: '"); process.exit(1); ("' } },
    steps: [{ kind: 'goto', path: '/a?b=1' }, { kind: 'fill', target: { label: 'A </script>', within: { role: 'form', name: 'F' } }, value: '{{data.evil}}', timeoutMs: 900 },
      { kind: 'click', target: { role: 'button', name: 'Go', exact: true, nth: 1 } }, { kind: 'click', target: { role: 'link' } }, { kind: 'select', target: { testId: 's' }, value: 'x' },
      { kind: 'check', target: { text: 'T', exact: false } }, { kind: 'uncheck', target: { placeholder: 'P' } }, { kind: 'press', key: 'Enter' }, { kind: 'press', target: { label: 'A' }, key: 'Tab' },
      { kind: 'waitFor', target: { role: 'dialog' }, state: 'hidden' }, { kind: 'expectVisible', target: { role: 'dialog' } }, { kind: 'expectHidden', target: { role: 'alert' } },
      { kind: 'expectText', target: { role: 'heading' }, text: 'Hi', match: 'exact' }, { kind: 'expectText', target: { role: 'heading' }, text: 'H' },
      { kind: 'expectUrl', path: '/done' }, { kind: 'expectUrl', path: '/do', match: 'contains' }, { kind: 'expectTitle', text: 'a.b', match: 'contains' }, { kind: 'expectTitle', text: 'T' },
      { kind: 'expectCount', target: { role: 'row' }, count: 2 }, { kind: 'expectValue', target: { label: 'A' }, value: 'v' },
      { kind: 'screenshot', name: 'full', fullPage: true, mask: [{ testId: 'clock' }] }, { kind: 'screenshot', name: 'part', target: { role: 'main' }, timeoutMs: 800 }, { kind: 'screenshot', name: 'view' }] });
  const spec = testWorkflowSpec(hostile, { evil: '"); process.exit(1); ("' });
  for (const line of ['import { test, expect } from \'@playwright/test\';', 'await page.goto("/a?b=1", { timeout: 5000 });',
    'await page.getByRole("form", { name: "F" }).getByLabel("A \\u003c/script\\u003e").fill("\\"); process.exit(1); (\\"", { timeout: 900 });',
    'await page.getByRole("button", { name: "Go", exact: true }).nth(1).click({ timeout: 5000 });', 'await page.getByRole("link").click({ timeout: 5000 });',
    'await page.getByTestId("s").selectOption("x", { timeout: 5000 });', 'await page.getByText("T", { exact: false }).check({ timeout: 5000 });',
    'await page.getByPlaceholder("P").uncheck({ timeout: 5000 });', 'await page.keyboard.press("Enter");', 'await page.getByLabel("A").press("Tab", { timeout: 5000 });',
    'await page.getByRole("dialog").waitFor({ state: "hidden", ...{ timeout: 5000 } });', 'await expect(page.getByRole("heading")).toHaveText("Hi", { timeout: 5000 });',
    'await expect(page.getByRole("heading")).toContainText("H", { timeout: 5000 });', 'await expect(page).toHaveURL(url => url.pathname + url.search + url.hash === "/done", { timeout: 5000 });',
    'await expect(page).toHaveURL(url => (url.pathname + url.search + url.hash).includes("/do"), { timeout: 5000 });', 'await expect(page).toHaveTitle(new RegExp("a\\\\.b"), { timeout: 5000 });',
    'await expect(page).toHaveTitle("T", { timeout: 5000 });', 'await expect(page.getByRole("row")).toHaveCount(2, { timeout: 5000 });',
    'await expect(page.getByLabel("A")).toHaveValue("v", { timeout: 5000 });', 'await expect(page.getByRole("alert")).toBeHidden({ timeout: 5000 });',
    'await page.screenshot({ path: test.info().outputPath("full.png"), fullPage: true, animations: "disabled", caret: "hide", mask: [page.getByTestId("clock")], ...{ timeout: 5000 } });',
    'await page.getByRole("main").screenshot({ path: test.info().outputPath("part.png"), animations: "disabled", caret: "hide", ...{ timeout: 800 } });',
    'await page.screenshot({ path: test.info().outputPath("view.png"), fullPage: false, animations: "disabled", caret: "hide", ...{ timeout: 5000 } });',
    '// Screenshot steps save PNGs to the test output folder for human review; they are never compared with stored images.'])
    assert.ok(spec.includes(line), line);
  // Screenshots are evidence for review: the exporter never emits an image comparison or a snapshot location.
  assert.doesNotMatch(spec, /toHaveScreenshot|toMatchSnapshot|toMatchImageSnapshot|__snapshots__|-snapshots\/|\.snap\b|updateSnapshots/);
  assert.equal(spec.includes('process.exit(1); ("",'), false, 'data stays inside one string literal');
}));

test('targets are served read-only on loopback; prototypes resolve their built artifact from the manifest', async () => scratch(async root => {
  await seed(root);
  const served = await testWorkflowServable(root, { kind: 'static', folder: 'site' });
  assert.equal(served.kind, 'assets');
  const server = await serveTestWorkflowAssets(served.assets), url = new URL(server.url);
  const call = (method, path, host = url.host) => new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port: url.port, path, method, headers: { host } }, response => { let body = ''; response.on('data', chunk => body += chunk); response.on('end', () => done([response.statusCode, body])); });
    req.on('error', fail); req.end();
  });
  try {
    assert.match(url.href, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.deepEqual(await call('GET', '/'), [200, '<!doctype html><title>Shop</title><h1>Shop</h1>']);
    assert.deepEqual(await call('HEAD', '/index.html'), [200, '']);
    for (const [method, path, host] of [['POST', '/'], ['GET', '/missing.html'], ['GET', '/', 'evil.example'], ['GET', '/%E0%A4%A']]) assert.equal((await call(method, path, host))[0] >= 400, true, `${method} ${path} ${host ?? ''}`);
  } finally { await server.close(); }
  assert.deepEqual(await testWorkflowServable(root, { kind: 'url', url: 'http://127.0.0.1:9/' }), { kind: 'url', url: 'http://127.0.0.1:9/', source: 'http://127.0.0.1:9/' });
  const pkg = join(root, 'prototypes/demo');
  assert.match((await testWorkflowServable(root, { kind: 'prototype', package: 'prototypes/demo' })).reason, /prototype\.manifest\.json does not exist/);
  await mkdir(join(pkg, 'source/dist'), { recursive: true });
  await writeFile(join(pkg, 'prototype.manifest.json'), JSON.stringify({ artifact: { path: 'source/dist/cli.js' } }));
  assert.match((await testWorkflowServable(root, { kind: 'prototype', package: 'prototypes/demo' })).reason, /names no offline HTML artifact/);
  await writeFile(join(pkg, 'prototype.manifest.json'), JSON.stringify({ artifact: { path: 'source/dist/prototype.html' } }));
  assert.match((await testWorkflowServable(root, { kind: 'prototype', package: 'prototypes/demo' })).reason, /is not built yet/);
  await writeFile(join(pkg, 'source/dist/prototype.html'), '<!doctype html><title>Proto</title>');
  const proto = await testWorkflowServable(root, { kind: 'prototype', package: 'prototypes/demo' });
  assert.deepEqual([proto.kind, proto.source, [...proto.assets.keys()]], ['assets', 'prototypes/demo/source/dist/prototype.html', ['/index.html']]);
}));
