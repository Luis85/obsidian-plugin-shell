import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadGuide, guideInput } from '../../bin/adapters/prototype.ts';
import { readGuide, resolveAnswers, renderTemplate, guideBrief, answer, visible } from '../../bin/domain/guide.ts';
import { interview } from '../../bin/presentation/guide.ts';
import { Back, choose, confirm, selectMany, input, safe, reportError } from '../../bin/presentation/prompts.ts';
import { SketchError } from '../../bin/domain/errors.ts';
const scripted = values => { let index = 0; const output = []; return { output, ask: async () => { assert.ok(index < values.length, 'scripted prompt exhausted'); return values[index++]; }, write: text => output.push(text) }; };
test('declarative guide resolves defaults, branches and explicit readiness', async () => {
  const guide = await loadGuide(), ready = resolveAnswers(guide, { title: 'Prototype', approved: true });
  assert.equal(ready.pending.length, 0); assert.equal(ready.answers.mode, 'new-plugin');
  assert.ok(!('baselineRevision' in ready.answers));
  assert.equal(resolveAnswers(guide, { title: 'P' }).pending.length, 1);
  assert.equal(resolveAnswers(guide, { title: 'P', approved: true, conceptBoards: 'requested', openQuestions: ['How?'] }).pending.length, 2);
  assert.throws(() => resolveAnswers(guide, { title: 'P', mode: 'improvement', approved: true }));
  assert.throws(() => resolveAnswers(guide, { title: 'P', baselineRevision: 'inactive' }));
  assert.throws(() => resolveAnswers(guide, { title: 'P', wrong: true }));
  const existing = resolveAnswers(guide, { title: 'P', mode: 'improvement', baselineRevision: 'a'.repeat(40), approved: true });
  assert.equal(existing.answers.preserve.length, 0);
  const selected = resolveAnswers(guide, { title: 'P', conceptBoards: 'selected', boardDecisions: 'Board A r2; use its layout and keyboard rules.', approved: true });
  assert.match(guideBrief(guide, selected.answers), /Board A r2/);
  assert.throws(() => guideInput(guide, { schemaVersion: 1, guideId: guide.id, guideVersion: 0, answers: {} }));
});
test('interactive guide and agent answers normalize to identical bytes', async () => {
  const guide = await loadGuide();
  const choices = ['P', 'new-plugin', '', '', '', '', '', '', '', '', '', '', 'skipped', '', '', '', 'y'];
  const ui = scripted(choices);
  const interactive = await interview(ui, guide);
  const agent = resolveAnswers(guide, { title: 'P', approved: true }).answers;
  assert.deepEqual({ ...interactive }, { ...agent });
  assert.ok(ui.output.some(line => line.includes('Review and agreement')));
});
test('adding a field, step or template needs only guide data', async () => {
  const guide = await loadGuide();
  guide.steps.splice(1, 0, { title: 'An extension', fields: [{ id: 'newConstraint', label: 'New constraint', help: 'Enter the constraint.', kind: 'text', default: 'No extra shell' }] });
  const value = readGuide(guide), resolved = resolveAnswers(value, { title: 'P', approved: true, newConstraint: 'Keyboard first' });
  assert.match(guideBrief(value, resolved.answers), /Keyboard first/);
  assert.equal(renderTemplate('Design: {{title}}\n{{newConstraint}}', { title: 'P', newConstraint: 'Keyboard first' }), 'Design: P\nKeyboard first');
  assert.throws(() => renderTemplate('{{unknown}}', {}));
  assert.equal(renderTemplate('{{title}}', { title: '{{not-executed}}' }), '{{not-executed}}');
});
test('guide validation fails closed for malformed, future or executable guides', async () => {
  const guide = await loadGuide();
  const invalid = [null, { ...guide, schemaVersion: 2 }, { ...guide, version: 0 }, { ...guide, execute: 'rm -rf' },
    { ...guide, steps: [] }, { ...guide, constraints: [{ field: 'missing', equals: true, message: 'No' }] },
    { ...guide, artifacts: [{ path: 'a', template: '' }] }];
  for (const item of invalid) assert.throws(() => readGuide(item));
  for (const patch of [{ kind: 'code' }, { id: 'constructor' }, { when: { field: 'unknown', equals: true } }, { kind: 'select', choices: [] }, { required: 'yes' }]) {
    const changed = structuredClone(guide); Object.assign(changed.steps[0].fields[0], patch); assert.throws(() => readGuide(changed));
  }
  assert.throws(() => answer({ kind: 'confirm', label: 'Approval' }, 'true'));
  assert.throws(() => answer({ kind: 'select', choices: ['one'], label: 'Choice' }, 'two'));
  assert.equal(visible(undefined, {}), true);
});
test('terminal controls have deterministic selection, cancellation and validation', async () => {
  assert.equal(await choose(scripted(['invalid', '2']), 'Choose', [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]), 'b');
  assert.equal(await confirm(scripted(['maybe', 'yes']), 'Continue'), true);
  assert.equal(await confirm(scripted(['']), 'Continue'), false);
  assert.deepEqual(await selectMany(scripted(['2,1,2']), 'Bulk', [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]), ['b', 'a']);
  await assert.rejects(() => selectMany(scripted(['3']), 'Bulk', [{ id: 'a', label: 'A' }]));
  await assert.rejects(() => selectMany(scripted([]), 'Bulk', []));
  await assert.rejects(() => input(scripted([':back']), 'Name'), Back);
  assert.equal(await input(scripted(['']), 'Name', 'Default'), 'Default');
  assert.ok(!safe('bad\x1b[31m').includes('\x1b'));
  const ui = scripted([]); reportError(ui, new Back()); assert.equal(ui.output.length, 0);
  reportError(ui, new Error('Broken')); assert.match(ui.output[0], /Broken/);
  assert.throws(() => reportError(ui, new SketchError('CANCELLED', 'Stop')));
});

test('required lists and explicit null answers fail instead of silently taking defaults', async () => {
  const field = { kind: 'list', label: 'Pages', required: true };
  assert.throws(() => answer(field, []));
  assert.deepEqual(answer(field, ['Overview']), ['Overview']);
  const guide = await loadGuide();
  assert.throws(() => resolveAnswers(guide, { title: 'P', approved: null }));
  const changed = structuredClone(guide); changed.steps[0].fields[0].when = null;
  assert.throws(() => readGuide(changed));
});
