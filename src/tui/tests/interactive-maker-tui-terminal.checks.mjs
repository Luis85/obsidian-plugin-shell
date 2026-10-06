import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { terminalFixture } from './interactive-maker-tui-fixture.mjs';
import { Back, input, titleInput, bulkTitles, confirm, choose, selectMany } from '../prompts.ts';
test('real key decoder selects with arrows, renders once per changed frame and restores terminal ownership', async () => {
  const f = terminalFixture({ raw: true }); let unrelated = 0; const listener = () => unrelated++;
  f.input.on('data', listener); f.session.start();
  const request = f.session.select('Pages', [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]);
  const before = f.chunks.length; f.send('\x1b[A'); assert.equal(f.chunks.length, before);
  f.send('\x1b[B\r'); assert.equal(await request, 'b');
  f.session.dispose(); f.session.dispose();
  assert.deepEqual(f.raw, [true, true]); assert.ok(f.input.listeners('data').includes(listener));
  assert.equal(f.output.listenerCount('resize'), 0); assert.equal(f.output.listenerCount('drain'), 0);
  assert.ok(f.text().includes('\x1b[?1049h')); assert.ok(f.text().includes('\x1b[?1049l'));
  assert.ok(unrelated > 0); f.input.off('data', listener); f.close();
});
test('text helpers validate in place and bracketed multiline paste never submits automatically', async () => {
  const f = terminalFixture(); f.session.start();
  try {
    let settled = false;
    const task = titleInput(f.ui, 'Page title').then(value => { settled = true; return value; });
    f.send('\r'); assert.match(f.text(), /single-line title/);
    f.send('\x1b[200~Hello\nWorld\x1b[201~'); await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
    f.send('\r'); assert.equal(await task, 'Hello World');
    const bulk = bulkTitles(f.ui); f.send('\r'); assert.match(f.text(), /1–60/);
    f.send('\x1b[200~Card\r\nFilters\x1b[201~\r'); assert.deepEqual(await bulk, ['Card', 'Filters']);
    const defaulted = input(f.ui, 'Folder', 'generated'); f.send('\r'); assert.equal(await defaulted, 'generated');
  } finally { f.close(); }
});
test('confirm defaults to no; pasted menu commands do not approve', async () => {
  const f = terminalFixture(); f.session.start();
  try {
    const first = confirm(f.ui, 'Apply?'); f.send('\x1b[200~yes\n\x1b[201~'); f.send('\r'); assert.equal(await first, false);
    const second = confirm(f.ui, 'Apply?'); f.send('\x1b[B\r'); assert.equal(await second, true);
    const list = selectMany(f.ui, 'Components', [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }]);
    f.send(' \x1b[B \r'); assert.deepEqual(await list, ['one', 'two']);
    const single = choose(f.ui, 'Pick', [{ id: 'a', label: 'A' }]); f.send('\r'); assert.equal(await single, 'a');
  } finally { f.close(); }
});
test('Escape cancels only the active prompt; Ctrl-C, external abort and EOF settle and restore raw mode', async () => {
  for (const abort of ['key', 'signal', 'end']) {
    const f = terminalFixture(); f.session.start();
    const back = f.session.text({ title: 'First', initial: '' }); f.send('\x1b'); await assert.rejects(back, Back);
    const pending = f.session.text({ title: 'Second', initial: '' });
    if (abort === 'key') f.send('\x03'); else if (abort === 'signal') f.controller.abort(); else f.input.end();
    await assert.rejects(pending, error => error.code === 'CANCELLED');
    assert.deepEqual(f.raw, [true, false]); assert.equal(f.input.isPaused(), true);
    assert.ok(f.text().endsWith('\x1b[?1049l')); f.close();
  }
});
test('resize keeps the active answer; too-small windows suppress edits but not cancellation', async () => {
  const f = terminalFixture(); f.session.start();
  try {
    const task = f.session.text({ title: 'Name', initial: 'Retained' });
    f.output.columns = 30; f.output.rows = 7; f.output.emit('resize'); f.send('hidden\r');
    assert.match(f.text(), /Resize to at least/);
    f.output.columns = 90; f.output.rows = 24; f.output.emit('resize'); f.send('\r'); assert.equal(await task, 'Retained');
    const next = f.session.text({ title: 'Cancel', initial: '' }); f.output.columns = 15; f.send('\x03');
    await assert.rejects(next, error => error.code === 'CANCELLED');
  } finally { f.close(); }
});
test('review supports long documents, section switching and safe back navigation', async () => {
  const f = terminalFixture(); f.session.start();
  try {
    const task = f.session.review('File changes', [{ title: 'Manifest', body: 'first\n'.repeat(100) + 'LAST FILE' }, { title: 'Prompt', body: 'Execution prompt' }]);
    f.send('\x1b[F'); assert.match(f.text(), /LAST FILE/);
    f.send('\t'); assert.match(f.text(), /Execution prompt/);
    f.send('\x1b[Z'); f.send('\r'); await task;
    await assert.rejects(() => f.session.review('Invalid', []), error => error.code === 'TUI_REVIEW');
  } finally { f.close(); }
});
test('busy states accept no edits, input is bounded, and terminal failures do not leave a pending prompt', async () => {
  const f = terminalFixture(); f.session.start();
  f.session.context({ title: 'P', location: 'Compiling', details: [] }); f.session.busy('Generating a plan');
  f.send('ignored'); f.session.write('A\nVisible status\n'); assert.match(f.text(), /Visible status/);
  const task = f.session.text({ title: 'Title', initial: '' });
  await assert.rejects(() => f.session.text({ title: 'Other', initial: '' }), /Only one prompt/);
  f.send('\x1b[200~' + 'x'.repeat(11000) + '\x1b[201~'); assert.match(f.text(), /exceeds/);
  const error = new Error('Test stream failure'); f.input.emit('error', error); await assert.rejects(task, /Test stream failure/);
  assert.deepEqual(f.raw, [true, false]); f.close();
});
test('aborted, disposed and failed-start sessions cannot acquire keyboard ownership again', async () => {
  const f = terminalFixture(); f.controller.abort(); assert.throws(() => f.session.start(), /Cancelled before/); f.close();
  const failed = terminalFixture(); failed.input.setRawMode = () => { throw new Error('Raw unavailable'); };
  assert.throws(() => failed.session.start(), /Raw unavailable/); failed.close();
  const once = terminalFixture(); once.session.start(); assert.throws(() => once.session.start(), /cannot be restarted/); once.close();
  await assert.rejects(() => once.session.text({ title: 'Closed', initial: '' }), /closed/);
});
