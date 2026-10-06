import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { defineForm, readDataForm } from '../../features/api';
import featureBrief from '../../../../tests/fixtures/forms/feature-brief.json';

/** Test-owned definition, independent of the removable showcase example. */
const featureBriefForm = defineForm(featureBrief);
const form = (fields: unknown[], extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, id: 'probe', version: 1, title: 'Probe', fields, ...extra });
const text = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'text', label: id, ...extra });
function rejected(value: unknown) {
  const result = readDataForm(value);
  if (result.ok) throw new Error('EXPECTED_REJECTION');
  return { key: result.error.key, at: result.error.field };
}

describe('runtime form definitions', () => {
  it('[FORMS-01] reads a feature-owned JSON definition into a frozen definition with resolved conditions', () => {
    expect(featureBriefForm).toBe(featureBriefForm);
    expect(readDataForm(featureBrief)).toEqual({ ok: true, value: featureBriefForm });
    expect(Object.isFrozen(featureBriefForm) && Object.isFrozen(featureBriefForm.fields) && Object.isFrozen(featureBriefForm.fields[0])).toBe(true);
    expect(featureBriefForm.fields.map(field => field.kind)).toEqual(['title', 'text', 'select', 'number', 'multi', 'boolean', 'list', 'section']);
    const reviewers = featureBriefForm.fields[6];
    expect(reviewers?.when).toEqual({ field: 'review', target: 'review', equals: true, notEquals: undefined, present: undefined });
    expect(featureBriefForm.fields[7]?.fields?.map(field => field.id)).toEqual(['issue', 'design']);
    expect(featureBriefForm.fields[2]?.choices).toEqual([{ id: 'low', label: 'Low' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }]);
  });

  it('[FORMS-02] accepts the shared CLI format where it needs no hooks and names the CLI-only construct otherwise', () => {
    const outcomes = Object.fromEntries(readdirSync('configs/forms').sort().map(file => {
      const result = readDataForm(JSON.parse(readFileSync(`configs/forms/${file}`, 'utf8')));
      return [file, result.ok ? 'ok' : result.error.key];
    }));
    expect(outcomes).toMatchObject({ 'documentation-settings.json': 'form.cliOnly', 'prd-intake.json': 'form.cliOnly', 'project-identity.json': 'ok',
      'risk-review.json': 'form.cliOnly', 'setup-identity.json': 'form.cliOnly', 'user-settings-advanced.json': 'form.cliOnly', 'user-settings.json': 'form.cliOnly' });
    // Every shipped CLI form is either readable at runtime or names a CLI-only construct; no other failure is acceptable.
    expect(Object.entries(outcomes).filter(([, outcome]) => outcome !== 'ok' && outcome !== 'form.cliOnly')).toEqual([]);
    const accepted = readDataForm(form([text('a', { help: 'Two\nlines' }), { id: 'b', kind: 'boolean', label: 'B', yes: 'On', no: 'Off' },
      { id: 'c', kind: 'list', label: 'C', separator: ',', joiner: ', ', suffix: '.', multiline: true }], { $schema: '../schemas/form.schema.json', description: 'D' }));
    expect(accepted.ok && accepted.value.fields[1]).not.toHaveProperty('yes');
    expect(accepted.ok && accepted.value).not.toHaveProperty('$schema');
  });

  it('[FORMS-03] rejects CLI hooks, terminal-only kinds and unknown keys at their exact location', () => {
    const cases: [unknown, string, string | undefined][] = [
      [form([text('a')], { commit: 'settings.read' }), 'form.cliOnly', 'form.commit'],
      [form([text('a')], { extra: true }), 'form.unknownKey', 'form.extra'],
      [form([{ id: 'a', kind: 'confirm', label: 'A' }]), 'form.cliOnly', 'fields[0].kind'],
      [form([{ id: 'a', kind: 'record', label: 'A', bind: 'a' }]), 'form.cliOnly', 'fields[0].kind'],
      [form([{ id: 'a', kind: 'select', label: 'A', choicesFrom: 'x.y' }]), 'form.cliOnly', 'fields[0].choicesFrom'],
      [form([text('a', { transient: true })]), 'form.cliOnly', 'fields[0].transient'],
      [form([text('a', { effect: 'a.b' })]), 'form.cliOnly', 'fields[0].effect'],
      [form([{ id: 's', kind: 'section', label: 'S', form: 'other' }]), 'form.cliOnly', 'fields[0].form'],
      [form([{ id: 's', kind: 'section', label: 'S', gate: 'Open?', fields: [text('a')] }]), 'form.cliOnly', 'fields[0].gate'],
      [form([{ id: 's', kind: 'section', label: 'S', bind: 's', prepare: 'a.b', fields: [text('a')] }]), 'form.cliOnly', 'fields[0].prepare'],
      [form([text('a'), text('b', { when: { field: 'a', changed: true } })]), 'form.cliOnly', 'fields[1].when.changed'],
      [form([{ id: 'a', kind: 'date', label: 'A' }]), 'form.kind', 'fields[0].kind'],
      [form([{ id: 'a', kind: 7, label: 'A' }]), 'form.kind', 'fields[0].kind'],
      [form([text('a', { maxItems: 3 })]), 'form.unknownKey', 'fields[0].maxItems'],
      [form([{ id: 'a', kind: 'select', label: 'A', choices: [{ id: 'x', label: 'X', hint: 'no' }] }]), 'form.unknownKey', 'fields[0].choices[0].hint'],
    ];
    for (const [value, key, at] of cases) expect(rejected(value), JSON.stringify(value)).toEqual({ key, at });
  });

  it('[FORMS-04] rejects invalid structure, identifiers, text, paths and prototype keys', () => {
    const deep = (depth: number): unknown => depth === 0 ? text('leaf') : { id: `s${depth}`, kind: 'section', label: 'S', fields: [deep(depth - 1)] };
    const cases: [unknown, string, string | undefined][] = [
      [null, 'form.object', 'form'], [[], 'form.object', 'form'],
      [{ ...form([text('a')]), schemaVersion: 2 }, 'form.version', 'schemaVersion'],
      [{ ...form([text('a')]), version: 0 }, 'form.version', 'version'], [{ ...form([text('a')]), version: 1.5 }, 'form.version', 'version'],
      [{ ...form([text('a')]), id: 'Bad_Id' }, 'form.id', 'id'], [{ ...form([text('a')]), title: ' ' }, 'form.text', 'title'],
      [form([]), 'form.fields', 'fields'], [form([1]), 'form.object', 'fields[0]'], [form([deep(9)]), 'form.fields', `fields[0]${'.fields[0]'.repeat(8)}.fields`],
      [form([text('a'), text('a')]), 'form.id', 'fields[1].id'], [form([text('Name')]), 'form.id', 'fields[0].id'],
      [form([text('constructor')]), 'form.id', 'fields[0].id'], [form([text('prototype')]), 'form.id', 'fields[0].id'],
      [form([text('a', { label: 'Bell\u0007' })]), 'form.text', 'fields[0].label'], [form([text('a', { label: 'Line\nbreak' })]), 'form.text', 'fields[0].label'],
      [form([text('a', { label: 'Hi {{name}}' })]), 'form.cliOnly', 'fields[0].label'], [form([text('a', { help: '{{x|y}}' })]), 'form.cliOnly', 'fields[0].help'],
      [form([text('a', { bind: '__proto__' })]), 'form.path', 'fields[0].bind'], [form([text('a', { bind: 'a.constructor' })]), 'form.path', 'fields[0].bind'],
      [form([text('a', { bind: 'a..b' })]), 'form.path', 'fields[0].bind'], [form([text('a', { bind: 'x'.repeat(201) })]), 'form.path', 'fields[0].bind'],
      [form([{ id: 'b', kind: 'boolean', label: 'B', yes: 3 }]), 'form.text', 'fields[0].yes'],
    ];
    for (const [value, key, at] of cases) expect(rejected(value), JSON.stringify(value)).toEqual({ key, at });
    expect(readDataForm(form([deep(8)])).ok).toBe(true);
  });

  it('[FORMS-05] checks conditions, choices, numbers and defaults before a form can render', () => {
    const select = (extra: Record<string, unknown>) => ({ id: 'pick', kind: 'select', label: 'Pick', choices: ['a', 'b'], ...extra });
    const cases: [unknown, string, string | undefined][] = [
      [form([text('a', { when: { field: 'b', equals: 'x' } }), text('b')]), 'form.condition', 'fields[0].when.field'],
      [form([text('a'), text('b', { when: { field: 'a', equals: 'x', present: true } })]), 'form.condition', 'fields[1].when'],
      [form([text('a'), text('b', { when: { field: 'a' } })]), 'form.condition', 'fields[1].when'],
      [form([text('a', { when: { path: 'prototype', present: true } })]), 'form.path', 'fields[0].when.path'],
      [form([text('a'), text('b', { when: { field: 'a', present: 'yes' } })]), 'form.boolean', 'fields[1].when.present'],
      [form([text('a'), text('b', { when: { field: 'a', equals: { nested: true } } })]), 'form.value', 'fields[1].when.equals'],
      [form([text('a'), text('b', { when: { field: 'a', notEquals: [1] } })]), 'form.value', 'fields[1].when.notEquals'],
      [form([select({ choices: [] })]), 'form.choices', 'fields[0].choices'], [form([select({ choices: ['a', 'a'] })]), 'form.choices', 'fields[0].choices'],
      [form([select({ choices: [{ id: 'a', label: 'A {{b}}' }] })]), 'form.cliOnly', 'fields[0].choices[0].label'],
      [form([select({ choices: [1] })]), 'form.object', 'fields[0].choices[0]'], [form([select({ choices: undefined })]), 'form.choices', 'fields[0].choices'],
      [form([select({ default: 'c' })]), 'form.default', 'fields[0].default'], [form([select({ default: { a: 1 } })]), 'form.value', 'fields[0].default'],
      [form([text('a', { required: 'yes' })]), 'form.boolean', 'fields[0].required'],
      [form([{ id: 'n', kind: 'number', label: 'N', min: 'one' }]), 'form.number', 'fields[0].min'],
      [form([{ id: 'n', kind: 'number', label: 'N', min: 5, max: 1 }]), 'form.number', 'fields[0].max'],
      [form([{ id: 'n', kind: 'number', label: 'N', max: 3, default: 4 }]), 'form.default', 'fields[0].default'],
      [form([text('a', { maxLength: 0 })]), 'form.number', 'fields[0].maxLength'], [form([text('a', { maxLength: 1.5 })]), 'form.number', 'fields[0].maxLength'],
      [form([{ id: 's', kind: 'section', label: 'S', fields: [] }]), 'form.fields', 'fields[0].fields'],
      [form([{ id: 'm', kind: 'multi', label: 'M', choices: ['a'], default: ['b'] }]), 'form.default', 'fields[0].default'],
    ];
    for (const [value, key, at] of cases) expect(rejected(value), JSON.stringify(value)).toEqual({ key, at });
    const valid = readDataForm(form([text('a', { default: '' }), { id: 'm', kind: 'multi', label: 'M', choices: ['x'], required: true, default: [] },
      text('b', { bind: 'meta.b', when: { field: 'a', notEquals: 'x' } }), text('c', { when: { path: 'meta.b', present: true } })]));
    expect(valid.ok && valid.value.fields.map(field => field.when?.target)).toEqual([undefined, undefined, 'a', 'meta.b']);
  });

  it('[FORMS-06] defineForm fails at load for authors while foreign faults keep their identity', () => {
    expect(() => defineForm(form([{ id: 'a', kind: 'confirm', label: 'A' }]))).toThrow('FORM_DEFINITION: form.cliOnly at fields[0].kind');
    expect(() => defineForm(null)).toThrow('FORM_DEFINITION: form.object at form');
    expect(defineForm(form([text('a')])).fields[0]?.id).toBe('a');
    const hostile = { get schemaVersion(): number { throw new Error('getter fault'); } };
    expect(() => readDataForm(hostile)).toThrow('getter fault');
  });
});
