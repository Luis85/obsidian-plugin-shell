import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  portablePath, loadHandoutWorkspace, prepareHandout, prepareHandoutRefresh, inspectHandout,
} from '../../bin/adapters/framework/handout-workspace.ts';
import { HANDOUT_PATH, readSnapshot } from '../../bin/adapters/framework/handout-model.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

async function workspace(t) {
  const root=await mkdtemp(join(tmpdir(),'maker-handout-workspace-'));
  after(t, ()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'docs/prds'),{recursive:true});
  await writeFile(join(root,'docs/prds/PRD-1.md'),'# Example\n');
  return root;
}

test('relocated handout workspace preserves compatibility and deterministic read-only preparation', async t => {
  const root=await workspace(t);
  const first=await prepareHandout(root),second=await prepareHandout(root);
  assert.deepEqual(first,second);
  assert.equal(first.entries[0].path,HANDOUT_PATH);
  await assert.rejects(readFile(join(root,HANDOUT_PATH)),{code:'ENOENT'});
});

test('existing human-owned handouts are preserved instead of overwritten', async t => {
  const root=await workspace(t);
  await writeFile(join(root,HANDOUT_PATH),'# Human owned\n');
  const prepared=await prepareHandout(root);
  assert.equal(prepared.entries.length,0);
  assert.equal(prepared.summary.action,'preserved');
  await assert.rejects(prepareHandoutRefresh(root), { code: 'HANDOUT_METADATA' });
});

test('configured and explicit PRD roots plus first-run suggestions are honored without approval', async t => {
  const root=await workspace(t);
  await mkdir(join(root,'configs')); await mkdir(join(root,'requirements'));
  await writeFile(join(root,'requirements/one.md'),'# One');
  await writeFile(join(root,'configs/user-settings.json'),JSON.stringify({paths:{prds:'requirements',source:'app'},preferences:{firstRun:'showcase'},secrets:{token:'DO-NOT-EMBED'}}));
  const prepared=await prepareHandout(root),text=prepared.entries[0].content;
  assert.ok(text.includes('requirements/one.md')); assert.ok(text.includes('source=app'));
  assert.ok(text.includes('Answer: showcase')); assert.ok(!text.includes('DO-NOT-EMBED'));
  assert.equal((text.match(/^- \[x\]/gm)??[]).length,0);
  assert.equal((await loadHandoutWorkspace(root,{prds:'docs/prds'})).prdCount,1);
});

test('virtual setup fingerprints match the settings bytes eventually written', async t => {
  const root=await workspace(t);
  const content=JSON.stringify({project:{name:'Example',id:'example',author:'Team',description:'Demo'},paths:{codebaseFolder:'src',testsFolder:'tests'}},null,2)+'\n';
  const prepared=await prepareHandout(root,{virtualFiles:{'shell.config.json':content}});
  await writeFile(join(root,'shell.config.json'),content); await writeFile(join(root,HANDOUT_PATH),prepared.entries[0].content);
  assert.ok(!(await inspectHandout(root)).diagnostics.some(item=>item.code==='HANDOUT_SOURCES_STALE'));
  await assert.rejects(prepareHandout(root,{virtualFiles:{'other.json':'{}'}}), { code: 'HANDOUT_VIRTUAL_INPUT' });
});

test('source changes and explicit PRD overrides persist through refresh', async t => {
  const root=await workspace(t); await mkdir(join(root,'chosen')); await writeFile(join(root,'chosen/one.md'),'# Chosen');
  const prepared=await prepareHandout(root,{prds:'chosen'}); await writeFile(join(root,HANDOUT_PATH),prepared.entries[0].content);
  await writeFile(join(root,'chosen/two.md'),'# Two');
  assert.ok((await inspectHandout(root)).diagnostics.some(item=>item.code==='HANDOUT_SOURCES_STALE'));
  const refreshed=await prepareHandoutRefresh(root);
  const snapshot=readSnapshot(refreshed.entries[0].content);
  assert.equal(snapshot.prdsRoot,'chosen'); assert.equal(snapshot.prdsMode,'explicit');
});

test('portable handout paths reject absolute traversal Windows and protected roots', () => {
  assert.equal(portablePath('docs/prds'),'docs/prds');
  for(const path of ['../outside','/etc','C:\\data','.git','.obsidian','a/../b','a//b','.','node_modules/docs','a\\b']) assert.throws(()=>portablePath(path), { code: 'HANDOUT_PATH' });
});

test('handout workspace refuses symlinks malformed settings invalid modes and oversized or binary PRDs', async t => {
  const root=await workspace(t);
  await symlink(join(root,'docs/prds/PRD-1.md'),join(root,'docs/prds/link.md'));
  await assert.rejects(prepareHandout(root), { code: 'HANDOUT_SYMLINK' });
  await rm(join(root,'docs/prds/link.md'));
  await mkdir(join(root,'configs'));
  await writeFile(join(root,'configs/user-settings.json'),'{no');
  await assert.rejects(prepareHandout(root), { code: 'HANDOUT_SETTINGS_JSON' });
  await writeFile(join(root,'configs/user-settings.json'),JSON.stringify({preferences:{firstRun:'deploy'}}));
  await assert.rejects(prepareHandout(root), { code: 'HANDOUT_RUN_MODE' });
  await rm(join(root,'configs/user-settings.json'));
  await writeFile(join(root,'docs/prds/huge.md'),'x'.repeat(1_000_001));
  await assert.rejects(prepareHandout(root), { code: 'HANDOUT_INPUT_LIMIT' });
  await rm(join(root,'docs/prds/huge.md'));
  await writeFile(join(root,'docs/prds/binary.md'),Buffer.from([0,0,1]));
  await assert.rejects(prepareHandout(root), { code: 'HANDOUT_INPUT_LIMIT' });
});

test('BOM changes participate in fingerprints while BOM settings remain readable', async t => {
  const root=await workspace(t),before=await loadHandoutWorkspace(root);
  const path=join(root,'docs/prds/PRD-1.md'); await writeFile(path,'\uFEFF'+await readFile(path,'utf8'));
  assert.notEqual((await loadHandoutWorkspace(root)).snapshot.fingerprint,before.snapshot.fingerprint);
  await writeFile(join(root,'shell.config.json'),'\uFEFF'+JSON.stringify({project:{name:'BOM example'}}));
  assert.ok((await prepareHandout(root)).entries[0].content.includes('BOM example'));
});
