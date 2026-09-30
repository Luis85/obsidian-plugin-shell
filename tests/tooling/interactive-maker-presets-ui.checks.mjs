import assert from 'node:assert/strict';
import { realpath, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable, PassThrough } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { main } from '../../bin/shell.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(run) { const root = await mkdtemp(join(await realpath(tmpdir()), 'presets-ui-')); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); } }
test('agent discovery, validation and failures use one JSON response without opening the terminal', async () => scratch(async root => {
  const stdout = [], stderr = [];
  const io = text => ({ input: Readable.from([text]), output: new Writable({ write(chunk, _encoding, done) { stdout.push(String(chunk)); done(); } }),
    error: new Writable({ write(chunk, _encoding, done) { stderr.push(String(chunk)); done(); } }), env: { CI: '1' } });
  let input;
  for (const action of ['presets', 'guide']) {
    stdout.length = 0;
    assert.equal(await main(['new', action, '--json', '--root', root], frameworkRoot, io('')), 0);
    const data = JSON.parse(stdout.join('')).data;
    if (action === 'guide') { assert.equal(data.input.interview.answers.approved, false); assert.equal(data.input.preset, 'plugin-nuxtui'); input = data.input; input.interview.answers.title = 'Desk'; }
    else assert.deepEqual(data.flow, ['preset', 'framework', 'hybrid-targets-if-needed', 'prototype', 'agreement', 'plan-review', 'apply']);
  }
  stdout.length = 0;
  assert.equal(await main(['new', 'validate', '--input', '-', '--json', '--root', root], frameworkRoot, io(JSON.stringify(input))), 0);
  assert.equal(JSON.parse(stdout.join('')).data.ready, false);
  const { interview, ...selection } = input;
  const retired = { ...selection, prototypeRequest: interview };
  for (const args of [['new', 'validate', '--input', '-'], ['new', '--input', '-', '--out', 'prepared']]) {
    stdout.length = 0;
    assert.equal(await main([...args, '--json', '--root', root], frameworkRoot, io(JSON.stringify(retired))), 1);
    const response = JSON.parse(stdout.join(''));
    assert.equal(response.status, 'failed'); assert.equal(response.diagnostics[0].code, 'MAKER_UNKNOWN_FIELD');
  }
  for (const args of [['new', 'unexpected'], ['new', '--kind', 'clickdummy'], ['new', '--input', '-']]) {
    stdout.length = 0;
    assert.equal(await main([...args, '--json', '--root', root], frameworkRoot, io('{"prototype":{}}')), 1);
    assert.equal(JSON.parse(stdout.join('')).status, 'failed');
  }
  assert.deepEqual(stderr, []); assert.deepEqual(await readdir(root), []);
}));
test('interactive new and the empty default workspace start at presets and restore cancellation', async () => scratch(async root => {
  for (const command of ['new', 'studio']) {
    const input = new PassThrough(); input.isTTY = true; let answered = false; const stdout = [];
    const error = new Writable({ write(chunk, _encoding, done) {
      if (String(chunk).includes('Choose number or ID') && !answered) { answered = true; queueMicrotask(() => input.write(':back\n')); }
      done();
    } }); error.isTTY = true;
    const code = await main([command, '--ui', 'plain', '--root', root], frameworkRoot, { input,
      output: new Writable({ write(chunk, _encoding, done) { stdout.push(String(chunk)); done(); } }), error, env: {} });
    assert.equal(code, 130); assert.equal(answered, true); assert.deepEqual(stdout, []); input.destroy();
  }
}));
