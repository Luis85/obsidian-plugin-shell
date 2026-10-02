import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { setupProgress } from '../../bin/adapters/framework/setup-progress.ts';
import { guidedSetup, continueSetup } from '../../bin/presentation/terminal/setup-terminal.ts';
import { result } from '../../bin/adapters/framework/contracts.ts';
import { assembleStarterPack } from '../../scripts/starters/operations.ts';
import { zip } from '../../bin/adapters/framework/zip.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'setup-journey-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}
const run = (context, argv) => executeOperation(parseCliArguments(argv), context);
const identity = ['--id', 'capture', '--name', 'Capture', '--author', 'Example'];
/** The shell bundles no starters: extract the separate pack into the invoking folder, as a user does. */
async function withStarterPack(ctx) {
  await extractArchive(zip(await assembleStarterPack({ root: frameworkRoot, frameworkRoot })), ctx.root);
  return ctx;
}
async function configured(t) {
  const ctx = await withStarterPack(await fixture(t));
  assert.equal((await run(ctx, ['setup', '--starter', 'quick-capture', ...identity, '--yes'])).status, 'applied');
  return ctx;
}
const status = async ctx => (await run(ctx, ['setup', 'status'])).data;
function request(stage, resumeHash, extra = {}) {
  return { command: 'setup resume', args: [], options: { stage, yes: true, 'resume-hash': resumeHash, ...extra } };
}
test('setup in the current folder accepts a verified starter and retains the ordinary canonical model', async t => {
  const ctx = await withStarterPack(await fixture(t)); await writeFile(join(ctx.root, 'README.md'), 'existing kit or user readme\n');
  const pack = await readdir(join(ctx.root, 'configs/starters'));
  const preview = await run(ctx, ['setup', '--starter', 'custom-file-view', ...identity, '--extension', 'folio']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview));
  assert.deepEqual((await readdir(ctx.root)).sort(), ['README.md', 'configs'].sort());
  assert.deepEqual(await readdir(join(ctx.root, 'configs')), ['starters']);
  assert.equal(preview.data.summary.starter.id, 'custom-file-view');
  const applied = await run(ctx, ['setup', '--starter', 'custom-file-view', ...identity, '--extension', 'folio', '--apply', preview.data.planHash]);
  assert.equal(applied.status, 'applied', JSON.stringify(applied));
  const document = JSON.parse(await readFile(join(ctx.root, 'design/project.json')));
  assert.equal(document.schemaVersion, 6);
  assert.equal(document.design.nativeIntegrations.fileTypes[0].extension, 'folio');
  assert.equal(document.project.id, 'capture');
  assert.equal(await readFile(join(ctx.root, 'README.md'), 'utf8'), 'existing kit or user readme\n');
  assert.deepEqual(await readdir(join(ctx.root, 'configs/starters')), pack, 'setup never edits the installed starter pack');
  assert.equal((await run(ctx, ['setup', '--starter', 'custom-file-view', ...identity, '--extension', 'folio', '--yes'])).status, 'unchanged');
});
test('source choice ambiguity, unknown starters and native options without a starter fail before writes', async t => {
  const ctx = await fixture(t);
  for (const args of [['--starter', 'blank', '--blank'], ['--starter', 'blank', '--input', 'missing.json'], ['--starter', 'unknown'], ['--blank', '--extension', 'folio']]) {
    assert.equal((await run(ctx, ['setup', ...identity, ...args, '--yes'])).status, 'failed');
    assert.deepEqual(await readdir(ctx.root), []);
  }
  // Without the separate starter pack the shell has no fallback definitions, even for canonical IDs.
  const missing = await run(ctx, ['setup', '--starter', 'quick-capture', ...identity, '--yes']);
  assert.equal(missing.diagnostics[0].code, 'STARTER_UNKNOWN'); assert.deepEqual(await readdir(ctx.root), []);
});
test('headless import preserves imported identity; wizard does not request a replacement identity for JSON', async t => {
  const ctx = await fixture(t);
  const document = JSON.parse(await readFile(join(frameworkRoot, 'docs/concepts/companion/starters/quick-capture.companion.json')));
  document.project.author = 'Synthetic author';
  await writeFile(join(ctx.root, 'input.json'), JSON.stringify(document));
  const prompts = [], answers = ['json', 'input.json', '', ''];
  const chosen = await guidedSetup({ command: 'setup', args: [], options: {} }, ctx, async q => { prompts.push(q); return answers.shift(); }, () => {});
  assert.equal(prompts.length, 4); assert.match(prompts[2], /Airship/); assert.match(prompts[3], /Workbench MCP/);
  assert.equal(chosen.options.airship, undefined); assert.equal(chosen.options.mcp, undefined); assert.equal(chosen.options.id, undefined);
  assert.ok(prompts.every(q=>!/^Plugin (ID|name)|^Author:/.test(q)));
  const imported = await executeOperation({ ...chosen, options: { ...chosen.options, yes: true } }, ctx);
  assert.equal(imported.status, 'applied', JSON.stringify(imported));
  assert.deepEqual(JSON.parse(await readFile(join(ctx.root, 'design/project.json'))).project, document.project);
});
test('status and unapproved resume are read-only, even when verification is requested', async t => {
  const ctx = await configured(t), original = await readdir(join(ctx.root, '.framework'));
  let calls = 0;
  const value = await setupProgress({ command: 'setup resume', args: [], options: { stage: 'verify' } }, ctx, async () => { calls++; throw Error('must not run'); });
  assert.equal(value.status, 'planned'); assert.equal(calls, 0);
  assert.deepEqual(await readdir(join(ctx.root, '.framework')), original);
  assert.equal((await status(ctx)).productAcceptance, 'not-inferred');
});
test('resume keeps real failure metadata codes and does not retry or call the next stage', async t => {
  const ctx = await configured(t);
  await mkdir(join(ctx.root, '.companion')); await writeFile(join(ctx.root, '.companion/generation.json'), JSON.stringify({ version: 1, projectId: 'capture', files: [{ path: 'design/project.json' }] }));
  let calls = 0;
  const receipt = await setupProgress(request('install', (await status(ctx)).resumeHash), ctx, async command => {
    calls++; assert.equal(command.command, 'install'); return { ...result('install', { exitCode: 23 }, 'failed'), diagnostics: [{ code: 'PROCESS_FAILED', message: 'synthetic secret must not enter progress' }] };
  });
  assert.equal(receipt.status, 'failed'); assert.equal(calls, 1);
  const text = await readFile(join(ctx.root, '.framework/setup-progress.json'), 'utf8');
  assert.doesNotMatch(text, /secret|exitCode/); assert.match(text, /PROCESS_FAILED/);
  const state = await status(ctx); assert.equal(state.current, true); assert.equal(state.attempts.length, 1);
  const retried = await setupProgress(request('install', state.resumeHash), ctx, async () => { calls++; return result('install', {}); });
  assert.equal(retried.status, 'ok'); assert.equal(calls, 2);
  assert.equal((await status(ctx)).attempts[0].status, 'failed');
});
test('changed code invalidates a retained resume hash; aborted and corrupt progress never run', async t => {
  const ctx = await configured(t), before = await status(ctx);
  await mkdir(join(ctx.root, 'src')); await writeFile(join(ctx.root, 'src/new.ts'), 'export const x = 1;');
  let calls = 0; const execute = async () => { calls++; return result('generate', {}); };
  await assert.rejects(setupProgress(request('generate', before.resumeHash), ctx, execute), /current resumeHash/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(setupProgress(request('generate', (await status(ctx)).resumeHash), { ...ctx, signal: controller.signal }, execute), /Cancelled/);
  await writeFile(join(ctx.root, '.framework/setup-progress.json'), '{broken');
  await assert.rejects(setupProgress(request('generate', before.resumeHash), ctx, execute));
  assert.equal(calls, 0); assert.equal(await readFile(join(ctx.root, '.framework/setup-progress.json'), 'utf8'), '{broken');
});
test('interrupted intent blocks concurrent execution and is recovered only by explicit current-hash acknowledgment', async t => {
  const ctx = await configured(t);
  let release; const waiting = new Promise(resolve => { release = resolve; }); let started;
  const entered = new Promise(resolve => { started = resolve; });
  const active = setupProgress(request('generate', (await status(ctx)).resumeHash), ctx, async () => { started(); await waiting; return result('generate', {}, 'applied'); });
  await entered;
  const current = await status(ctx); assert.equal(current.attempts[0].status, 'running');
  await assert.rejects(setupProgress(request('generate', current.resumeHash), ctx, async () => { throw Error('must not run'); }), /previous setup process is still present/);
  release(); assert.equal((await active).status, 'applied');
});
test('source changes during verification block reported acceptance; foreign progress edits are preserved', async t => {
  const ctx = await configured(t);
  await mkdir(join(ctx.root, '.companion')); await writeFile(join(ctx.root, '.companion/generation.json'), JSON.stringify({ version: 1, projectId: 'capture', files: [{ path: 'design/project.json' }] }));
  await mkdir(join(ctx.root, 'src')); await writeFile(join(ctx.root, 'src/a.ts'), 'before');
  const changed = await setupProgress(request('verify', (await status(ctx)).resumeHash), ctx, async () => {
    await writeFile(join(ctx.root, 'src/a.ts'), 'after'); return result('verify', {});
  });
  assert.equal(changed.status, 'failed'); assert.equal(changed.data.attempt.status, 'blocked');
  const conflict = await setupProgress(request('generate', (await status(ctx)).resumeHash), ctx, async () => {
    await writeFile(join(ctx.root, '.framework/setup-progress.json'), 'foreign'); return result('generate', {}, 'applied');
  });
  assert.equal(conflict.status, 'failed'); assert.equal(conflict.data.stageOutcome, 'applied');
  assert.equal(await readFile(join(ctx.root, '.framework/setup-progress.json'), 'utf8'), 'foreign');
});
test('wizard stops after denied installation without silently invoking verification or a native host', async () => {
  const calls = [], answers = ['no', 'no', 'yes', 'yes', 'no', 'no'];
  const execute = async command => { if (command.command === 'setup resume') assert.equal(command.options.apply, 'b'.repeat(64)); calls.push(command.command); return command.command === 'generate' ? result('generate', { planHash: 'b'.repeat(64) }, 'planned')
    : command.command === 'setup status' ? result(command.command, { resumeHash: 'a'.repeat(64) }) : result(command.command, {}, 'applied'); };
  const response = await continueSetup({ root: '/', frameworkRoot: '/' }, execute, async () => answers.shift(), () => {}, result('setup', {}, 'applied'));
  assert.equal(response.status, 'applied'); assert.deepEqual(calls, ['generate', 'setup status', 'setup resume']);
});

test('resume rejects silently ignored approval options and invalid generation state', async t => {
  const ctx = await configured(t); let calls = 0;
  const execute = async () => { calls++; return result('install', {}); };
  await assert.rejects(setupProgress(request('install', (await status(ctx)).resumeHash, { apply: 'a'.repeat(64) }), ctx, execute), /only binds a reviewed generate plan/);
  await assert.rejects(setupProgress(request('generate', (await status(ctx)).resumeHash, { 'plan-out': 'anything' }), ctx, execute), /not a portable/);
  await mkdir(join(ctx.root, '.companion')); await writeFile(join(ctx.root, '.companion/generation.json'), '{}');
  assert.equal((await run(ctx, ['setup', 'status'])).diagnostics[0].code, 'SETUP_GENERATION_INVALID');
  assert.equal(calls, 0);
});
test('a reviewed generation hash survives the resume adapter instead of being replaced with latest input approval', async t => {
  const ctx = await configured(t), planHash = 'b'.repeat(64);
  const response = await setupProgress(request('generate', (await status(ctx)).resumeHash, { apply: planHash }), ctx, async operation => {
    assert.equal(operation.command, 'generate'); assert.equal(operation.options.apply, planHash);
    return { ...result('generate', {}, 'blocked'), diagnostics: [{ code: 'PLAN_STALE', message: 'synthetic' }] };
  });
  assert.equal(response.status, 'blocked'); assert.equal(response.data.attempt.status, 'blocked');
});


async function customConfigured(t) {
  const ctx = await fixture(t);
  const input = JSON.parse(await readFile(join(frameworkRoot, 'docs/concepts/companion/starters/quick-capture.companion.json')));
  input.project = { ...input.project, id: 'capture', name: 'Capture', author: 'Example' };
  input.settings = { codebaseFolder: 'application', testsFolder: 'checks' };
  await writeFile(join(ctx.root, 'input.json'), JSON.stringify(input));
  const imported = await run(ctx, ['setup', '--input', 'input.json', '--yes']);
  assert.equal(imported.status, 'applied', JSON.stringify(imported));
  return ctx;
}
for (const path of ['src/consumer-owned.ts', 'tests/runtime/consumer-owned.test.ts', 'application/feature.ts', 'checks/feature.test.ts']) {
  test('custom roots still bind inherited and product source edits: ' + path, async t => {
    const ctx = await customConfigured(t), folder = path.slice(0, path.lastIndexOf('/'));
    await mkdir(join(ctx.root, folder), { recursive: true });
    const before = await status(ctx); let calls = 0;
    const execute = async () => { calls++; return result('generate', {}); };
    await writeFile(join(ctx.root, path), 'export const consumerValue = 1;\n');
    await assert.rejects(setupProgress(request('generate', before.resumeHash), ctx, execute), { code: 'SETUP_INPUT_CHANGED' });
    const added = await status(ctx); assert.notEqual(added.fingerprint, before.fingerprint);
    await writeFile(join(ctx.root, path), 'export const consumerValue = 2;\n');
    await assert.rejects(setupProgress(request('generate', added.resumeHash), ctx, execute), { code: 'SETUP_INPUT_CHANGED' });
    const edited = await status(ctx); assert.notEqual(edited.fingerprint, added.fingerprint);
    await rm(join(ctx.root, path));
    await assert.rejects(setupProgress(request('generate', edited.resumeHash), ctx, execute), { code: 'SETUP_INPUT_CHANGED' });
    assert.equal(calls, 0);
    assert.ok(!(await readdir(join(ctx.root, '.framework'))).includes('setup-progress.json'));
  });
}
test('inherited source changes during custom-root verification cannot become current success', async t => {
  const ctx = await customConfigured(t);
  await mkdir(join(ctx.root, '.companion'));
  await writeFile(join(ctx.root, '.companion/generation.json'), JSON.stringify({ version: 1, projectId: 'capture', files: [{ path: 'design/project.json' }] }));
  await mkdir(join(ctx.root, 'src')); await writeFile(join(ctx.root, 'src/main.ts'), 'before');
  const response = await setupProgress(request('verify', (await status(ctx)).resumeHash), ctx, async () => {
    await writeFile(join(ctx.root, 'src/main.ts'), 'after'); return result('verify', {});
  });
  assert.equal(response.status, 'failed'); assert.equal(response.data.attempt.status, 'blocked');
  assert.ok(response.data.attempt.codes.includes('SETUP_SOURCE_CHANGED'));
  assert.equal(response.data.execution.verification, 'not-current');
});
test('inherited source links are rejected with custom roots and unrelated output stays outside the fingerprint', async t => {
  const ctx = await customConfigured(t), before = await status(ctx);
  for (const folder of ['reports', 'dist', 'node_modules']) {
    await mkdir(join(ctx.root, folder)); await writeFile(join(ctx.root, folder, 'output.json'), '{}');
  }
  assert.equal((await status(ctx)).fingerprint, before.fingerprint);
  const outside = await fixture(t); await writeFile(join(outside.root, 'outside.ts'), 'export const value = 1;');
  await symlink(outside.root, join(ctx.root, 'src'), process.platform === 'win32' ? 'junction' : 'dir');
  const rejected = await run(ctx, ['setup', 'status']);
  assert.equal(rejected.status, 'failed'); assert.equal(rejected.diagnostics[0].code, 'SETUP_SYMLINK');
  assert.equal(await readFile(join(outside.root, 'outside.ts'), 'utf8'), 'export const value = 1;');
});

test('setup Airship and MCP opt-ins are explicit and do not re-interview an imported identity',async t=>{
  const ctx=await fixture(t);const prompts=[];
  const yes=await guidedSetup({command:'setup',args:[],options:{input:'input.json'}},ctx,async message=>{prompts.push(message);return 'yes';},()=>{});
  assert.equal(prompts.length,2);assert.match(prompts[0],/Airship/);assert.match(prompts[1],/Workbench MCP/);
  assert.equal(yes.options.airship,true);assert.equal(yes.options.mcp,true);assert.equal(yes.options.id,undefined);
  for(const options of [{input:'input.json',airship:true,mcp:true},{input:'input.json','no-airship':true,'no-mcp':true}]) {
    const same=await guidedSetup({command:'setup',args:[],options},ctx,async()=>assert.fail('Explicit choice must not prompt'),()=>{});
    assert.deepEqual(same.options,options);
  }
});
