import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { initialState, step, paste, matches } from '../engine/state.ts';
import { documentLines } from '../engine/documents.ts';
import { dimensions, frame } from '../engine/frame.ts';
import { clean, cells, clip, fit, wrap, graphemes } from '../engine/text.ts';
import { useColor, useTerminal } from '../engine/mode.ts';
const items = Array.from({ length: 40 }, (_, i) => ({ id: `id-${i}`, label: `Component ${i}` }));
const state = (kind = 'select') => initialState({ kind, title: 'Add components', items });
const key = (s, name, options = {}) => step(s, { name, ...options });
const type = (s, value) => { for (const char of value) step(s, { name: char }, char); };
const context = { title: 'Issue desk', location: 'Page / Issues', details: ['2 pages', '3 components'], dirty: true };
test('TUI list navigation is bounded, searchable and does not treat missing choices as success', () => {
  const s = state();
  for (const [name, expected] of [['up', 0], ['down', 1], ['pagedown', 9], ['pageup', 1], ['end', 39], ['down', 39], ['home', 0]]) {
    key(s, name); assert.equal(s.index, expected);
  }
  assert.equal(key(s, 'return').value, 'id-0');
  type(s, '/id-12'); assert.equal(matches(s).length, 1); assert.equal(key(s, 'enter').value, 'id-12');
  key(s, 'escape'); assert.equal(s.query, ''); assert.equal(s.searching, false);
  type(s, 'missing'); assert.equal(key(s, 'return'), undefined); assert.match(s.error, /No matches/);
  key(s, 'backspace'); assert.equal(s.query, 'missin');
  key(s, 'escape'); assert.deepEqual(key(s, 'escape'), { kind: 'back' });
  assert.deepEqual(key(s, 'c', { ctrl: true }), { kind: 'cancel' });
  assert.equal(initialState({ kind: 'select', title: 'One', items, initial: 'id-22' }).index, 22);
  assert.equal(initialState({ kind: 'select', title: 'Empty', items: [] }).index, 0);
});
test('multi-select preserves checks during filtering and emits stable catalog order', () => {
  const s = state('multi'); key(s, 'return'); assert.match(s.error, /at least one/);
  key(s, 'down'); type(s, ' '); assert.deepEqual(s.checked, ['id-1']);
  type(s, '/id-3'); key(s, 'tab'); type(s, ' '); assert.deepEqual(s.checked, ['id-1', 'id-3']);
  key(s, 'escape'); type(s, ' '); assert.deepEqual(s.checked, ['id-1', 'id-3', 'id-0']);
  assert.deepEqual(key(s, 'return').value, ['id-0', 'id-1', 'id-3']);
  type(s, ' '); assert.deepEqual(s.checked, ['id-1', 'id-3']);
  key(s, 'a', { ctrl: true }); key(s, 'a', { meta: true }); assert.equal(s.query, '');
  paste(s, 'yes\n'); assert.match(s.error, /never as a menu/);
});
test('text fields retain invalid input, handle grapheme editing and reject oversized paste', () => {
  const s = initialState({ kind: 'text', title: 'Title', initial: '', validate: value => value ? undefined : 'Title required' });
  key(s, 'return'); assert.equal(s.error, 'Title required');
  type(s, 'A'); paste(s, '👩‍💻é'); assert.equal(s.cursor, 3);
  key(s, 'left'); key(s, 'delete'); assert.equal(s.value, 'A👩‍💻');
  key(s, 'backspace'); assert.equal(s.value, 'A');
  key(s, 'home'); key(s, 'backspace'); assert.equal(s.value, 'A');
  key(s, 'right'); key(s, 'right'); key(s, 'end'); assert.equal(s.cursor, 1);
  paste(s, '\r\nB'); assert.equal(s.value, 'A B');
  assert.equal(key(s, 'enter').value, 'A B');
  const before = s.value; paste(s, 'x'.repeat(10001)); assert.equal(s.value, before); assert.match(s.error, /Nothing was pasted/);
  key(s, 'u', { ctrl: true }); assert.equal(s.value, '');
  key(s, 'x', { ctrl: true }); step(s, { meta: true }, 'z'); assert.equal(s.value, '');
  type(s, 'e\u0301'); assert.equal(graphemes(s.value).length, 1); key(s, 'end'); key(s, 'backspace'); assert.equal(s.value, '');
});
test('multiline text and document review keep navigation out of domain operations', () => {
  const s = initialState({ kind: 'text', title: 'List', initial: 'One', multiline: true });
  key(s, 'enter'); type(s, 'Two'); assert.equal(s.value, 'One\nTwo'); assert.equal(key(s, 'return').value, 'One\nTwo');
  const r = initialState({ kind: 'review', title: 'Plan', sections: [{ title: 'A', body: 'line\n'.repeat(80) }, { title: 'B', body: 'other' }] });
  key(r, 'down'); assert.equal(r.offset, 1); key(r, 'pagedown'); assert.equal(r.offset, 9);
  key(r, 'end'); assert.ok(r.offset > 60); key(r, 'up'); assert.ok(r.offset > 50);
  key(r, 'tab'); assert.equal(r.section, 1); assert.equal(r.offset, 0);
  key(r, 'tab', { shift: true }); assert.equal(r.section, 0);
  assert.equal(key(r, 'enter').kind, 'answer'); assert.deepEqual(key(r, 'escape'), { kind: 'back' });
});
test('help is dismissible, scrollable and cannot accidentally submit a form', () => {
  const s = state(); key(s, 'f1'); assert.equal(s.help, true);
  assert.equal(key(s, 'return'), undefined);
  key(s, 'pagedown'); assert.ok(s.offset > 0);
  assert.match(frame(s, context, '', dimensions(110, 24), false).join('\n'), /TEXT FIELDS/);
  key(s, 'escape'); assert.equal(s.help, false); key(s, 'f1'); key(s, 'f1'); assert.equal(s.help, false);
});
test('terminal content is sanitized and clipped by cells without splitting graphemes', () => {
  assert.equal(clean('\x1b[31mHello\x1b[0m\x1b]52;c;ZXZpbA==\x07\u202e\x00'), 'Hello');
  assert.equal(clean('a\tb\r\nc'), 'a  b\nc');
  assert.equal(cells('A你好👩‍💻e\u0301'), 8); assert.equal(cells('\u0301'), 0);
  assert.equal(clip('你a', 2), '你'); assert.equal(fit('你', 4), '你  ');
  assert.deepEqual(wrap('abcdef', 3), ['abc', 'def']); assert.deepEqual(wrap('one\n', 4), ['one', '']);
  assert.deepEqual(graphemes('👩‍💻e\u0301'), ['👩‍💻', 'e\u0301']);
});
test('narrow, wide, tiny, long-text and colored frames remain within the viewport', () => {
  const requests = [state(), state('multi'), initialState({ kind: 'text', title: 'A long title', initial: '你好'.repeat(200) }),
    initialState({ kind: 'review', title: 'Review', sections: [{ title: 'Source', body: 'line\n'.repeat(80) }] }), null];
  for (const [cols, rows] of [[110, 30], [80, 24], [60, 18], [25, 6], [10, 1]]) {
    for (const s of requests) {
      const result = frame(s, context, 'File saved', dimensions(cols, rows), false);
      assert.ok(result.length <= rows);
      assert.ok(result.every(line => cells(line) < cols));
      assert.ok(!result.join('').includes('\x1b'));
    }
  }
  assert.match(frame(state(), context, '', dimensions(110, 24), true).join('\n'), /\x1b\[36m/);
  assert.match(frame(state(), { ...context, dirty: false }, '', dimensions(), false).join('\n'), /SAVED/);
  const empty = state(); type(empty, 'notfound'); assert.match(frame(empty, context, '', dimensions(), false).join('\n'), /No matches/);
});
test('plain accessibility, dumb terminals and redirected streams never activate a TUI', () => {
  const input = { isTTY: true, setRawMode() {} }, output = { isTTY: true };
  assert.equal(useTerminal('auto', input, output, {}), true);
  for (const [mode, env] of [['plain', {}], ['auto', { TERM: 'dumb' }], ['tui', { SHELL_ACCESSIBLE: '1' }], ['auto', { CI: 'true' }]]) {
    assert.equal(useTerminal(mode, input, output, env), false);
  }
  assert.equal(useTerminal('auto', input, output, { CI: 'false' }), true);
  assert.equal(useTerminal('auto', { isTTY: false }, output, {}), false);
  assert.equal(useTerminal('auto', input, { isTTY: false }, {}), false);
  assert.equal(useColor(false, {}), true); assert.equal(useColor(false, { NO_COLOR: '' }), true);
  for (const env of [{ NO_COLOR: '0' }, { NODE_DISABLE_COLORS: '1' }, { FORCE_COLOR: '0' }]) assert.equal(useColor(false, env), false);
  assert.equal(useColor(true, {}), false);
});

test('large reviews reuse wrapped content while resize, section and content edits invalidate it', () => {
  const request = { kind: 'review', title: 'Plan', sections: [{ title: 'Files', body: 'entry\n'.repeat(5000) }, { title: 'Prompt', body: 'Another document' }] };
  const lines = documentLines(request, 0, 80); assert.equal(lines.length, 5001);
  assert.equal(documentLines(request, 0, 80), lines);
  assert.notEqual(documentLines(request, 0, 70), lines);
  assert.deepEqual(documentLines(request, 1, 80), ['Another document']);
  request.sections[1].body = 'Changed'; assert.deepEqual(documentLines(request, 1, 80), ['Changed']);
  assert.deepEqual(documentLines(request, 99, 80), ['']);
});
