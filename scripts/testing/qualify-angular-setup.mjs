/** Actual compiled-kit -> setup -> npm -> build -> browser -> edit/regenerate journey.
 * Scratch workspaces only. --no-browser retains honest build-only evidence for restricted environments. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assembleKit, installedCompiler } from '../framework/kit.ts';
import { firstRunDefaults } from '../../bin/domain/first-run.ts';
import { showcase } from '../../bin/adapters/first-run-preview.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const output = join(frameworkRoot, 'reports/angular-setup-acceptance');
const flags = process.argv.slice(2);
assert.ok(flags.every(flag => flag === '--no-browser'), 'Unsupported qualification argument.');
const browserRequired = !flags.includes('--no-browser');
const root = await mkdtemp(join(await realpath(tmpdir()), 'workbench-angular-'));
const evidence = { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? null, node: process.versions.node,
  compiledKit: 'not-run', firstRun: 'not-run', regeneration: 'not-run', browser: 'not-run', status: 'running' };
await mkdir(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function run(executable, args, cwd = root) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, { cwd, env: { ...process.env, CI: 'true' }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; });
    child.stderr.on('data', bytes => { stderr += bytes; process.stderr.write(bytes); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Qualification child timed out.')); }, 600000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); if (code === 0) accept(stdout); else reject(new Error(`Command exit ${code}: ${args.join(' ')}\n${stdout}\n${stderr}`)); });
  });
}
const cli = async args => JSON.parse(await run(process.execPath, [join(root, 'tools/shell-cli/shell.mjs'), ...args, '--json']));
async function approve(args) {
  const planned = await cli(args); assert.equal(planned.status, 'planned');
  const applied = await cli([...args, '--apply', planned.data.planHash]);
  assert.ok(['applied', 'unchanged', 'ok'].includes(applied.status)); return applied.data;
}
async function browserChecks(app) {
  const { chromium, expect } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const controller = new AbortController();
  try {
    await showcase(join(app, 'dist/webapp'), { ...firstRunDefaults, schemaVersion: 1, mode: 'showcase', port: 4197, openBrowser: false, showcaseDurationMs: 1000 }, {
      signal: controller.signal, ready: async ({ url }) => {
        const page = await browser.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url); await page.waitForFunction(() => document.documentElement.dataset.prototypeReady === 'true');
        await expect(page.getByRole('heading', { name: 'Hello world', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Updated orders', exact: true }).click();
        // A click schedules zoneless change detection; wait for the rendered outcome.
        await expect(page.getByRole('heading', { name: 'Updated orders', exact: true })).toBeVisible();
        await expect(page.getByText('Order card', { exact: true })).toHaveCount(2);
        await expect(page.locator('[data-wb-layout="grid"]')).toHaveCSS('display', 'grid');
        await expect(page).toHaveURL(/#\/orders$/);
        await page.getByRole('button', { name: 'Show empty state', exact: true }).click();
        await expect(page.locator('main[data-preview-state]')).toHaveAttribute('data-preview-state', 'empty');
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Updated orders', exact: true })).toBeVisible();
        assert.deepEqual(errors, []);
        await page.screenshot({ path: join(output, 'angular-after-edit.png') });
        evidence.browser = 'passed'; controller.abort(); await page.close();
      },
    });
  } finally { controller.abort(); await browser.close(); }
}
try {
  const compiler = await installedCompiler(); assert.equal(compiler.version, '6.0.3');
  const files = await assembleKit({ root, frameworkRoot }, compiler);
  for (const file of files) { const path = join(root, 'tools/shell-cli', file.path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, file.bytes); }
  await assert.rejects(readFile(join(root, 'tools/shell-cli/node_modules/typescript/package.json')), { code: 'ENOENT' });
  await run('git', ['init', root]); await mkdir(join(root, '.obsidian'));
  await mkdir(join(root, 'docs/prds'), { recursive: true });
  const prd = '---\ntype: prd\nid: PRD-ACCEPTANCE\ntitle: Qualification\n---\nDescribe the first iteration.\n';
  await writeFile(join(root, 'docs/prds/first.md'), prd);
  const input = { schemaVersion: 1, project: { name: 'Acceptance product', description: 'Real generated Angular.', product: 'Develop a first iteration.' },
    prds: { mode: 'scan' }, prototypeInterview: null, operations: [
      { op: 'page.add', title: 'Orders', as: 'orders' }, { op: 'component.add', title: 'Order card', as: 'card' },
      { op: 'page.attach', page: '@orders', components: [{ id: '@card' }, { id: '@card' }] },
      { op: 'page.layout', id: '@orders', layout: 'grid' },
      { op: 'interaction.add', page: '@orders', title: 'Show empty state', as: 'empty' },
      { op: 'interaction.action', page: '@orders', id: '@empty', action: { kind: 'set-state', state: 'empty' } },
    ], boilerplate: true };
  await writeFile(join(root, 'setup.json'), JSON.stringify(input));
  const setup = await approve(['project-setup', '--input', 'setup.json']);
  evidence.compiledKit = 'passed';
  await writeFile(join(root, 'verify.json'), JSON.stringify({ schemaVersion: 1, mode: 'verify' }));
  const first = await approve(['first-run', '--input', 'verify.json']); evidence.firstRun = first.report.status;
  assert.equal(first.report.built, true); assert.equal(first.report.status, 'passed');
  const app = join(root, 'apps/product'); const lock = await readFile(join(app, 'package-lock.json'));
  const orders = setup.document.design.nodes.find(node => node.label === 'Orders'); assert.ok(orders);
  await writeFile(join(root, 'edit.json'), JSON.stringify({ schemaVersion: 1, operations: [{ op: 'page.rename', id: orders.id, title: 'Updated orders' }] }));
  await approve(['sketch', '--input', 'edit.json']); await approve(['sketch', 'generate']);
  assert.equal(sha(await readFile(join(app, 'package-lock.json'))), sha(lock), 'Regeneration preserves resolved dependency bytes.');
  assert.match(await readFile(join(app, 'src/core/project.ts'), 'utf8'), /Updated orders/);
  const second = await approve(['first-run', '--input', 'verify.json']); assert.equal(second.report.status, 'passed');
  evidence.regeneration = 'passed';
  if (browserRequired) await browserChecks(app);
  assert.equal(await readFile(join(root, 'docs/prds/first.md'), 'utf8'), prd);
  await writeFile(join(output, 'first-run.json'), JSON.stringify(second.report, null, 2));
  await writeFile(join(output, 'resolved-package-lock.json'), lock);
  evidence.status = browserRequired ? 'passed' : 'build-only';
} catch (error) { evidence.status = 'failed'; evidence.error = error.message; throw error; }
finally { await writeFile(join(output, 'result.json'), JSON.stringify(evidence, null, 2)); await rm(root, { recursive: true, force: true }); }
console.log(JSON.stringify(evidence, null, 2));
