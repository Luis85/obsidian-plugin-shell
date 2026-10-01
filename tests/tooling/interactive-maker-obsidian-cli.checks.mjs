import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { obsidianRead } from '../../bin/adapters/framework/obsidian-cli.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { continueSetup } from '../../bin/presentation/terminal/setup-terminal.ts';
import { result } from '../../bin/adapters/framework/contracts.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

/** Runs one case in a fresh project root; works under both node:test and Vitest. */
async function withRoot(run) {
  // realpath: macOS tmpdir is under the /var symlink, which the documentation reader rightly refuses.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'shell-obsidian-cli-')));
  try {
    await mkdir(join(root,'design'),{recursive:true});
    await writeFile(join(root,'design/project.json'),'{}');
    await run(root);
  } finally { await rm(root,{recursive:true,force:true}); }
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
test('status pins 1.12.7+ and always targets the explicitly selected vault first', () => withRoot(async root => {
  const fake=port({
    'version':'1.12.7\n','vault=Work|vault|info=name':'Work\n','vault=Work|vault|info=path': join(root,'vault')+'\n',
    'vault=Work|files|total':'3\n','vault=Work|folders|total':'2\n'
  });
  const value=await obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},fake);
  assert.equal(value.status,'ok'); assert.equal(value.data.cli.version,'1.12.7'); assert.equal(value.data.vault.files,3);
  assert.ok(fake.calls.slice(1).every(args=>args[0]==='vault=Work')); assert.deepEqual(value.data.capabilities.writes,[]);
}));
test('old CLI, ambient vault fallback, hidden/traversal reads and non-Markdown reads fail closed', () => withRoot(async root => {
  await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},port({'version':'1.12.6'})),/1\.12\.7/);
  await assert.rejects(obsidianRead(request('obsidian read',{}),{root,frameworkRoot:root},port({'version':'1.12.7'})),/explicit --obsidian-vault/);
  for(const path of ['../secret.md','.obsidian/app.json','folder/../secret.md','note.txt'])
    await assert.rejects(obsidianRead(request('obsidian read',{'obsidian-vault':'Work','obsidian-path':path}),{root,frameworkRoot:root},port({'version':'1.12.7'})));
}));
test('prepare reads only configured Markdown candidates and proposes existing reviewed docs import without vault writes', () => withRoot(async root => {
  const vault=join(root,'vault');
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
}));
test('catalog exposes only the read adapter surface; dangerous Obsidian commands are not parseable',()=>{
  for(const command of [['obsidian','status'],['obsidian','files'],['obsidian','read'],['obsidian','prepare']])
    assert.ok(parseCliArguments([...command,'--obsidian-vault','Work']).command.startsWith('obsidian '));
  for(const denied of [['obsidian','eval'],['obsidian','dev:cdp'],['obsidian','plugin:install'],['obsidian','plugin:enable'],['obsidian','restricted-mode']])
    assert.throws(()=>parseCliArguments([...denied,'--obsidian-vault','Work']));
});
test('setup opt-in verifies the named vault, prepares on request and imports its typed notes through reviewed plans', async () => {
  const notes = ['/vault/docs/application/project.md', '/vault/docs/application/page.md'];
  const answers = ['yes', 'Work', 'yes', 'yes', 'yes', 'no', 'no'], prompts = [], calls = [];
  const execute = async request => {
    calls.push(request);
    if (request.command === 'obsidian status') return result(request.command, { vault: { selector: 'Work' } });
    if (request.command === 'obsidian prepare') return result(request.command, { import: { batches: [['node', 'bin/app', 'docs', 'import', ...notes, '--dry-run', '--json']] } });
    return request.options.apply ? result(request.command, {}, 'applied') : result(request.command, { planHash: 'c'.repeat(64) }, 'planned');
  };
  const outcome = await continueSetup({ root: '/', frameworkRoot: '/' }, execute, async question => { prompts.push(question); return answers.shift(); }, () => {}, result('setup', {}, 'applied'));
  assert.equal(outcome.status, 'applied'); assert.equal(answers.length, 0);
  assert.deepEqual(calls.map(request => request.command), ['obsidian status', 'obsidian prepare', 'docs import', 'docs import']);
  assert.deepEqual(calls.slice(0, 2).map(request => request.options), [{ 'obsidian-vault': 'Work' }, { 'obsidian-vault': 'Work' }]);
  assert.deepEqual(calls[2].args, notes); assert.equal(calls[3].options.apply, 'c'.repeat(64));
  assert.match(prompts[3], /Import 2 supported typed note\(s\) found in the Obsidian vault/);
  assert.ok(!prompts.some(question => /^File or folder/.test(question)), 'vault notes replace the generic import path question');
});
test('an unavailable Obsidian CLI or a declined prepare only skips the vault step', async () => {
  // Remaining answers decline the generic docs import, generation and docs export.
  for (const [failing, answers] of [[true, ['yes', 'Work', 'no', 'no', 'no']], [false, ['yes', 'Work', 'no', 'no', 'no', 'no']]]) {
    const calls = [], expected = ['obsidian status'];
    const execute = async request => { calls.push(request.command);
      return request.command === 'obsidian status' && failing ? result(request.command, null, 'failed') : result(request.command, {}); };
    const outcome = await continueSetup({ root: '/', frameworkRoot: '/' }, execute, async () => answers.shift(), () => {}, result('setup', {}, 'applied'));
    assert.equal(outcome.status, 'applied'); assert.deepEqual(calls, expected); assert.equal(answers.length, 0);
  }
});
test('files and read stay inside the selected vault, deduplicate listings and deny unlisted commands', () => withRoot(async root => {
  const context={root,frameworkRoot:root}, fake=port({
    'version':'Obsidian 1.13.0','vault=Work|files|folder=docs|ext=md':'docs/b.md\ndocs/a.md\ndocs/b.md\n',
    'vault=Work|files|ext=md':'a.md\n','vault=Work|read|path=docs/a.md':'# A\n'
  });
  const listed=await obsidianRead(request('obsidian files',{'obsidian-vault':'Work','obsidian-folder':'docs'}),context,fake);
  assert.deepEqual(listed.data.files,['docs/a.md','docs/b.md']); assert.equal(listed.data.folder,'docs');
  assert.equal((await obsidianRead(request('obsidian files',{'obsidian-vault':'Work'}),context,fake)).data.folder,null);
  const read=await obsidianRead(request('obsidian read',{'obsidian-vault':'Work','obsidian-path':'docs/a.md'}),context,fake);
  assert.equal(read.data.content,'# A\n'); assert.equal(read.data.path,'docs/a.md');
  await assert.rejects(obsidianRead(request('obsidian read',{'obsidian-vault':'Work'}),context,fake),/obsidian-path/);
  await assert.rejects(obsidianRead(request('obsidian eval',{'obsidian-vault':'Work'}),context,fake),error=>error.code==='OBSIDIAN_COMMAND_DENIED');
  await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'-Work'}),context,fake),error=>error.code==='OBSIDIAN_VAULT_REQUIRED');
  await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),context,port({'version':'no version'})),error=>error.code==='OBSIDIAN_VERSION_INVALID');
}));
test('the system port reports a missing CLI and honours cancellation without returning stderr', () => withRoot(async root => {
  const path=process.env.PATH; process.env.PATH=join(root,'empty');
  try {
    await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root}),error=>error.code==='OBSIDIAN_CLI_MISSING');
    const controller=new AbortController(); controller.abort();
    await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root,signal:controller.signal}),error=>error.code==='CANCELLED');
  } finally { process.env.PATH=path; }
}));
