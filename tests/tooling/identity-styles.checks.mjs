import { test } from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { cssOwnership } from '../../scripts/bundling/css-ownership.mjs';
import selectorParser from 'postcss-selector-parser';
import { ownsSelector, assertCssOwnership } from '../../scripts/bundling/css-identity.mjs';

test('[IDENTITY-CSS-01] selected identity scopes selectors, native ownership, variables, containers and animation names', async () => {
  const source = `
:root { --plugin-shell-space: 4px; --tw-opacity: 1; }
[data-plugin-ui="plugin-shell"] { container: plugin-shell-leaf / inline-size; }
.ph--plugin-shell { padding: 0; }
.plugin-shell-native-header-hidden[data-type="plugin-shell-showcase"] > .view-header { display: none; }
.plugin-shell-native-header-hidden[data-plugin-view-owner="plugin-shell"] > .view-header { display: none; }
@property --tw-opacity { syntax: "<number>"; inherits: false; initial-value: 1; }
@keyframes spin { from { opacity: 0; } to { opacity: 1; } }
.shell-spinner { animation: spin 1s linear; padding: var(--plugin-shell-space); opacity: var(--tw-opacity); }
@container plugin-shell-leaf (width > 20rem) { .shell-row { display: flex; } }
`;
  const result = await postcss([cssOwnership('field-notes')]).process(source, { from: 'src/styles/test.css' });
  assert.match(result.css, /data-plugin-ui="field-notes"/);
  assert.match(result.css, /\.field-notes-native-header-hidden\[data-type="field-notes-showcase"\]/);
  assert.match(result.css, /\.field-notes-native-header-hidden\[data-plugin-view-owner="field-notes"\]/);
  assert.match(result.css, /\.ph--field-notes/);
  assert.match(result.css, /@property --field-notes-tw-opacity/);
  assert.match(result.css, /@keyframes field-notes-spin/);
  assert.match(result.css, /animation: field-notes-spin/);
  assert.match(result.css, /@container field-notes-leaf/);
  assert.match(result.css, /container: field-notes-leaf/);
  assert.match(result.css, /var\(--field-notes-space\)/);
  assert.doesNotMatch(result.css, /plugin-shell|--tw-/);
  const repeated = await postcss([cssOwnership('field-notes')]).process(result.css, { from: 'src/styles/test.css' });
  assert.equal(repeated.css, result.css);
});

test('[IDENTITY-CSS-02] two built identities never share registered properties or keyframes', async () => {
  const source = '@property --tw-opacity { syntax: "<number>"; inherits: false; initial-value: 1; } @keyframes blink { to { opacity: 1; } } .item { animation: blink 1s; }';
  const first = await postcss([cssOwnership('first-plugin')]).process(source, { from: 'src/styles/test.css' });
  const second = await postcss([cssOwnership('second-plugin')]).process(source, { from: 'src/styles/test.css' });
  assert.doesNotMatch(first.css, /second-plugin/); assert.doesNotMatch(second.css, /first-plugin/);
  assert.match(first.css, /--first-plugin-tw-opacity/); assert.match(second.css, /second-plugin-blink/);
  assert.throws(() => cssOwnership('invalid"identity'), /INVALID_CSS_IDENTITY/);
});

test('[IDENTITY-CSS-03] short ids, class prefixes and negative selector mentions cannot escape ownership', async () => {
  for (const [id, source] of [['a', '.app-button { color: red; }'], ['shell', '.shell-sidebar { color: red; }'], ['a', 'body:not(.a) .foreign, :where(.a, .foreign) { color: red; }'], ['a', ':not(:root) .foreign { color: red; }'], ['a', '.row + .row { color: red; }']]) {
    const result = await postcss([cssOwnership(id)]).process(source, { from: 'src/styles/test.css' });
    assert.ok(result.css.includes(`.ps--${id} `), result.css);
    postcss.parse(result.css).walkRules(rule => selectorParser(list => list.each(selector => assert.ok(ownsSelector(selector, id), selector.toString()))).processSync(rule.selector));
    const repeat = await postcss([cssOwnership(id)]).process(result.css, { from: 'src/styles/test.css' });
    assert.equal(repeat.css, result.css);
  }
  for (const text of ['.app-button', '.a-suffix', '.ps--a-suffix', '.ps--another', '.ps--a + .foreign', ':not(.ps--a) .foreign', 'body:not(.a) .foreign', ':where(.a, .foreign)', '[data-plugin-ui="another"]', '.a-native-header-hidden[data-plugin-view-owner*="a"] > .view-header', '.a-native-header-hidden[data-plugin-view-owner="another"] > .view-header', '.a-native-header-hidden[data-plugin-view-owner="a"] .view-header', '.a-native-header-hidden[data-plugin-view-owner="a"] > .foreign']) {
    selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'a'), false, text))).processSync(text);
  }
  assert.throws(() => assertCssOwnership(postcss.parse('.app-button { color: red; }'), 'a', selectorParser), /UNSCOPED_RULE/);
  selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'notes'), false))).processSync('.ps-notes');
  selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'ps-notes'), false))).processSync('.ps--notes');
  selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'notes'), false))).processSync('.notes-host');
  selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'notes-host'), false))).processSync('.notes--host');
  selectorParser(list => list.each(selector => assert.equal(ownsSelector(selector, 'host'), false))).processSync('.ph--ps');
  assert.throws(() => cssOwnership('ps--notes'), /INVALID_CSS_IDENTITY/);
  assert.throws(() => cssOwnership('ph--notes'), /INVALID_CSS_IDENTITY/);
});

test('[IDENTITY-CSS-04] harness frame remains external on both path separator conventions', async () => {
  const css = 'body { color: red; }';
  for (const from of ['D:/fixture/harness/styles/test.css', 'D:\\fixture\\harness\\styles\\test.css']) {
    const result = await postcss([cssOwnership('field-notes')]).process(css, { from });
    assert.equal(result.css, css);
  }
});
