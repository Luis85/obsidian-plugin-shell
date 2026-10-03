/** Explicit disposable qualification, not a generator side effect or native activation. */
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = process.cwd(), args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--execute') options.execute = true;
  else if (arg === '--starter' && args[i + 1] && !args[i + 1].startsWith('--')) options.starter = args[++i];
  else throw new Error('Use --starter <project-starter-id> --execute.');
}
if (!options.execute) {
  console.log(JSON.stringify({ status: 'planned', starter: options.starter ?? null, steps: ['Create disposable approved fixture from the installed project starter through new guide/plan/apply.', 'Explicit npm install, clean npm ci, typecheck, tests and build.', 'Exact-artifact offline browser or CLI acceptance; native host not activated.'], requires: '--execute and QUALIFIED_NPM' }));
} else await qualify();
async function qualify() {
  const expected = 'v' + (await readFile('.nvmrc', 'utf8')).trim();
  if (process.version !== expected || !process.env.QUALIFIED_NPM) throw new Error('Use the exact .nvmrc Node and set QUALIFIED_NPM to npm 11.19.1.');
  const starter = options.starter;
  if (!starter || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(starter)) throw new Error('Supply --starter <project-starter-id>.');
  const folder = join(root, 'reports/project-starters', starter);
  await mkdir(folder, { recursive: true });
  const report = { node: process.version, starter, status: 'running', commands: [], browser: 'not-run', nativeHost: 'not-run; separate authorization and disposable Obsidian vault required', artifacts: [] };
  let scratch;
  function run(label, cwd, arguments_, expectedStatus = 0) {
    const child = spawnSync(process.execPath, arguments_, { cwd, encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024 });
    const row = { label, arguments: arguments_, exitCode: child.status, stdout: child.stdout ?? '', stderr: child.stderr ?? '' };
    report.commands.push(row);
    if (child.error) throw child.error;
    if (child.status !== expectedStatus) throw new Error(label + ' failed: ' + row.stderr + row.stdout);
    return row.stdout;
  }
  try {
    if (run('npm version', root, [process.env.QUALIFIED_NPM, '--version']).trim() !== '11.19.1') throw new Error('Wrong npm version.');
    scratch = await mkdtemp(join(tmpdir(), 'qualify-project-'));
    const discovery = JSON.parse(run('discover', root, ['app.mjs', 'new', 'guide', '--starter', starter, '--json']));
    const input = discovery.data.input; report.selection = discovery.data.selection;
    if (report.selection.starter.id !== starter || input.starter !== starter) throw new Error('Discovery did not select the requested starter.');
    Object.assign(input.interview.answers, { title: 'Qualified starter fixture', pages: ['Overview', 'Details'], components: [], approved: true });
    await writeFile(join(scratch, 'request.json'), JSON.stringify(input));
    const planArgs = ['app.mjs', 'new', '--root', scratch, '--input', 'request.json', '--out', 'prepared', '--json'];
    const plan = JSON.parse(run('plan', root, planArgs)); report.fingerprint = plan.data.compilerFingerprint;
    const applied = JSON.parse(run('apply', root, [...planArgs, '--apply', plan.data.planHash]));
    if (applied.status !== 'applied') throw new Error('Expected an applied source fixture.');
    const source = join(scratch, 'prepared/source'), npm = process.env.QUALIFIED_NPM;
    run('resolve dependencies explicitly', source, [npm, 'install', '--ignore-scripts', '--no-audit', '--no-fund']);
    await copyFile(join(source, 'package-lock.json'), join(folder, 'resolved-package-lock.json'));
    run('clean exact-lock install', source, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
    for (const name of ['typecheck', 'test', 'build']) run(name, source, [npm, 'run', name]);
    if (report.selection.targets.includes('cli')) {
      const command = 'dist/cli/src/targets/cli/main.js';
      const pages = JSON.parse(run('CLI pages JSON', source, [command, 'pages', '--json']));
      if (pages.pages.length !== 2) throw new Error('CLI page fixture mismatch.');
      const invalid = JSON.parse(run('CLI invalid JSON', source, [command, 'unknown-command', '--json'], 2));
      if (invalid.error.code !== 'INVALID_ARGUMENT') throw new Error('Missing structured CLI failure.');
    }
    if (report.selection.framework !== 'none') {
      run('offline prototype build', source, [npm, 'run', 'build:prototype']);
      await copyFile(join(source, 'dist/prototype.html'), join(folder, 'prototype.html'));
      await browserCheck(join(source, 'dist/prototype.html'), report);
    }
    await collect(join(source, 'dist'), report.artifacts, source);
    report.status = 'passed-source-build-and-target-smoke';
    report.productAcceptance = 'not-inferred: agreed product behavior must be implemented separately';
  } catch (error) {
    report.status = 'failed'; report.error = error instanceof Error ? error.message : String(error); process.exitCode = 1;
  } finally {
    await writeFile(join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (scratch) await rm(scratch, { recursive: true, force: true });
    console.log(JSON.stringify({ status: report.status, report: relative(root, join(folder, 'report.json')) }));
  }
}
async function collect(folder, inventory, source) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await collect(path, inventory, source);
    else { const bytes = await readFile(path); inventory.push({ path: relative(source, path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); }
  }
}
async function browserCheck(path, report) {
  const { chromium, expect } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const errors = [], network = [];
  report.browser = { status: 'running', source: 'exact Vite-built prototype.html', errors, network };
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => { if (!/^(file|data):/.test(request.url())) network.push(request.url()); });
    await page.goto(pathToFileURL(path).href);
    await page.waitForFunction(() => ['true', 'failed'].includes(document.documentElement.dataset.prototypeReady));
    if (await page.evaluate(() => document.documentElement.dataset.prototypeReady) !== 'true') throw new Error('Generated prototype startup failed: ' + JSON.stringify(errors));
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    // Signals and Vue refs render asynchronously; assert the eventual user-visible result.
    await expect(page.getByRole('heading', { name: 'Details', exact: true })).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    const model = await page.locator('#companion-project').textContent();
    if (JSON.parse(model).schemaVersion !== 6) throw new Error('Complete v6 export is missing.');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Overview', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    if (errors.length || network.length) throw new Error('Browser errors or network calls: ' + JSON.stringify({ errors, network }));
    report.browser = { status: 'passed', source: 'exact Vite-built prototype.html', network, errors, widths: [1100, 390] };
  } catch (error) {
    report.browser = { status: 'failed', source: 'exact Vite-built prototype.html', errors, network };
    throw error;
  } finally { await browser.close(); }
}
