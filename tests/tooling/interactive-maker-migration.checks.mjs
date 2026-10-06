import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { projectSetupPlan } from '../../src/cli/adapters/project-setup.ts';
import { settingsMigrationPlan } from '../../src/cli/adapters/settings-migration.ts';
import { migrationFiles } from '../../src/cli/adapters/migration-files.ts';
import { applyPrepared } from '../../src/cli/adapters/storage.ts';
import { settingsPlan, loadSettings } from '../../src/cli/adapters/user-settings.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-migrate-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function setup(root) {
  assert.equal(spawnSync('git', ['init', root]).status, 0);
  await mkdir(join(root,'.obsidian')); await mkdir(join(root, 'docs/prds'), { recursive: true });
  await writeFile(join(root,'docs/prds/one.md'), '---\ntype: prd\nid: PRD-1\n---\nOriginal.\n');
  const plan=await projectSetupPlan({root,frameworkRoot},{schemaVersion:1,project:{name:'Migration',description:'Preserve source.',product:'Portable workspace.'},prds:{mode:'scan'},prototypeInterview:null,operations:[],boilerplate:false});
  await applyPrepared(plan,plan.planHash);
}
test('explicit path migration preserves binary/user source and remaps canonical provenance',async()=>scratch(async root=>{
  await setup(root); await mkdir(join(root,'apps/product/node_modules'),{recursive:true});
  const original=Buffer.from([0,255,7,13,10]); await writeFile(join(root,'apps/product/image.png'),original);
  await writeFile(join(root,'apps/product/node_modules/cache'),'retained');
  const input={schemaVersion:1,paths:{app:'client',project:'specs/application.json',prds:'requirements'}};
  const plan=await settingsMigrationPlan(root,input);
  await assert.rejects(readFile(join(root,'client/image.png')));
  assert.deepEqual(plan.data.retained,['apps/product/node_modules']);
  await applyPrepared(plan,plan.planHash);
  assert.deepEqual(await readFile(join(root,'client/image.png')),original);
  assert.equal(await readFile(join(root,'apps/product/node_modules/cache'),'utf8'),'retained');
  await assert.rejects(readFile(join(root,'apps/product/image.png')));
  const doc=JSON.parse(await readFile(join(root,'specs/application.json'),'utf8'));
  assert.equal(doc.design.prds[0].source.path,'requirements/one.md');
  assert.match(await readFile(join(root,'requirements/one.md'),'utf8'),/Original/);
  const state=JSON.parse(await readFile(join(root,'configs/project-setup.json'),'utf8'));
  assert.equal(state.paths.app,'client'); assert.equal(state.prds[0].path,'requirements/one.md');
  assert.equal((await loadSettings(root)).settings.paths.app,'client');
}));
test('migration refuses destination collisions, overlapping paths and unchanged requests',async()=>scratch(async root=>{
  await setup(root); await mkdir(join(root,'destination')); await writeFile(join(root,'destination/one.md'),'foreign');
  await assert.rejects(()=>settingsMigrationPlan(root,{schemaVersion:1,paths:{prds:'destination'}}),/destination already/);
  for(const path of ['docs/prds/nested','../escape','apps/product']) await assert.rejects(()=>settingsMigrationPlan(root,{schemaVersion:1,paths:{prds:path}}));
  await assert.rejects(()=>settingsMigrationPlan(root,{schemaVersion:1}),/No configured paths/);
  assert.equal(await readFile(join(root,'destination/one.md'),'utf8'),'foreign');
}));
test('added, deleted and modified migration sources invalidate approval without writes',async()=>scratch(async root=>{
  await setup(root); const input={schemaVersion:1,paths:{prds:'requirements'}};
  const plan=await settingsMigrationPlan(root,input);
  await writeFile(join(root,'docs/prds/new.md'),'new');
  await assert.rejects(()=>applyPrepared(plan,plan.planHash),/inventory changed/);
  await assert.rejects(readFile(join(root,'requirements/one.md')));
  await rm(join(root,'docs/prds/new.md'));
  const next=await settingsMigrationPlan(root,input);
  await writeFile(join(root,'docs/prds/one.md'),'changed');
  await assert.rejects(()=>applyPrepared(next,next.planHash),/inventory changed/);
}));
test('missing optional paths migrate preferences safely before setup; wrong kinds fail',async()=>scratch(async root=>{
  const settings=await settingsPlan(root,{schemaVersion:1});await applyPrepared(settings,settings.planHash);
  const plan=await settingsMigrationPlan(root,{schemaVersion:1,paths:{app:'client'}}); await applyPrepared(plan,plan.planHash);
  assert.equal((await loadSettings(root)).settings.paths.app,'client');
  await writeFile(join(root,'client'),'file');
  await assert.rejects(()=>migrationFiles(root,'client',true));
}));
test('migration refuses source symlinks and nested host roots',async()=>scratch(async root=>{
  await setup(root);await mkdir(join(root,'apps/product/.git'),{recursive:true});
  await assert.rejects(()=>settingsMigrationPlan(root,{schemaVersion:1,paths:{app:'client'}}),/host\/worktree/);
  await rm(join(root,'apps/product/.git'),{recursive:true});
  if(process.platform==='win32')return;
  await symlink(join(root,'docs/prds/one.md'),join(root,'apps/product/link'));
  await assert.rejects(()=>settingsMigrationPlan(root,{schemaVersion:1,paths:{app:'client'}}),/symbolic links/);
}));
