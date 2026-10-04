import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyIds, summarizeViolations, blocking, auditFailures, auditStories, themes } from '../../scripts/compiler/storybook-a11y.mjs';
const entry = (id, type = 'story') => [id, { id, type, title: id, name: id }];
test('story selection keeps only stories, in sorted bounded order independent of index key order', () => {
  const index = { entries: Object.fromEntries([entry('b--default'), entry('a--default'), entry('a--docs', 'docs'), entry('c--empty')]) };
  assert.deepEqual(storyIds(index), ['a--default', 'b--default', 'c--empty']);
  assert.equal(storyIds({ entries: Object.fromEntries(Array.from({ length: 100 }, (_, i) => entry('s' + String(i).padStart(3, '0')))) }).length, 60);
  assert.deepEqual(storyIds({}), []);
});
test('violations keep rule, impact and selectors only and blocking means serious or critical', () => {
  const raw = [{ id: 'color-contrast', impact: 'serious', help: 'Contrast', nodes: [{ target: ['.a', 'span'], html: '<span>secret note text</span>' }] },
    { id: 'region', impact: 'moderate', help: 'Region', nodes: [{ target: ['body'], html: '<body>' }] }, { id: 'odd', impact: null, help: 'x', nodes: [] }];
  const summary = summarizeViolations(raw);
  assert.deepEqual(summary[0], { id: 'color-contrast', impact: 'serious', help: 'Contrast', nodes: ['.a span'] });
  assert.ok(!JSON.stringify(summary).includes('secret'));
  assert.equal(summary[2].impact, 'unknown');
  assert.deepEqual(blocking(summary).map(item => item.id), ['color-contrast']);
  assert.deepEqual(blocking([{ id: 'label', impact: 'critical' }]).length, 1);
});
test('audit failures name theme, story and rule and ignore moderate or minor findings', () => {
  const audit = { themes: {
    light: { visited: ['s1'], violations: { s1: [{ id: 'region', impact: 'moderate' }] } },
    dark: { visited: ['s1'], violations: { s1: [{ id: 'color-contrast', impact: 'serious' }, { id: 'label', impact: 'critical' }, { id: 'tip', impact: 'minor' }] } } } };
  assert.deepEqual(auditFailures(audit), ['dark:s1:color-contrast(serious)', 'dark:s1:label(critical)']);
  assert.deepEqual(auditFailures({ themes: { light: { visited: [], violations: {} } } }), []);
});
test('the audit drives every story through both Obsidian themes before analysing it', async () => {
  const visits = [], waits = [];
  const locator = { first: () => ({ waitFor: async () => {} }), count: async () => 0 };
  const page = { goto: async url => { visits.push(url); }, waitForFunction: async (_, args) => { waits.push(args); }, locator: () => locator,
    // @axe-core/playwright reads the page through these members; the double supplies the minimum so the real builder runs its argument handling.
  };
  await assert.rejects(auditStories({ page, base: 'http://127.0.0.1:1', ids: ['s--default'] }), /./);
  assert.deepEqual(visits, ['http://127.0.0.1:1/iframe.html?id=s--default&viewMode=story&globals=theme:light']);
  assert.deepEqual(waits, [['light', 'dark']]);
  assert.deepEqual(themes, ['light', 'dark']);
});
