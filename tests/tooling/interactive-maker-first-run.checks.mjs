import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, mkdtemp, realpath, rm, readdir, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { hash } from '../../scripts/framework/files.ts';
import { firstRunPlan, firstRunTool, firstRunReport } from '../../bin/adapters/first-run-plan.ts';
import { executeFirstRun } from '../../bin/adapters/first-run.ts';
import { settingsPlan } from '../../bin/adapters/user-settings.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { claimFirstRun, assertNoFirstRun } from '../../bin/adapters/first-run-lock.ts';
import { projectStarter } from '../../bin/adapters/projects.ts';
import { main } from '../../bin/app.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const json = value => JSON.stringify(value, null, 2) + '\n';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'first-run-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
// Controlled local Node child, not a real registry installer or a substitute for Angular qualification.
async function fixture(root, code = '') {
  assert.equal(spawnSync('git', ['init', root]).status, 0);
  await mkdir(join(root, '.obsidian')); await writeFile(join(root, '.obsidian/app.json'), 'preserve');
  const app = join(root, 'apps/product'); await mkdir(join(app, '.maker'), { recursive: true });
  const { selection } = await projectStarter(frameworkRoot, 'webapp-angular');
  await writeFile(join(app, 'project.config.json'), json(selection));
  await writeFile(join(app, '.nvmrc'), process.versions.node + '\n');
  await writeFile(join(app, '.maker/receipt.json'), json({ schemaVersion: 1, files: [] }));
  await writeFile(join(app, 'package.json'), json({ name: 'fixture', packageManager: 'npm@11.19.1', scripts: { typecheck: 'fixture typecheck', test: 'fixture test', build: 'fixture build' }, dependencies: { fixture: '1.0.0' } }));
  await writeFile(join(app, 'package-lock.json'), json({ lockfileVersion: 3, packages: { '': { dependencies: { fixture: '1.0.0' } } } }));
  await mkdir(join(root, 'fake-npm/bin'), { recursive: true });
  await writeFile(join(root, 'fake-npm/package.json'), json({ version: '11.19.1', type: 'module' }));
  const entry = join(root, 'fake-npm/bin/npm-cli.js');
  const source = `import {mkdir,writeFile,readFile} from 'node:fs/promises';
const args=process.argv.slice(2), step=args[0]==='run'?args[1]:'install';
console.log('FIXTURE_STEP '+step); console.error('FIXTURE_PROGRESS '+step);
${code}
if(step==='install'){ const lock=JSON.parse(await readFile('package-lock.json','utf8'));lock.packages['node_modules/fixture']={version:'1.0.0'};await writeFile('package-lock.json',JSON.stringify(lock)); }
if(step==='build'){ await mkdir('dist/webapp',{recursive:true});await writeFile('dist/webapp/index.html','<!doctype html><h1>Hello world</h1>'); }
`;
  await writeFile(entry, source);
  return { app, tool: { entry, version: '11.19.1', node: process.versions.node, sha256: hash(source) } };
}
const request = { schemaVersion: 1, mode: 'verify' };
test('preview is deterministic and read-only; a wrong execution hash starts nothing', async () => scratch(async root => {
  const { tool } = await fixture(root); const before = await readdir(root);
  const a = await firstRunPlan(root, request, tool), b = await firstRunPlan(root, request, tool);
  assert.equal(a.planHash, b.planHash); assert.equal(a.steps[0].args[0], 'install');
  assert.equal((await executeFirstRun(a)).status, 'planned'); assert.deepEqual(await readdir(root), before);
  await assert.rejects(() => executeFirstRun(a, 'wrong'), /plan changed/);
  await assert.rejects(() => readFile(join(root, 'reports/first-run.json')));
}));
test('real child pipeline resolves a root lock, runs checks in order, preserves vault and writes a receipt', async () => scratch(async root => {
  const { app, tool } = await fixture(root); const plan = await firstRunPlan(root, request, tool); let output = '';
  const result = await executeFirstRun(plan, plan.planHash, { root, frameworkRoot, progress: text => output += text });
  assert.equal(result.status, 'ok'); assert.equal(result.report.status, 'passed');
  assert.deepEqual(result.report.stages.map(stage => stage.id), ['install', 'typecheck', 'test', 'build']);
  assert.ok(result.report.stages.every(stage => stage.status === 'passed'));
  assert.equal(result.report.installed, true); assert.equal(result.report.built, true); assert.equal(result.report.preview, null);
  assert.equal(result.report.manualAcceptance, 'not-verified'); assert.match(output, /FIXTURE_PROGRESS build/);
  assert.match(await readFile(join(app, 'dist/webapp/index.html'), 'utf8'), /Hello world/);
  assert.equal(await readFile(join(root, '.obsidian/app.json'), 'utf8'), 'preserve');
  assert.equal((await firstRunReport(root, 'reports/first-run.json')).report.status, 'passed');
  await assertNoFirstRun(root);
  const retry = await firstRunPlan(root, request, tool); assert.equal(retry.steps[0].args[0], 'ci');
  assert.notEqual(retry.planHash, plan.planHash); await assert.rejects(() => executeFirstRun(retry, plan.planHash), /plan changed/);
}));
for (const failing of ['install', 'typecheck', 'test', 'build']) test(`failure at ${failing} stops subsequent stages without fallback or rollback`, async () => scratch(async root => {
  const { tool } = await fixture(root, `if(step==='${failing}') process.exit(7);`);
  const plan = await firstRunPlan(root, request, tool); let output = '';
  await assert.rejects(() => executeFirstRun(plan, plan.planHash, { root, frameworkRoot, progress: text => output += text }), error => {
    assert.equal(error.code, 'PROCESS_FAILED'); assert.equal(error.details.automaticRetry, false);
    const stages = error.details.report.stages, index = stages.findIndex(stage => stage.id === failing);
    assert.equal(stages[index].status, 'failed'); assert.ok(stages.slice(index + 1).every(stage => stage.status === 'not-run')); return true;
  });
  assert.equal((await firstRunReport(root, 'reports/first-run.json')).report.status, 'failed');
  assert.equal(output.split('FIXTURE_STEP install').length - 1, 1); await assertNoFirstRun(root);
  assert.equal(await readFile(join(root, '.obsidian/app.json'), 'utf8'), 'preserve');
}));
test('stale source, added input, report, executable and mutated execution proposals cannot reuse approval', async () => scratch(async root => {
  const { app, tool } = await fixture(root); const plan = await firstRunPlan(root, request, tool);
  const tampered = structuredClone(plan); tampered.steps[1].args[1] = 'unexpected';
  await assert.rejects(() => executeFirstRun(tampered, plan.planHash), /proposal changed/);
  await writeFile(join(app, 'extra.ts'), '// changed'); await assert.rejects(() => executeFirstRun(plan, plan.planHash), /proposal changed/);
  await rm(join(app, 'extra.ts')); await writeFile(tool.entry, '// changed');
  await assert.rejects(() => executeFirstRun(plan, plan.planHash), /executable changed/);
  await assert.rejects(() => readFile(join(root, 'reports/first-run.json')));
}));
test('install-generated source changes are detected before another project script runs', async () => scratch(async root => {
  const { tool } = await fixture(root, `if(step==='install') await writeFile('surprise.js','// modified by lifecycle');`);
  const plan = await firstRunPlan(root, request, tool);
  await assert.rejects(() => executeFirstRun(plan, plan.planHash), error => {
    assert.equal(error.code, 'FIRST_RUN_STALE'); assert.equal(error.details.report.installed, true);
    assert.equal(error.details.report.stages[1].status, 'not-run'); return true;
  });
  assert.equal(await readFile(join(root, 'apps/product/surprise.js'), 'utf8'), '// modified by lifecycle');
}));
test('unsupported toolchains block execution before a report or dependency process is created', async () => scratch(async root => {
  const { tool } = await fixture(root); tool.node = '1.0.0'; tool.version = '1.0.0';
  const plan = await firstRunPlan(root, request, tool); assert.equal(plan.blockers.length, 2);
  await assert.rejects(() => executeFirstRun(plan, plan.planHash), /Use Node/);
  await assert.rejects(() => readFile(join(root, 'reports/first-run.json')));
}));
test('execution locks exclude another run and maker writes without stealing stale locks', async () => scratch(async root => {
  const { tool } = await fixture(root), plan = await firstRunPlan(root, request, tool);
  const settings = await settingsPlan(root, { schemaVersion: 1 });
  const release = await claimFirstRun(root);
  await assert.rejects(() => executeFirstRun(plan, plan.planHash), /owns/);
  await assert.rejects(() => applyPrepared(settings, settings.planHash), /owns/);
  await release(); await assertNoFirstRun(root);
  await mkdir(join(root, '.codex-authoring.lock'));
  await assert.rejects(() => claimFirstRun(root), /file writer/); await assertNoFirstRun(root);
}));
test('cancel and per-step timeout stop the actual child and preserve failed-stage evidence', async () => scratch(async root => {
  const { tool } = await fixture(root, `if(step==='install') await new Promise(resolve=>setTimeout(resolve,60000));`);
  const controller = new AbortController(), plan = await firstRunPlan(root, request, tool);
  await assert.rejects(() => executeFirstRun(plan, plan.planHash, { root, frameworkRoot, signal: controller.signal,
    progress: text => { if (text.includes('FIXTURE_STEP install')) controller.abort(); } }), error => {
    assert.equal(error.code, 'CANCELLED'); assert.equal(error.details.report.status, 'cancelled'); return true;
  });
  const next = await firstRunPlan(root, { ...request, stepTimeoutMs: 1000 }, tool);
  await assert.rejects(() => executeFirstRun(next, next.planHash), error => { assert.equal(error.code, 'TIMEOUT'); return true; });
  await assertNoFirstRun(root);
}));
test('unknown/corrupt reports and redirected output roots are never overwritten or followed', async () => scratch(async root => {
  const { app, tool } = await fixture(root); await mkdir(join(root, 'reports')); await writeFile(join(root, 'reports/first-run.json'), '{}');
  await assert.rejects(() => firstRunPlan(root, request, tool), /unknown\/corrupt/);
  assert.equal(await readFile(join(root, 'reports/first-run.json'), 'utf8'), '{}');
  await writeFile(join(root, 'reports/first-run.json'), json({ schemaVersion: 1, producer: 'shell-first-run' }));
  await assert.rejects(() => firstRunPlan(root, request, tool), /Invalid first-run result/);
  await rm(join(root, 'reports/first-run.json'));
  if (process.platform !== 'win32') { await symlink(root, join(app, 'dist')); await assert.rejects(() => firstRunPlan(root, request, tool), /symlinks/); }
}));
test('machine discovery and errors are one JSON envelope with no terminal prompts', async () => scratch(async root => {
  for (const argv of [['first-run','schema'],['first-run','status'],['first-run']]) {
    let out = '', err = ''; const input = Readable.from([]); input.isTTY = true;
    const output = new Writable({ write(chunk, _enc, done) { out += chunk; done(); } });
    const error = new Writable({ write(chunk, _enc, done) { err += chunk; done(); } }); error.isTTY = true;
    const exit = await main([...argv,'--root',root,'--json'], frameworkRoot, { input, output, error, env: { CI: 'true' } });
    assert.equal(out.trim().split('\n').length, 1); assert.equal(err, '');
    assert.equal(exit, argv.length === 1 ? 1 : 0); assert.ok(JSON.parse(out).protocolVersion);
  }
}));
test('agent plan and approved execution emit one JSON result with child progress on stderr', async () => scratch(async root => {
  const { tool } = await fixture(root); const original = process.env.QUALIFIED_NPM; process.env.QUALIFIED_NPM = tool.entry;
  async function invoke(extra = []) {
    let out = '', err = '';
    const output = new Writable({ write(c,_e,done) { out += c; done(); } }), error = new Writable({ write(c,_e,done) { err += c; done(); } });
    const exit = await main(['first-run','--root',root,'--json','--input','-',...extra], frameworkRoot, { input: Readable.from([json(request)]), output, error, env: { CI: 'true' } });
    assert.equal(out.trim().split('\n').length, 1); return { exit, result: JSON.parse(out), err };
  }
  try {
    const preview = await invoke(); assert.equal(preview.exit, 0); assert.equal(preview.result.status, 'planned'); assert.equal(preview.err, '');
    const result = await invoke(['--apply',preview.result.data.planHash]); assert.equal(result.exit, 0); assert.equal(result.result.status, 'ok');
    assert.equal(result.result.data.report.built, true); assert.match(result.err, /FIXTURE_PROGRESS/);
  } finally { if (original === undefined) delete process.env.QUALIFIED_NPM; else process.env.QUALIFIED_NPM = original; }
}));
test('real local npm performs the full dependency-free install/check/test/build smoke pipeline', async () => scratch(async root => {
  const { app } = await fixture(root); const tool = await firstRunTool();
  const pkg = { name: 'local-npm-smoke', version: '1.0.0', private: true, type: 'module', packageManager: 'npm@' + tool.version,
    scripts: { typecheck: 'node --check build.mjs', test: 'node --test example.test.mjs', build: 'node build.mjs' } };
  await writeFile(join(app,'package.json'),json(pkg));
  await writeFile(join(app,'package-lock.json'),json({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version } } }));
  await writeFile(join(app,'.npmrc'),'offline=true\n');
  await writeFile(join(app,'build.mjs'),"import {mkdir,writeFile} from 'node:fs/promises'; await mkdir('dist/webapp',{recursive:true}); await writeFile('dist/webapp/index.html','<!doctype html><h1>Hello world</h1>');\n");
  await writeFile(join(app,'example.test.mjs'),"import {test} from 'node:test'; import assert from 'node:assert/strict'; test('fixture',()=>assert.equal(1+1,2));\n");
  const plan = await firstRunPlan(root, { ...request, stepTimeoutMs: 10000 }, tool);
  const result = await executeFirstRun(plan,plan.planHash); assert.equal(result.report.status,'passed');
  assert.ok(result.report.stages.every(stage => stage.status==='passed'));
}));
