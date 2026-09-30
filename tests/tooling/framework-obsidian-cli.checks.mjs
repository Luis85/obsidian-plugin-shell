import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { obsidianRead } from '../../scripts/framework/obsidian-cli.ts';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'shell-obsidian-cli-')); t.after(() => rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'design'),{recursive:true});
  await writeFile(join(root,'design/project.json'),'{}');
  return root;
}
function request(command, options={}) { return { command, args: [], options }; }
function port(responses) {
  const calls=[]; return { calls, async run(args) { calls.push([...args]); const key=args.join('|'); if(!(key in responses)) throw Error('unexpected '+key); return responses[key]; } };
}
const typed=`---
doc_schema: 1
type: page
id: node-40
project: documentation-demo
title: Project overview
surface_kind: view
---

# Project overview
`;
test('status pins 1.12.7+ and always targets the explicitly selected vault first', async t => {
  const root=await fixture(t), fake=port({
    'version':'1.12.7\n','vault=Work|vault|info=name':'Work\n','vault=Work|vault|info=path': join(root,'vault')+'\n',
    'vault=Work|files|total':'3\n','vault=Work|folders|total':'2\n'
  });
  const value=await obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},fake);
  assert.equal(value.status,'ok'); assert.equal(value.data.cli.version,'1.12.7'); assert.equal(value.data.vault.files,3);
  assert.ok(fake.calls.slice(1).every(args=>args[0]==='vault=Work')); assert.deepEqual(value.data.capabilities.writes,[]);
});
test('old CLI, ambient vault fallback, hidden/traversal reads and non-Markdown reads fail closed', async t => {
  const root=await fixture(t);
  await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},port({'version':'1.12.6'})),/1\.12\.7/);
  await assert.rejects(obsidianRead(request('obsidian read',{}),{root,frameworkRoot:root},port({'version':'1.12.7'})),/explicit --obsidian-vault/);
  for(const path of ['../secret.md','.obsidian/app.json','folder/../secret.md','note.txt'])
    await assert.rejects(obsidianRead(request('obsidian read',{'obsidian-vault':'Work','obsidian-path':path}),{root,frameworkRoot:root},port({'version':'1.12.7'})));
});
test('prepare reads only configured Markdown candidates and proposes existing reviewed docs import without vault writes', async t => {
  const root=await fixture(t),vault=join(root,'vault');
  const fake=port({
    'version':'1.12.7',
    'vault=Work|vault|info=path':vault,
    'vault=Work|files|ext=md':['docs/application/project.md','docs/application/generated/index.md','Other.md'].join('\n')+'\n',
    'vault=Work|read|path=docs/application/project.md':typed,
    'vault=Work|read|path=docs/application/generated/index.md':'# generated index\n'
  });
  const value=await obsidianRead(request('obsidian prepare',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},fake);
  assert.equal(value.status,'ok'); assert.equal(value.data.scan.typed,1); assert.equal(value.data.scan.untyped,1);
  assert.deepEqual(value.data.scan.typedPaths,['docs/application/project.md']);
  assert.equal(value.data.import.writesVault,false); assert.equal(value.data.import.reviewedPlanRequired,true);
  assert.equal(value.data.import.batches.length,1); assert.ok(value.data.import.batches[0].includes('docs'));
  const proposed=value.data.import.batches[0];
  assert.deepEqual(proposed.slice(0,4),['node','bin/app','docs','import']);
  const parsed=parseCliArguments(proposed.slice(2));
  assert.equal(parsed.command,'docs import'); assert.deepEqual(parsed.args,[join(vault,'docs','application','project.md')]);
  assert.equal(parsed.options['dry-run'],true); assert.equal(parsed.options.json,true);
  assert.ok(parsed.args.length<=32);
  const invoked=new Set(fake.calls.map(args=>args[1] ?? args[0]));
  for(const denied of ['eval','dev:cdp','create','append','prepend','move','rename','delete','plugin:install','plugin:enable']) assert.equal(invoked.has(denied),false);
});
test('catalog exposes only the read adapter surface; dangerous Obsidian commands are not parseable',()=>{
  for(const command of [['obsidian','status'],['obsidian','files'],['obsidian','read'],['obsidian','prepare']])
    assert.ok(parseCliArguments([...command,'--obsidian-vault','Work']).command.startsWith('obsidian '));
  for(const denied of [['obsidian','eval'],['obsidian','dev:cdp'],['obsidian','plugin:install'],['obsidian','plugin:enable'],['obsidian','restricted-mode']])
    assert.throws(()=>parseCliArguments([...denied,'--obsidian-vault','Work']));
});
