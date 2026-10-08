import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { EventEmitter } from 'node:events';
import { obsidianRead, systemPort } from '../adapters/framework/obsidian-cli.ts';
import { parseCliArguments } from '../adapters/framework/catalog.ts';

/** Runs a check against a disposable project root that is removed afterwards. */
async function withFixture(check) {
  // realpath: macOS tmpdir is under the /var symlink, which the documentation reader rightly refuses.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'shell-obsidian-cli-')));
  try {
    await mkdir(join(root,'design'),{recursive:true});
    await writeFile(join(root,'design/project.json'),'{}');
    await check(root);
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
test('status pins 1.12.7+ and always targets the explicitly selected vault first', () => withFixture(async root => {
  const fake=port({
    'version':'1.12.7\n','vault=Work|vault|info=name':'Work\n','vault=Work|vault|info=path': join(root,'vault')+'\n',
    'vault=Work|files|total':'3\n','vault=Work|folders|total':'2\n'
  });
  const value=await obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},fake);
  assert.equal(value.status,'ok'); assert.equal(value.data.cli.version,'1.12.7'); assert.equal(value.data.vault.files,3);
  assert.ok(fake.calls.slice(1).every(args=>args[0]==='vault=Work')); assert.deepEqual(value.data.capabilities.writes,[]);
}));
test('old CLI, ambient vault fallback, hidden/traversal reads and non-Markdown reads fail closed', () => withFixture(async root => {
  await assert.rejects(obsidianRead(request('obsidian status',{'obsidian-vault':'Work'}),{root,frameworkRoot:root},port({'version':'1.12.6'})),/1\.12\.7/);
  await assert.rejects(obsidianRead(request('obsidian read',{}),{root,frameworkRoot:root},port({'version':'1.12.7'})),/explicit --obsidian-vault/);
  for(const path of ['../secret.md','.obsidian/app.json','folder/../secret.md','note.txt'])
    await assert.rejects(obsidianRead(request('obsidian read',{'obsidian-vault':'Work','obsidian-path':path}),{root,frameworkRoot:root},port({'version':'1.12.7'})));
}));
test('prepare reads only configured Markdown candidates and proposes existing reviewed docs import without vault writes', () => withFixture(async root => {
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
  const { continueSetup } = await import('../presentation/terminal/setup-terminal.ts');
  const { result } = await import('../adapters/framework/contracts.ts');
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
  const { continueSetup } = await import('../presentation/terminal/setup-terminal.ts');
  const { result } = await import('../adapters/framework/contracts.ts');
  // Remaining answers decline the generic docs import, generation and docs export.
  for (const [failing, answers] of [[true, ['yes', 'Work', 'no', 'no', 'no']], [false, ['yes', 'Work', 'no', 'no', 'no', 'no']]]) {
    const calls = [], expected = ['obsidian status'];
    const execute = async request => { calls.push(request.command);
      return request.command === 'obsidian status' && failing ? result(request.command, null, 'failed') : result(request.command, {}); };
    const outcome = await continueSetup({ root: '/', frameworkRoot: '/' }, execute, async () => answers.shift(), () => {}, result('setup', {}, 'applied'));
    assert.equal(outcome.status, 'applied'); assert.deepEqual(calls, expected); assert.equal(answers.length, 0);
  }
});

/** A scripted child process: the test decides what it writes, how it exits and whether it errors. */
function fakeLaunch(script) {
  const launches = [];
  const launch = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.killed = [];
    child.kill = signal => { child.killed.push(signal); if (script.killThrows) throw new Error('already closed'); if (script.closeOnKill) child.emit('close', null); return true; };
    launches.push({ command, args, options, child });
    queueMicrotask(() => script.run?.(child));
    return child;
  };
  return { launch, launches };
}
const code = async pending => { try { await (typeof pending === 'function' ? pending() : pending); return 'resolved'; } catch (error) { return error.code; } };

test('system port runs the official CLI without a shell and decodes bounded UTF-8 output', async () => {
  const { launch, launches } = fakeLaunch({ run: child => { child.stdout.emit('data', Buffer.from('1.12.')); child.stdout.emit('data', Buffer.from('7\n')); child.emit('close', 0); } });
  assert.equal(await systemPort({ root: '/project' }, launch).run(['version']), '1.12.7\n');
  assert.equal(launches[0].command, 'obsidian'); assert.deepEqual(launches[0].args, ['version']);
  assert.equal(launches[0].options.shell, false); assert.equal(launches[0].options.cwd, '/project');
  assert.equal(await code(() => systemPort({ root: '/' }, launch).run([])), 'OBSIDIAN_ARGUMENT_INVALID');
  assert.equal(await code(() => systemPort({ root: '/' }, launch).run(['read', 'path=a\0b'])), 'OBSIDIAN_ARGUMENT_INVALID');
  assert.equal(launches.length, 1, 'invalid arguments never launch a process');
});
test('system port maps missing, failing, oversized, invalid and slow CLI runs to bounded errors', async () => {
  const run = (script, timeout) => code(systemPort({ root: '/' }, fakeLaunch(script).launch, timeout).run(['version']));
  assert.equal(await run({ run: child => child.emit('error', Object.assign(new Error('spawn'), { code: 'ENOENT' })) }), 'OBSIDIAN_CLI_MISSING');
  assert.equal(await run({ run: child => child.emit('error', Object.assign(new Error('spawn'), { code: 'EACCES' })) }), 'OBSIDIAN_CLI_FAILED');
  assert.equal(await run({ run: child => { child.stderr.emit('data', Buffer.from('secret')); child.emit('close', 2); } }), 'OBSIDIAN_CLI_FAILED');
  assert.equal(await run({ run: child => { child.stderr.emit('data', Buffer.alloc(4 * 1024 * 1024 + 1)); child.emit('close', 0); } }), 'OBSIDIAN_CLI_FAILED');
  assert.equal(await run({ run: child => { child.stdout.emit('data', Buffer.from([0xff, 0xfe])); child.emit('close', 0); } }), 'OBSIDIAN_OUTPUT_INVALID');
  assert.equal(await run({ run: child => { child.stdout.emit('data', Buffer.alloc(4 * 1024 * 1024 + 1)); child.emit('close', 0); } }), 'OBSIDIAN_OUTPUT_LIMIT');
  assert.equal(await run({ closeOnKill: true }, 1), 'OBSIDIAN_CLI_TIMEOUT');
  assert.equal(await run({ killThrows: true, run: child => { child.stdout.emit('data', Buffer.alloc(4 * 1024 * 1024 + 1)); child.emit('close', 0); } }), 'OBSIDIAN_OUTPUT_LIMIT');
});
test('system port honours cancellation before and during a read', async () => {
  const before = new AbortController(); before.abort();
  const early = fakeLaunch({});
  assert.equal(await code(systemPort({ root: '/', signal: before.signal }, early.launch).run(['version'])), 'CANCELLED');
  assert.deepEqual(early.launches[0].child.killed, ['SIGTERM']);
  const during = new AbortController(), late = fakeLaunch({ run: () => during.abort() });
  assert.equal(await code(systemPort({ root: '/', signal: during.signal }, late.launch).run(['version'])), 'CANCELLED');
});
test('files, read and unknown commands keep the read-only contract', () => withFixture(async root => {
  const context = { root, frameworkRoot: root };
  const listed = await obsidianRead(request('obsidian files', { 'obsidian-vault': 'Work', 'obsidian-folder': 'docs' }), context,
    port({ version: 'Obsidian 2.0.0', 'vault=Work|files|folder=docs|ext=md': 'docs/b.md\ndocs/a.md\r\ndocs/a.md\n' }));
  assert.deepEqual(listed.data.files, ['docs/a.md', 'docs/b.md']); assert.equal(listed.data.cli.version, '2.0.0');
  const all = await obsidianRead(request('obsidian files', { 'obsidian-vault': 'Work' }), context, port({ version: '1.13.0', 'vault=Work|files|ext=md': '' }));
  assert.equal(all.data.folder, null); assert.deepEqual(all.data.files, []);
  const note = await obsidianRead(request('obsidian read', { 'obsidian-vault': 'Work', 'obsidian-path': 'a.md' }), context, port({ version: '1.12.7', 'vault=Work|read|path=a.md': '# A\n' }));
  assert.equal(note.data.content, '# A\n');
  const fails = (command, options, responses = { version: '1.12.7' }) => code(obsidianRead(request(command, { 'obsidian-vault': 'Work', ...options }), context, port(responses)));
  assert.equal(await fails('obsidian read', {}), 'OBSIDIAN_PATH_REQUIRED');
  assert.equal(await fails('obsidian files', { 'obsidian-folder': '.hidden' }), 'OBSIDIAN_PATH_INVALID');
  assert.equal(await fails('obsidian eval', {}), 'OBSIDIAN_COMMAND_DENIED');
  assert.equal(await fails('obsidian status', {}, { version: 'unknown' }), 'OBSIDIAN_VERSION_INVALID');
  for (const version of ['0.99.0', '1.11.9', '1.12.6']) assert.equal(await fails('obsidian status', {}, { version }), 'OBSIDIAN_VERSION_UNSUPPORTED');
  for (const selector of ['', ' Work', '-Work', 'a=b', 'x'.repeat(201)])
    assert.equal(await code(obsidianRead(request('obsidian status', { 'obsidian-vault': selector }), context, port({}))), 'OBSIDIAN_VAULT_REQUIRED');
}));
test('status and prepare refuse invalid vault output and oversized scans', () => withFixture(async root => {
  const context = { root, frameworkRoot: root };
  const status = (path, files = '1') => code(obsidianRead(request('obsidian status', { 'obsidian-vault': 'Work' }), context, port({
    version: '1.12.7', 'vault=Work|vault|info=name': 'Work', 'vault=Work|vault|info=path': path, 'vault=Work|files|total': files, 'vault=Work|folders|total': '0' })));
  assert.equal(await status('relative/vault'), 'OBSIDIAN_OUTPUT_INVALID');
  assert.equal(await status(join(root, 'vault'), '-1'), 'OBSIDIAN_OUTPUT_INVALID');
  const prepare = (path, inventory, reads = {}) => obsidianRead(request('obsidian prepare', { 'obsidian-vault': 'Work' }), context, port({
    version: '1.12.7', 'vault=Work|vault|info=path': path, 'vault=Work|files|ext=md': inventory, ...reads }));
  assert.equal(await code(prepare('', '')), 'OBSIDIAN_OUTPUT_INVALID');
  const many = Array.from({ length: 501 }, (_, index) => `docs/application/n${index}.md`).join('\n');
  assert.equal(await code(prepare(join(root, 'vault'), many)), 'OBSIDIAN_SCAN_LIMIT');
  const big = 'x'.repeat(16 * 1024 * 1024 + 1);
  assert.equal(await code(prepare(join(root, 'vault'), 'docs/application/a.md', { 'vault=Work|read|path=docs/application/a.md': big })), 'OBSIDIAN_SCAN_LIMIT');
  const broken = await prepare(join(root, 'vault'), 'docs/application/bad.md', { 'vault=Work|read|path=docs/application/bad.md': '---\ndoc_schema: [\n---\n' });
  assert.equal(broken.data.scan.typed, 0); assert.deepEqual(broken.data.import.batches, []);
  assert.match(broken.data.import.next, /No supported typed Markdown/);
}));
test('setup Obsidian step skips cleanly on decline, blank vault, failed status or prepare and malformed batches', async () => {
  const { setupObsidian } = await import('../presentation/terminal/obsidian-setup.ts');
  const { result } = await import('../adapters/framework/contracts.ts');
  const run = async (answers, respond) => {
    const calls = [];
    const batches = await setupObsidian({ root: '/' }, async request => { calls.push(request.command); return respond(request); }, async () => answers.shift() ?? '', () => {});
    return { batches, calls };
  };
  assert.deepEqual(await run(['n'], () => assert.fail('no call')), { batches: [], calls: [] });
  assert.deepEqual(await run(['y', '  '], () => assert.fail('no call')), { batches: [], calls: [] });
  assert.deepEqual(await run(['y', 'Work', 'no'], request => result(request.command, {})), { batches: [], calls: ['obsidian status'] });
  assert.deepEqual((await run(['y', 'Work', 'y'], request => request.command === 'obsidian prepare' ? result(request.command, null, 'failed') : result(request.command, {}))).batches, []);
  assert.deepEqual((await run(['y', 'Work', 'y'], request => result(request.command, { import: { batches: 'none' } }))).batches, []);
  const mixed = await run(['y', 'Work', 'y'], request => result(request.command, { import: { batches: [['node', 'bin/app', 'docs', 'import', '/v/a.md', 3, '--json'], 'skip', ['node', 'bin/app', 'docs', 'import', '--json']] } }));
  assert.deepEqual(mixed.batches, [['/v/a.md']]);
});
