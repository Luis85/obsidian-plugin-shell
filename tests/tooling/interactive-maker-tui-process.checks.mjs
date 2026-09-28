import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { realpath, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { main } from '../../bin/shell.ts';
import { parseArguments } from '../../bin/adapters/commands.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
function streams(onScreen = () => {}) {
  const input = new PassThrough(), raw = [], output = [], screen = [];
  input.isTTY = true; input.isRaw = false; input.setRawMode = value => { raw.push(value); input.isRaw = value; };
  const stdout = new Writable({ write(chunk, _encoding, done) { output.push(String(chunk)); done(); } });
  const stderr = new Writable({ write(chunk, _encoding, done) { const value = String(chunk); screen.push(value); onScreen(value, input); done(); } });
  stderr.isTTY = true; stderr.columns = 100; stderr.rows = 30;
  return { input, output, screen, raw, io: { input, output: stdout, error: stderr, env: {} }, close() { input.destroy(); stdout.destroy(); stderr.destroy(); } };
}
test('machine flags and CI bypass all terminal ownership even with attached TTY streams', async () => {
  for (const argv of [['studio', '--json', '--ui', 'tui'], ['studio', '--no-interaction'], ['studio', '--help']]) {
    const f = streams();
    try { assert.equal(await main(argv, frameworkRoot, f.io), 0); assert.deepEqual(f.raw, []); assert.equal(f.screen.length, 0); }
    finally { f.close(); }
  }
  const ci = streams();
  try {
    assert.equal(await main(['studio'], frameworkRoot, { ...ci.io, env: { CI: 'true' } }), 0);
    assert.deepEqual(ci.raw, []); assert.match(ci.output.join(''), /Shell maker/);
  } finally { ci.close(); }
  assert.throws(() => parseArguments(['studio', '--ui', 'invalid']), /auto, tui or plain/);
});
test('process composition opens both TUI entrypoints and restores them on cancellation', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-process-'));
  try {
    for (const command of ['studio', 'prototype']) {
      let triggered = false;
      const f = streams((screen, input) => {
        if (!triggered && (screen.includes('Project title') || screen.includes('Prototype title'))) {
          triggered = true; queueMicrotask(() => input.write('\x03'));
        }
      });
      try {
        assert.equal(await main([command, '--root', root, '--ui', 'tui', '--no-color'], frameworkRoot, f.io), 130);
        assert.deepEqual(f.raw, [true, false]); assert.equal(f.output.length, 0);
        assert.ok(f.screen.join('').includes('\x1b[?1049l')); assert.ok(!f.screen.join('').includes('\x1b[36m'));
      } finally { f.close(); }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('plain and accessibility modes retain a line-oriented exit with no ANSI screen controls', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-plain-'));
  try {
    for (const config of [{ args: ['--ui', 'plain'], env: {} }, { args: [], env: { SHELL_ACCESSIBLE: '1' } }]) {
      const f = streams((screen, input) => { if (screen.includes('Project title: ')) queueMicrotask(() => input.write(':back\n')); });
      try {
        assert.equal(await main(['studio', '--root', root, ...config.args], frameworkRoot, { ...f.io, env: config.env }), 130);
        assert.deepEqual(f.raw, []); assert.ok(!f.screen.join('').includes('\x1b'));
      } finally { f.close(); }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
