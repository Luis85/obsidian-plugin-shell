import { describe, expect, it } from 'vitest';
import { defineForm, readDataFormValue } from '../../src/features/api';
import featureBrief from '../fixtures/forms/feature-brief.json';
import { allDataFormNodes, visibleDataFormNodes, type DataFormNode } from '../../src/domain/forms/values';
import { assignAt, valueAt, type DataFormValues } from '../../src/domain/forms/model';

/** Test-owned definition, independent of the removable showcase example. */
const featureBriefForm = defineForm(featureBrief);
const probe = (fields: unknown[]) => defineForm({ schemaVersion: 1, id: 'probe', version: 1, title: 'Probe', fields });
const paths = (nodes: readonly DataFormNode[]): string[] => nodes.flatMap(node => [node.path, ...paths(node.children ?? [])]);
function issues(form: ReturnType<typeof probe>, value: unknown) {
  const outcome = readDataFormValue(form, value);
  return outcome.ok ? [] : outcome.issues.map(item => ({ path: item.path, code: item.code, ...(item.params ? { params: item.params } : {}), ...(item.message ? { message: item.message } : {}) }));
}
const brief = { name: '  Inbox zero ', summary: ' One line ', estimate: 3, surfaces: ['settings', 'view', 'view'], review: false, reviewers: ['Hidden'], links: { issue: '#12', design: '' } };

describe('runtime form values', () => {
  it('[FORMS-07] returns only visible normalized values with defaults at their bound paths', () => {
    expect(readDataFormValue(featureBriefForm, brief)).toEqual({ ok: true, value: {
      name: 'Inbox zero', summary: 'One line', priority: 'normal', estimate: 3, surfaces: ['settings', 'view'], review: false, links: { issue: '#12', design: '' },
    } });
    const reviewed = readDataFormValue(featureBriefForm, { ...brief, review: true, reviewers: [' Ada ', 'Linus'], links: {} });
    expect(reviewed.ok && reviewed.value).toMatchObject({ review: true, reviewers: ['Ada', 'Linus'], links: {} });
    expect(paths(allDataFormNodes(featureBriefForm))).toEqual(['name', 'summary', 'priority', 'estimate', 'surfaces', 'review', 'reviewers', 'links', 'links.issue', 'links.design']);
    expect(paths(visibleDataFormNodes(featureBriefForm, brief))).not.toContain('reviewers');
    expect(paths(visibleDataFormNodes(featureBriefForm, { review: true }))).toContain('reviewers');
  });

  it('[FORMS-08] reports every invalid visible field with codes, limits and the field message', () => {
    expect(issues(featureBriefForm, { summary: ' ', estimate: 0, surfaces: [], review: true, reviewers: ['a', 'b', 'c', 'd', 'e', 'f'] })).toEqual([
      { path: 'name', code: 'required' }, { path: 'summary', code: 'required' },
      { path: 'estimate', code: 'range', params: { min: 1, max: 60 }, message: 'Enter whole days from 1 to 60.' },
      { path: 'surfaces', code: 'required' }, { path: 'reviewers', code: 'items', params: { limit: 5 } },
    ]);
    expect(issues(featureBriefForm, { ...brief, name: 'Two\nlines', surfaces: ['other'], review: true, reviewers: ['x'.repeat(81)], priority: 3 })).toEqual([
      { path: 'name', code: 'title', params: { limit: 80 } }, { path: 'priority', code: 'choice' }, { path: 'surfaces', code: 'choice' },
      { path: 'reviewers', code: 'text', params: { limit: 80 } },
    ]);
    expect(issues(featureBriefForm, { ...brief, review: 'yes', estimate: 2.5, surfaces: 'view' })).toEqual([
      { path: 'estimate', code: 'integer', message: 'Enter whole days from 1 to 60.' }, { path: 'surfaces', code: 'invalid' }, { path: 'review', code: 'invalid' },
    ]);
    expect(readDataFormValue(featureBriefForm, null)).toEqual({ ok: false, issues: [{ path: '', code: 'invalid' }] });
    expect(readDataFormValue(featureBriefForm, ['not', 'a', 'record']).ok).toBe(false);
  });

  it('[FORMS-09] applies text, number and list rules of the shared format', () => {
    const form = probe([
      { id: 'note', kind: 'text', label: 'Note', multiline: true, maxLength: 12 }, { id: 'line', kind: 'text', label: 'Line' },
      { id: 'low', kind: 'number', label: 'Low', min: 2 }, { id: 'high', kind: 'number', label: 'High', max: 5 }, { id: 'free', kind: 'number', label: 'Free' },
      { id: 'tags', kind: 'list', label: 'Tags' },
    ]);
    expect(readDataFormValue(form, { note: 'a\n\tb', line: '', low: 2, high: -9, free: 1e9, tags: [] })).toEqual({ ok: true, value: { note: 'a\n\tb', line: '', low: 2, high: -9, free: 1e9, tags: [] } });
    expect(readDataFormValue(form, {})).toEqual({ ok: true, value: {} });
    expect(issues(form, { note: 'x'.repeat(13), line: 'bell\u0007', low: 1, high: 6, free: Number.NaN, tags: [' ', 'ok'] })).toEqual([
      { path: 'note', code: 'text', params: { limit: 12 } }, { path: 'line', code: 'text', params: { limit: 2000 } },
      { path: 'low', code: 'min', params: { min: 2 } }, { path: 'high', code: 'max', params: { max: 5 } }, { path: 'free', code: 'number' },
      { path: 'tags', code: 'text', params: { limit: 2000 } },
    ]);
    expect(issues(form, { line: 42, free: '3', tags: 'a;b' })).toEqual([{ path: 'line', code: 'text', params: { limit: 2000 } }, { path: 'free', code: 'number' }, { path: 'tags', code: 'invalid' }]);
    expect(issues(form, { tags: [7] })).toEqual([{ path: 'tags', code: 'text', params: { limit: 2000 } }]);
  });

  it('[FORMS-10] evaluates field and path conditions inside the enclosing scope and skips hidden answers', () => {
    const form = probe([
      { id: 'mode', kind: 'select', label: 'Mode', choices: ['simple', 'advanced'], default: 'simple' },
      { id: 'detail', kind: 'text', label: 'Detail', required: true, when: { field: 'mode', notEquals: 'simple' } },
      { id: 'contact', kind: 'section', label: 'Contact', bind: 'contact', fields: [
        { id: 'email', kind: 'text', label: 'Email', bind: 'channels.email' },
        { id: 'phone', kind: 'text', label: 'Phone', required: true, when: { path: 'channels.email', present: false } },
      ] },
      { id: 'flat', kind: 'section', label: 'Flat', fields: [{ id: 'level', kind: 'number', label: 'Level', integer: true, when: { path: 'mode', equals: 'advanced' } }] },
    ]);
    expect(paths(visibleDataFormNodes(form, {}))).toEqual(['mode', 'contact', 'contact.channels.email', 'contact.phone', 'flat']);
    expect(paths(visibleDataFormNodes(form, { mode: 'advanced', contact: { channels: { email: 'a@b.c' } } }))).toEqual(['mode', 'detail', 'contact', 'contact.channels.email', 'flat', 'level']);
    expect(readDataFormValue(form, { contact: { channels: { email: 'a@b.c' } }, detail: 'ignored', level: 1.5 })).toEqual({ ok: true, value: { mode: 'simple', contact: { channels: { email: 'a@b.c' } } } });
    expect(issues(form, { mode: 'advanced', contact: {}, level: 1.5 })).toEqual([
      { path: 'detail', code: 'required' }, { path: 'contact.phone', code: 'required' }, { path: 'level', code: 'integer' },
    ]);
    expect(readDataFormValue(form, { mode: 'advanced', detail: 'x', contact: { phone: '1' }, level: 2 })).toEqual({ ok: true, value: { mode: 'advanced', detail: 'x', contact: { phone: '1' }, level: 2 } });
  });

  it('[FORMS-11] never reads inherited members or writes prototype paths', () => {
    const form = probe([{ id: 'toString', kind: 'text', label: 'Name', required: true }, { id: 'hasOwnProperty', kind: 'boolean', label: 'Flag' }]);
    expect(issues(form, {})).toEqual([{ path: 'toString', code: 'required' }]);
    const parsed: unknown = JSON.parse('{"__proto__": {"polluted": true}, "toString": "safe", "hasOwnProperty": true}');
    const outcome = readDataFormValue(form, parsed);
    expect(outcome).toEqual({ ok: true, value: { toString: 'safe', hasOwnProperty: true } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(valueAt({ a: Object.create({ inherited: 1 }) }, 'a.inherited')).toBeUndefined();
    expect(valueAt({ a: 'text' }, 'a.length')).toBeUndefined();
    const target: DataFormValues = { a: 'replace-me' };
    assignAt(target, 'a.b.c', 1); assignAt(target, 'a.b.d', 2);
    expect(target).toEqual({ a: { b: { c: 1, d: 2 } } });
    for (const unsafe of ['__proto__.polluted', 'a.constructor', 'prototype', '', 'a b']) expect(() => assignAt(target, unsafe, true)).toThrow('FORM_PATH');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
