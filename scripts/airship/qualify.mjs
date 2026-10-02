/** Hosted acceptance of a freshly generated project, real upstream CLI/proxy and Vue source resolver.
 * No prompt is submitted to an AI provider. Native-host/business acceptance is deliberately separate. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { compileProject, loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { withAirshipOption } from '../companion/tooling-options.ts';
import { projectConfigs } from '../shared/project-configs.mjs';
import { airshipEnvironment } from '../../bin/adapters/framework/airship.ts';
const root = process.cwd(), out = resolve(root, 'reports/airship-qualification');
const project = join(out, 'project space'), npm = process.env.QUALIFIED_NPM;
assert.ok(npm, 'QUALIFIED_NPM must select the qualified npm CLI.');
await mkdir(out, { recursive: true });
// Fixed scratch directory under reports only. A prior retained run is never mistaken for this run.
await rm(project, { recursive: true, force: true });
const doc = withAirshipOption(JSON.parse(await readFile('docs/concepts/companion/starters/quick-capture.companion.json', 'utf8')), { airship: true });
doc.tooling.airship = { enabled: true, agent: 'codex', targetPort: 5741, port: 5742 };
const compiled = await compileProject({ source: JSON.stringify(doc), template: await loadTemplateSnapshot(root) });
assert.equal(compiled.status, 'ok', JSON.stringify(compiled.diagnostics));
for (const file of compiled.artifacts) {
  await mkdir(dirname(join(project, file.path)), { recursive: true });
  await writeFile(join(project, file.path), file.content, file.encoding === 'base64' ? 'base64' : 'utf8');
}
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: project, env: process.env, encoding: 'utf8', maxBuffer: 8_000_000 });
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
run([npm, 'ci', '--no-fund']);
run(['app.mjs', 'airship', 'install', '--yes', '--json']);
const cli = join(project, '.airship-tooling/node_modules/@airshiplabs/cli');
const packageInfo = JSON.parse(await readFile(join(cli, 'package.json'), 'utf8'));
assert.equal(packageInfo.version, '0.3.0');
const resolver = createRequire(join(cli, 'package.json')).resolve('element-source');
const sourceEntry = join(out, 'resolver-entry.mjs');
await writeFile(sourceEntry, `import {createSourceResolver,vueResolver} from ${JSON.stringify(resolver)}; window.__airshipResolver=createSourceResolver({resolvers:[vueResolver]});`);
await build({ configFile: false, logLevel: 'warn', build: { outDir: join(out, 'resolver'), emptyOutDir: true,
  lib: { entry: sourceEntry, formats: ['iife'], name: 'AirshipResolverTest', fileName: () => 'resolver.js' } } });
const children = [], logs = [];
function start(args) {
  const child = spawn(process.execPath, args, { cwd: project, env: { ...process.env, ...airshipEnvironment(),
    OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => logs.push(data.toString())); child.stderr.on('data', data => logs.push(data.toString()));
  child.on('error', error => logs.push(String(error))); children.push(child); return child;
}
async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    assert.ok(children.every(child => child.exitCode === null), logs.join('').slice(-20000));
    try { if ((await fetch(url)).ok) return; } catch { /* The just-started local server is not ready yet. */ }
    await delay(500);
  }
  throw new Error('Local server did not become ready: ' + logs.join('').slice(-20000));
}
let browser, original, editedFile;
const evidence = { source: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(),
  compilerFingerprint: compiled.fingerprint, cliVersion: packageInfo.version, node: process.version,
  checks: [], providerEditing: 'not-run', nativeObsidian: 'not-run', storybookRuntime: 'not-run' };
try {
  start(['node_modules/vite/bin/vite.js', '--config', projectConfigs.preview.path]);
  await ready('http://127.0.0.1:5741/');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5741/', { waitUntil: 'networkidle' });
  await page.locator('.clickdummy-preview').waitFor();
  const surface = doc.design.nodes.find(node => node.kind === 'page');
  assert.ok(surface); await page.getByLabel('Browse surfaces', { exact: true }).selectOption(surface.id);
  await page.addScriptTag({ path: join(out, 'resolver/resolver.js') });
  const selected = page.locator('[data-design-node][data-v-inspector]').first();
  await selected.waitFor();
  const location = await selected.evaluate(element => window.__airshipResolver.resolveSource(element));
  assert.ok(location.filePath.startsWith('src/generated/'), JSON.stringify(location));
  assert.ok(Number.isInteger(location.lineNumber) && location.lineNumber > 0);
  assert.ok(Number.isInteger(location.columnNumber) && location.columnNumber > 0);
  evidence.sourceLocation = location; evidence.checks.push('real element-source Vue file/line/column');
  editedFile = join(project, location.filePath); original = await readFile(editedFile, 'utf8');
  const lines = original.split('\n');
  assert.equal(lines[location.lineNumber - 1][location.columnNumber - 1], '<');
  const offset = lines.slice(0, location.lineNumber - 1).reduce((sum, line) => sum + line.length + 1, 0) + location.columnNumber - 1;
  const tag = /^<[A-Za-z][\w.-]*/.exec(original.slice(offset)); assert.ok(tag);
  const at = offset + tag[0].length;
  await writeFile(editedFile, original.slice(0, at) + ' data-airship-hmr-probe="passed"' + original.slice(at));
  await page.locator('[data-airship-hmr-probe="passed"]').first().waitFor();
  evidence.checks.push('live authored source edit reflected by HMR');
  await writeFile(editedFile, original); editedFile = null;
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Project JSON', exact: true }).click();
  assert.deepEqual(JSON.parse(await readFile(await (await download).path(), 'utf8')), doc);
  evidence.checks.push('preview exports current project JSON with opt-in');
  const secret = join(project, '.env.airship-test'); await writeFile(secret, 'PRIVATE_PREVIEW_NEGATIVE_CONTROL=1');
  assert.notEqual((await fetch('http://127.0.0.1:5741/.env.airship-test')).status, 200); await rm(secret);
  evidence.checks.push('preview denies private environment files');
  start([join(cli, 'dist/index.js'), '--cwd', project, '--target', '5741', '--port', '5742', '--host', '127.0.0.1', '--agent', 'codex', '--safe', '--no-commit']);
  await ready('http://127.0.0.1:5742/');
  assert.equal((await fetch('http://127.0.0.1:5742/__airship/overlay.js')).status, 200);
  await page.goto('http://127.0.0.1:5742/', { waitUntil: 'domcontentloaded' });
  let preview;
  for (let attempt = 0; attempt < 60 && !preview; attempt++) {
    preview = page.frames().find(frame => frame !== page.mainFrame() && frame.url().includes('127.0.0.1'));
    if (!preview) await delay(500);
  }
  assert.ok(preview, 'Airship canvas must contain the live preview iframe.');
  await preview.locator('.clickdummy-preview').waitFor();
  await preview.getByLabel('Browse surfaces', { exact: true }).selectOption(surface.id);
  await preview.locator('[data-design-node][data-v-inspector]').first().waitFor();
  evidence.checks.push('real Airship canvas proxy, overlay and navigable generated Vue surface');
  await page.screenshot({ path: join(out, 'airship-preview.png'), fullPage: true });
  assert.deepEqual(errors, [], 'No browser runtime errors in generated preview/editor.');
  evidence.checks.push('browser runtime has no uncaught errors');
} finally {
  if (editedFile && original) await writeFile(editedFile, original);
  await browser?.close();
  for (const child of children.reverse()) {
    child.kill('SIGTERM');
    for (let attempt = 0; child.exitCode === null && child.signalCode === null && attempt < 20; attempt++) await delay(100);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  await writeFile(join(out, 'servers.log'), logs.join('').slice(-100000));
  await writeFile(join(out, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
}
run([npm, 'run', 'build']);
for (const file of ['main.js', 'styles.css']) {
  const text = await readFile(join(project, 'dist', file), 'utf8');
  assert.ok(!/data-v-inspector|@airshiplabs|__airship/.test(text), `${file} must not contain development integration.`);
}
evidence.checks.push('independent generated production build excludes Airship and inspector metadata');
await writeFile(join(out, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
