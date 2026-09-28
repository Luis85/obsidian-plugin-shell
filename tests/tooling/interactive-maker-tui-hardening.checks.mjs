import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { TerminalSession } from '../../bin/presentation/tui/session.ts';
import { initialState, paste, step } from '../../bin/presentation/tui/state.ts';
import { dimensions, frame } from '../../bin/presentation/tui/frame.ts';
import { graphemes } from '../../bin/presentation/tui/text.ts';
import { terminalFixture } from './interactive-maker-tui-fixture.mjs';

test('incremental combining characters and joined emoji keep the caret at a real grapheme boundary', () => {
  for (const value of ['e\u0301', '👩‍💻', '🇩🇪']) {
    const s = initialState({ kind: 'text', title: 'Title', initial: '' });
    for (const character of value) paste(s, character);
    assert.equal(s.cursor, graphemes(s.value).length);
    step(s, { name: 'backspace' }); assert.equal(s.value, ''); assert.equal(s.cursor, 0);
  }
  const s = initialState({ kind: 'text', title: 'Title', initial: 'ab' });
  step(s, { name: 'left' }); paste(s, '\u0301');
  assert.equal(s.value, 'a\u0301b'); assert.equal(s.cursor, 1);
  step(s, { name: 'backspace' }); assert.equal(s.value, 'b'); assert.equal(s.cursor, 0);
});

test('an oversized raw paste is rejected before sanitization, without inserting a truncated prefix', () => {
  const s = initialState({ kind: 'text', title: 'Title', initial: 'Saved' });
  paste(s, 'x' + '\x00'.repeat(10000));
  assert.equal(s.value, 'Saved'); assert.match(s.error, /exceeds/);
});

test('bracketed paste cannot change a hidden draft or a draft covered by keyboard help', async () => {
  const f = terminalFixture(); f.session.start();
  try {
    const task = f.session.text({ title: 'Name', initial: 'Retained' });
    f.output.columns = 30; f.output.rows = 7; f.output.emit('resize');
    f.send('\x1b[200~hidden\x1b[201~');
    f.output.columns = 90; f.output.rows = 24; f.output.emit('resize');
    f.send('\x1bOP'); // F1: keyboard help, not a text field.
    f.send('\x1b[200~also hidden\x1b[201~');
    f.send('\x1bOP\r'); assert.equal(await task, 'Retained');
  } finally { f.close(); }
});

test('mandatory back/help/cancel keys remain visible at the minimum supported width', () => {
  const context = { title: 'Project', location: 'Workspace', details: [] };
  const requests = [
    { kind: 'text', title: 'Title', initial: '' },
    { kind: 'text', title: 'Titles', initial: '', multiline: true },
    { kind: 'select', title: 'Pages', items: [] },
    { kind: 'multi', title: 'Components', items: [] },
    { kind: 'review', title: 'Files', sections: [{ title: 'Files', body: 'Content' }] },
  ];
  for (const request of requests) {
    const output = frame(initialState(request), context, '', dimensions(60, 18), false).join('\n');
    for (const hint of ['Esc Back', 'F1 Help', 'Ctrl+C Cancel']) assert.ok(output.includes(hint), `${request.kind}: ${hint}`);
    if (request.kind === 'select') assert.ok(!output.includes('Space Toggle'));
  }
});

test('restoration write errors stay observed until the terminal stream emits its error and closes', async () => {
  const input = new PassThrough(); input.setRawMode = mode => { input.isRaw = mode; };
  let observedWithOwner = false;
  const output = new Writable({ write(chunk, _encoding, done) {
    done(String(chunk).includes('[?1049l') ? new Error('Restoration output failed') : null);
  } });
  const observer = () => { observedWithOwner = output.listenerCount('error') > 1; };
  output.on('error', observer);
  const controller = new AbortController();
  const session = new TerminalSession({ input, output, signal: controller.signal, cancel: () => controller.abort(), color: false });
  const closed = new Promise(resolve => output.once('close', resolve));
  session.start(); session.dispose(); await closed;
  assert.equal(observedWithOwner, true); assert.equal(input.isRaw, false);
  assert.equal(output.listenerCount('error'), 1); output.off('error', observer); input.destroy();
});

test('disposing an already destroyed output still observes its scheduled error without removing other listeners', async () => {
  const f = terminalFixture(); let owned = false;
  const observer = () => { owned = f.output.listenerCount('error') > 1; };
  f.output.on('error', observer); f.session.start();
  const closed = new Promise(resolve => f.output.once('close', resolve));
  f.output.destroy(new Error('Connection closed')); f.session.dispose(); await closed;
  assert.equal(owned, true); assert.deepEqual(f.raw, [true, false]);
  assert.equal(f.output.listenerCount('error'), 1); f.output.off('error', observer); f.close();
});

test('shared discovery accepts the real launcher and TypeScript sources but rejects unsafe source paths', async () => {
  const { capabilityCatalog, validateCatalog } = await import('../../scripts/operations/catalog.mjs');
  const catalog = capabilityCatalog(), maker = catalog.operations.find(item => item.id === 'source.make');
  assert.equal(maker.cli.command, 'node shell.mjs make');
  assert.ok(maker.cli.sourceFiles.includes('shell.mjs'));
  assert.ok(maker.cli.sourceFiles.includes('scripts/framework/cli.ts'));
  assert.equal(validateCatalog(catalog), true);
  for (const path of ['../shell.mjs', '/shell.mjs', 'shell.ts', 'scripts/../shell.mjs', 'scripts//cli.ts', 'scripts/cli.js', 'node_modules/tool.mjs', 'scripts\\cli.ts']) {
    const invalid = structuredClone(catalog);
    invalid.operations.find(item => item.id === 'source.make').cli.sourceFiles = [path];
    assert.throws(() => validateCatalog(invalid), /CATALOG_CLI/, path);
  }
});
