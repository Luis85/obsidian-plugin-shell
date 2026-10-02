import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { loadPrototypeWorkspace } from '../../bin/adapters/framework/prototype-workspace.ts';
import { managedGenerationPlan } from '../../bin/adapters/framework/prototype-generation.ts';
import { document } from '../support/prototype-fixture.mjs';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-integrity-')));
  t.after(() => rm(root, {recursive:true, force:true}));
  await writeFile(join(root, 'source.json'), JSON.stringify(document()));
  return {root, frameworkRoot};
}
async function orphaned(t) {
  const context = await fixture(t);
  const result = await executeOperation(parseCliArguments(['prototypes','create','exploration','--input','source.json','--yes']), context);
  assert.equal(result.status, 'applied', JSON.stringify(result));
  await rm(join(context.root, 'docs/concepts/prototypes.json'));
  return context;
}
test('a missing registry cannot silently turn a previously managed library into an unmanaged project', async t => {
  const context = await orphaned(t);
  const manifest = await readFile(join(context.root, 'docs/concepts/exploration/prototype.json'), 'utf8');
  await assert.rejects(loadPrototypeWorkspace(context), {code:'PROTOTYPE_REGISTRY_MISSING'});
  assert.equal(await readFile(join(context.root, 'docs/concepts/exploration/prototype.json'), 'utf8'), manifest);
});
test('default generation never reaches the compiler fallback after registry loss', async t => {
  const context = await orphaned(t); let calls = 0;
  // Only the compiler port is injected; registry detection executes the real filesystem adapter.
  const compile = async () => { calls++; return {source:'unmanaged-fallback'}; };
  await assert.rejects(managedGenerationPlan(parseCliArguments(['generate']), context, compile), {code:'PROTOTYPE_REGISTRY_MISSING'});
  assert.equal(calls, 0);
});
test('a generated consumer can retain provenance without owning the source prototype library', async t => {
  const context = await fixture(t);
  await mkdir(join(context.root, '.companion'));
  const receipt = '{"schemaVersion":1,"projectId":"design-lab"}';
  await writeFile(join(context.root, '.companion/prototype-selection.json'), receipt);
  assert.deepEqual(await loadPrototypeWorkspace(context), {workspace:null, files:new Map()});
  let calls = 0;
  await managedGenerationPlan(parseCliArguments(['generate']), context, async () => {calls++; return {};});
  assert.equal(calls, 1);
  assert.equal(await readFile(join(context.root, '.companion/prototype-selection.json'), 'utf8'), receipt);
});
test('ordinary unrelated concept documents retain standalone compatibility and are never modified', async t => {
  const context = await fixture(t);
  await mkdir(join(context.root, 'docs/concepts/unmanaged'), {recursive:true});
  await writeFile(join(context.root, 'docs/concepts/unmanaged/prototype.manifest.json'), '{"format":"unrelated-concept"}');
  const before = await readdir(context.root, {recursive:true});
  assert.deepEqual(await loadPrototypeWorkspace(context), {workspace:null, files:new Map()});
  let calls = 0;
  await managedGenerationPlan(parseCliArguments(['generate']), context, async () => {calls++; return {};});
  assert.equal(calls, 1); assert.deepEqual(await readdir(context.root, {recursive:true}), before);
});
test('explicit standalone input still bypasses managed selection intentionally', async t => {
  const context = await orphaned(t); let calls = 0;
  const result = await managedGenerationPlan(parseCliArguments(['generate','--input','source.json']), context,
    async () => {calls++; return {standalone:true};});
  assert.equal(calls, 1); assert.deepEqual(result, {standalone:true});
});
test('partial prototype metadata blocks fallback without parsing or overwriting corrupt bytes', async t => {
  const context = await fixture(t);
  await mkdir(join(context.root, 'docs/concepts/exploration'), {recursive:true});
  const path = join(context.root, 'docs/concepts/exploration/prototype.json');
  await writeFile(path, '{partial');
  await assert.rejects(loadPrototypeWorkspace(context), {code:'PROTOTYPE_REGISTRY_MISSING'});
  assert.equal(await readFile(path,'utf8'), '{partial');
});
test('missing-registry inspection refuses a symlinked concepts ancestor without traversing outside the project', async t => {
  const context = await fixture(t), outside = await fixture(t);
  await mkdir(join(context.root,'docs'));
  try { await symlink(outside.root, join(context.root,'docs/concepts'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM','EACCES'].includes(error.code)) return t.skip('Symlink creation is unavailable'); throw error; }
  await assert.rejects(loadPrototypeWorkspace(context), /PLAN_SYMLINK|PROTOTYPE_LINK/);
  assert.deepEqual(await readdir(outside.root), ['source.json']);
});
test('an aborted missing-registry inspection performs no fallback', async t => {
  const context = await fixture(t), controller = new AbortController(); controller.abort();
  await assert.rejects(loadPrototypeWorkspace({...context, signal:controller.signal}), {code:'CANCELLED'});
});
