import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readTestWorkflow, readTestWorkflowStep, testWorkflowJson, testWorkflowLimits } from '../../src/cli/domain/test-workflow.ts';
import { describeTestWorkflowLocator, escapeTestWorkflowRegExp, fillTestWorkflowTemplates, readTestWorkflowLocator, testWorkflowLocatorTexts, testWorkflowTemplatePaths, testWorkflowText } from '../../src/cli/domain/test-workflow-locator.ts';
import { readTestWorkflowData, resolveTestWorkflowText, testWorkflowDataContext } from '../../src/cli/domain/test-workflow-data.ts';
import { describeTestWorkflowTarget, readTestWorkflowTarget, readTestWorkflowUrl, testWorkflowTargetOverride } from '../../src/cli/domain/test-workflow-target.ts';
import { readGeneratedBlock, requireIntactBlock, wrapGeneratedBlock } from '../../src/cli/domain/generated-block.ts';
const sample = (extra = {}) => ({ $schema: '../../schemas/test-workflow.schema.json', schemaVersion: 1, id: 'checkout', title: 'Checkout', purpose: 'Buy one item.', status: 'active',
  target: { kind: 'static', folder: 'tests/fixtures/shop' }, data: { values: { user: { email: 'a@example.com', age: 30, vip: true } }, fakeData: { buyer: { config: 'contacts-demo', index: 2 } } },
  steps: [
    { kind: 'goto', path: '/' }, { kind: 'click', id: 'open', target: { role: 'link', name: 'Shop', exact: true } },
    { kind: 'fill', target: { label: 'Email', within: { role: 'form', name: 'Order' } }, value: '{{data.user.email}}', timeoutMs: 2000, note: 'Typed, not pasted.' },
    { kind: 'fill', target: { placeholder: 'Coupon' }, value: '' }, { kind: 'select', target: { label: 'Size' }, value: 'M' }, { kind: 'check', target: { text: 'Gift wrap' } },
    { kind: 'uncheck', target: { testId: 'newsletter' } }, { kind: 'press', key: 'Control+Enter' }, { kind: 'press', target: { label: 'Email' }, key: 'Tab' },
    { kind: 'waitFor', target: { role: 'dialog' }, state: 'hidden' }, { kind: 'expectVisible', target: { role: 'heading', nth: 1 } }, { kind: 'expectHidden', target: { role: 'alert' } },
    { kind: 'expectText', target: { testId: 'total' }, text: 'Total {{data.buyer.name}}', match: 'exact' }, { kind: 'expectUrl', path: '/done?x=1#top', match: 'contains' },
    { kind: 'expectTitle', text: 'Done' }, { kind: 'expectCount', target: { role: 'listitem' }, count: 3 }, { kind: 'expectValue', target: { label: 'Email' }, value: '{{data.user.email}}' },
  ], ...extra });

test('readTestWorkflow keeps a valid definition, fills defaults and round-trips its canonical JSON', () => {
  const definition = readTestWorkflow(sample());
  assert.equal(definition.$schema, undefined);
  assert.deepEqual(definition.viewport, { width: 1280, height: 800 });
  assert.equal(definition.timeoutMs, testWorkflowLimits.defaultTimeoutMs);
  assert.deepEqual(definition.steps[2], { kind: 'fill', note: 'Typed, not pasted.', timeoutMs: 2000, target: { label: 'Email', within: { role: 'form', name: 'Order' } }, value: '{{data.user.email}}' });
  assert.deepEqual(definition.steps[3], { kind: 'fill', target: { placeholder: 'Coupon' }, value: '' }, 'fill accepts an empty value to clear a field');
  assert.deepEqual(definition.data.fakeData, { buyer: { config: 'contacts-demo', index: 2 } });
  assert.deepEqual(readTestWorkflow(JSON.parse(testWorkflowJson(definition))), definition);
  assert.match(testWorkflowJson(definition), /^\{\n {2}"\$schema": "\.\.\/\.\.\/schemas\/test-workflow\.schema\.json",\n {2}"schemaVersion": 1,/);
  assert.deepEqual(readTestWorkflow(sample({ viewport: { width: 200, height: 4000 }, timeoutMs: 60000 })).viewport, { width: 200, height: 4000 });
});

test('readTestWorkflow fails closed on unknown keys, kinds, unsafe paths, hosts, control characters, empty workflows and bounds', () => {
  const step = change => sample({ steps: [{ kind: 'goto', path: '/' }, change] });
  for (const [value, pattern] of [
    [sample({ script: 'alert(1)' }), /Unknown fields: script/], [sample({ schemaVersion: 2 }), /schemaVersion/], [sample({ id: 'Bad Id' }), /kebab-case/],
    [sample({ status: 'live' }), /draft, active, retired/], [sample({ title: 'a\nb' }), /single-line/], [sample({ steps: [] }), /at least one step/],
    [sample({ steps: [{ kind: 'click', target: { role: 'button' } }] }), /first step must be goto/], [step({ kind: 'evaluate', script: 'x' }), /steps\[1\]\.kind must be one of goto/],
    [step({ kind: 'click' }), /needs a target/], [step({ kind: 'fill', target: { label: 'A' } }), /needs value/], [step({ kind: 'goto', path: 'https://evil.example/' }), /root-relative path/],
    [step({ kind: 'goto', path: '//evil.example/x' }), /root-relative/], [step({ kind: 'goto', path: '/a/../b' }), /root-relative/], [step({ kind: 'goto', path: '/a\\b' }), /root-relative/],
    [step({ kind: 'goto', path: '/{{data.x}}' }), /without a host, \.\. or templates/], [step({ kind: 'goto', path: '/a\u0007' }), /control characters/],
    [step({ kind: 'click', target: { role: 'button' }, value: 'x' }), /Unknown fields: value/], [step({ kind: 'goto', path: '/', target: { label: 'x' } }), /Unknown fields: target/],
    [step({ kind: 'press', key: 'rm -rf' }), /must be a key/], [step({ kind: 'expectCount', target: { role: 'row' }, count: 1001 }), /0 to 1000/],
    [step({ kind: 'waitFor', target: { role: 'row' }, state: 'gone' }), /visible, hidden, attached, detached/], [step({ kind: 'expectText', target: { role: 'row' }, text: 'a', match: 'regex' }), /exact, contains/],
    [step({ kind: 'click', target: { role: 'button' }, timeoutMs: 99 }), /100 to 60000/], [step({ kind: 'click', target: { role: 'button' }, id: 'Bad' }), /kebab-case/],
    [sample({ steps: [{ kind: 'goto', path: '/', id: 'a' }, { kind: 'goto', path: '/', id: 'a' }] }), /unique/], [step({ kind: 'fill', target: { label: 'A' }, value: 'x {{ data }} y' }), /double braces/],
    [step({ kind: 'fill', target: { label: 'A' }, value: '{{options.root}}' }), /double braces/], [step({ kind: 'click', target: { role: 'button' }, note: 'a\nb' }), /control characters/],
    [sample({ steps: Array.from({ length: 201 }, () => ({ kind: 'goto', path: '/' })) }), /at most 200/], [sample({ timeoutMs: 60001 }), /100 to 60000/],
    [sample({ viewport: { width: 199, height: 800 } }), /viewport\.width/], [sample({ viewport: { width: 800, height: 800, depth: 1 } }), /Unknown fields: depth/],
  ]) assert.throws(() => readTestWorkflow(value), pattern, String(pattern));
});

test('screenshot steps take a unique kebab-case name, an optional element, masks and a caption, and fail closed', () => {
  const shots = steps => sample({ steps: [{ kind: 'goto', path: '/' }, ...steps] });
  const value = readTestWorkflow(shots([{ kind: 'screenshot', name: 'home', fullPage: true, mask: [{ testId: 'clock' }, { role: 'img', name: 'Avatar' }], caption: 'Landing page' },
    { kind: 'screenshot', name: 'cart', target: { role: 'region', name: 'Cart' } }, { kind: 'screenshot', name: 'viewport', fullPage: false }]));
  assert.deepEqual(value.steps.slice(1), [{ kind: 'screenshot', name: 'home', fullPage: true, mask: [{ testId: 'clock' }, { role: 'img', name: 'Avatar' }], caption: 'Landing page' },
    { kind: 'screenshot', target: { role: 'region', name: 'Cart' }, name: 'cart' }, { kind: 'screenshot', name: 'viewport', fullPage: false }]);
  for (const [steps, pattern] of [
    [[{ kind: 'screenshot' }], /needs name/], [[{ kind: 'screenshot', name: '../evil' }], /kebab-case name/], [[{ kind: 'screenshot', name: 'Home.png' }], /kebab-case name/],
    [[{ kind: 'screenshot', name: 'a', path: '/x' }], /Unknown fields: path/], [[{ kind: 'screenshot', name: 'a', baseline: true }], /Unknown fields: baseline/],
    [[{ kind: 'screenshot', name: 'a', fullPage: 'yes' }], /true or false/], [[{ kind: 'screenshot', name: 'a', fullPage: true, target: { role: 'main' } }], /omit it to capture the target/],
    [[{ kind: 'screenshot', name: 'a', mask: Array.from({ length: 11 }, () => ({ testId: 'x' })) }], /at most 10/], [[{ kind: 'screenshot', name: 'a', mask: [{ css: '.x' }] }], /Unknown fields: css/],
    [[{ kind: 'screenshot', name: 'a', caption: 'a\nb' }], /control characters/], [[{ kind: 'screenshot', name: 'a' }, { kind: 'screenshot', name: 'a' }], /used twice/],
    [Array.from({ length: 31 }, (_, index) => ({ kind: 'screenshot', name: 'shot-' + index })), /at most 30 screenshots/],
  ]) assert.throws(() => readTestWorkflow(shots(steps)), pattern, String(pattern));
});

test('locators are one accessibility-first strategy, optionally scoped, and described in plain words', () => {
  const nested = readTestWorkflowLocator({ role: 'button', name: 'Save "draft"', exact: true, nth: 1, within: { label: 'Editor', within: { testId: 'panel' } } }, 'target');
  assert.equal(describeTestWorkflowLocator(nested), 'button "Save \\"draft\\"" (exact) #2 inside field labelled "Editor" inside test id "panel"');
  assert.deepEqual(testWorkflowLocatorTexts(nested), ['Save "draft"', 'Editor', 'panel']);
  for (const [locator, text] of [[{ placeholder: 'Find' }, 'field with placeholder "Find"'], [{ text: 'Hi' }, 'text "Hi"'], [{ role: 'heading' }, 'heading']])
    assert.equal(describeTestWorkflowLocator(readTestWorkflowLocator(locator, 't')), text);
  for (const [value, pattern] of [
    [{ role: 'button', label: 'x' }, /exactly one of/], [{}, /exactly one of/], [{ css: '#x' }, /Unknown fields: css/], [{ xpath: '//a' }, /Unknown fields: xpath/],
    [{ role: 'blink' }, /ARIA role/], [{ label: 'x', name: 'y' }, /name belongs to role/], [{ testId: 'x', exact: true }, /always match exactly/],
    [{ role: 'button', exact: 'yes' }, /true or false/], [{ text: 'x', nth: 100 }, /0 to 99/], [{ text: 'x', nth: -1 }, /0 to 99/],
    [{ text: 'a', within: { text: 'b', within: { text: 'c', within: { text: 'd' } } } }, /at most 2 parent/], [{ text: '' }, /single-line text/], ['button', /JSON object/],
  ]) assert.throws(() => readTestWorkflowLocator(value, 'target'), pattern, String(pattern));
});

test('templates are inert: paths are listed, substitution is single-pass and a missing value fails closed', () => {
  assert.deepEqual(testWorkflowTemplatePaths('{{data.a}} and {{ data.b.c }}'), ['a', 'b.c']);
  assert.equal(fillTestWorkflowTemplates('{{data.a}}!', () => '{{data.b}}'), '{{data.b}}!', 'resolved text is never scanned again');
  assert.equal(testWorkflowText('', 'value', 10, true), '');
  assert.throws(() => testWorkflowText('', 'value', 10), /1–10/);
  assert.throws(() => testWorkflowText('x'.repeat(11), 'value', 10), /0?–?10/);
  const context = testWorkflowDataContext(readTestWorkflowData({ values: { user: { email: 'a@example.com', age: 30 } } }), new Map([['buyer', { name: 'Ann', tags: ['a', 'b'], vip: false }]]));
  assert.equal(resolveTestWorkflowText('{{data.user.email}} {{data.user.age}} {{data.buyer.name}} {{data.buyer.tags}} {{data.buyer.vip}}', context), 'a@example.com 30 Ann a, b false');
  assert.throws(() => resolveTestWorkflowText('{{data.user.missing}}', context), /does not name a text/);
  assert.throws(() => resolveTestWorkflowText('{{data.user}}', context), /does not name a text/);
  assert.throws(() => resolveTestWorkflowText('{{data.constructor}}', context), /does not name a text/);
  assert.equal(escapeTestWorkflowRegExp('a.b*(c)'), 'a\\.b\\*\\(c\\)');
});

test('test data validates inline values and fake-data sources', () => {
  assert.deepEqual(readTestWorkflowData({ fakeData: { person: { entity: 'contact', seed: 7 } } }), { fakeData: { person: { entity: 'contact', seed: 7, index: 0 } } });
  const deep = { a: { b: { c: { d: { e: 'x' } } } } };
  for (const [value, pattern] of [
    [{ values: { 'bad-key': 'x' } }, /data keys/], [{ values: { constructor: 'x' } }, /data keys/], [{ values: deep }, /nest at most 4/], [{ values: { a: null } }, /JSON object/],
    [{ values: { a: 'x\ny' } }, /control characters/], [{ values: Object.fromEntries(Array.from({ length: 201 }, (_, index) => ['k' + index, 'v'])) }, /at most 200/],
    [{ fakeData: { a: { config: 'x', entity: 'y' } } }, /exactly one of config/], [{ fakeData: { a: { config: 'x', seed: 1 } } }, /seed applies to entity/],
    [{ fakeData: { a: { config: 'Bad' } } }, /kebab-case/], [{ fakeData: { a: { config: 'x', index: 1000 } } }, /0 to 999/], [{ fakeData: { a: { entity: 'x', seed: -1 } } }, /seed must be/],
    [{ values: { a: 'x' }, fakeData: { a: { config: 'x' } } }, /collides/], [{ fakeData: Object.fromEntries(Array.from({ length: 11 }, (_, index) => ['a' + index, { config: 'x' }])) }, /at most 10/],
    [{ fakeData: { a: { config: 'x', script: 'y' } } }, /Unknown fields: script/], [{ extra: 1 }, /Unknown fields: extra/],
  ]) assert.throws(() => readTestWorkflowData(value), pattern, String(pattern));
});

test('targets stay offline or on loopback and the --target override picks the kind', () => {
  assert.deepEqual(readTestWorkflowTarget({ kind: 'static', folder: 'site/' }, 't'), { kind: 'static', folder: 'site' });
  assert.equal(readTestWorkflowUrl('http://localhost:4173', 'url'), 'http://localhost:4173/');
  assert.deepEqual(testWorkflowTargetOverride('http://[::1]:8080/app/'), { kind: 'url', url: 'http://[::1]:8080/app/' });
  assert.deepEqual(testWorkflowTargetOverride('prototypes/demo'), { kind: 'prototype', package: 'prototypes/demo' });
  assert.deepEqual(testWorkflowTargetOverride('dist'), { kind: 'static', folder: 'dist' });
  assert.deepEqual(['static', 'prototype', 'url'].map(kind => describeTestWorkflowTarget(kind === 'url' ? { kind, url: 'http://127.0.0.1:1/' } : kind === 'static' ? { kind, folder: 'a' } : { kind, package: 'b' })),
    ['static a', 'prototype b', 'url http://127.0.0.1:1/']);
  for (const value of ['https://127.0.0.1:1/', 'http://example.com:80/', 'http://127.0.0.1/', 'http://user:pw@127.0.0.1:1/', 'http://127.0.0.1:1/?q=1', 'http://127.0.0.1:1/#x', 'file:///etc/passwd', 'javascript:alert(1)', 'http://127.0.0.2:1/'])
    assert.throws(() => testWorkflowTargetOverride(value), /loopback http URL/, value);
  for (const value of ['../outside', '/abs', 'a/../b', '.git', 'node_modules/x', 'a\\b', 'x/a:b'])
    assert.throws(() => testWorkflowTargetOverride(value), /project-relative folder/, value);
  assert.throws(() => readTestWorkflowTarget({ kind: 'ftp' }, 'target'), /static, prototype or url/);
  assert.throws(() => readTestWorkflowTarget({ kind: 'url', url: 'http://127.0.0.1:1/', folder: 'x' }, 'target'), /Unknown fields: folder/);
});

test('readTestWorkflowStep validates a single step and generated blocks verify their hash', () => {
  assert.deepEqual(readTestWorkflowStep({ kind: 'expectTitle', text: 'Home', match: 'contains' }, 0), { kind: 'expectTitle', text: 'Home', match: 'contains' });
  const format = { marker: 'demo', code: 'DEMO', command: 'demo docs' }, digest = '0'.repeat(64);
  const text = `intro\n${wrapGeneratedBlock('body', digest, format)}\noutro`, found = readGeneratedBlock(text, 'x.md', format);
  assert.deepEqual(found, { before: ['intro'], body: 'body', after: ['outro'], recorded: digest });
  assert.doesNotThrow(() => requireIntactBlock(found, digest, 'x.md', format));
  assert.throws(() => requireIntactBlock(found, '1'.repeat(64), 'x.md', format), error => error.code === 'DEMO_DOCS_EDITED' && /run demo docs again/.test(error.message));
  assert.throws(() => readGeneratedBlock('no markers', 'x.md', format), error => error.code === 'DEMO_DOCS_MARKERS');
});
