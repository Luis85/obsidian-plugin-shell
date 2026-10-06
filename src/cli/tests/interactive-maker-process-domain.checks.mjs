import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { processText, readProcess } from '../domain/process.ts';
import { processDataIssues, processGraphIssues } from '../domain/process-graph.ts';
import { assessStep, explainRule, nextTransition, processRulesFor, simulateProcess } from '../domain/process-engine.ts';
const repository = resolve(import.meta.dirname, '../../..');
const roles = [{ id: 'author', title: 'Author' }, { id: 'lead', title: 'Lead', description: 'Decides.' }];
const steps = () => [
  { id: 'draft', title: 'Draft', actor: 'author', bind: 'draft', fields: [{ id: 'size', kind: 'number', label: 'Size' }, { id: 'tags', kind: 'list', label: 'Tags' }], next: [{ to: 'decide' }] },
  { id: 'decide', title: 'Decide', actor: 'lead', fields: [{ id: 'decision', kind: 'select', label: 'Decision', choices: ['yes', 'no', 'again'] }],
    next: [{ to: 'done', when: { path: 'decision', equals: 'yes' }, label: 'accepted' }, { to: 'draft', when: { path: 'decision', equals: 'again' } }, { to: 'dropped' }] },
  { id: 'done', title: 'Done', actor: 'lead', terminal: true, outcome: 'accepted' },
  { id: 'dropped', title: 'Dropped', actor: 'lead', terminal: true },
];
const sample = (extra = {}) => ({ $schema: '../schemas/business-process.schema.json', schemaVersion: 1, id: 'sample', version: 2, title: 'Sample', purpose: 'Show the format.',
  status: 'draft', owner: 'lead', roles, steps: steps(), rules: [
    { id: 'small', statement: 'Drafts stay small.', severity: 'block', steps: ['draft'], require: { path: 'draft.size', lte: 10 } },
    { id: 'tagged', statement: 'Drafts are tagged.', rationale: 'Search.', severity: 'warn', steps: ['draft'], require: { path: 'draft.tags', length: true, gte: 1 } },
    { id: 'note', statement: 'Big drafts are noted.', severity: 'info', when: { path: 'draft.size', present: true }, require: { path: 'draft.size', lt: 5 } },
  ], ...extra });
const simulate = (definition, data, acknowledge = []) => simulateProcess(definition, { data, acknowledge: new Set(acknowledge), inputIssues: () => [] });

test('readProcess keeps a valid definition canonical and drops the editor schema hint', () => {
  const definition = readProcess(sample({ references: { entities: ['task'] }, doc: { text: 'Notes [[docs/README]].', file: 'sample.md' } }));
  assert.equal(definition.$schema, undefined);
  assert.deepEqual(definition.steps.map(step => step.id), ['draft', 'decide', 'done', 'dropped']);
  assert.deepEqual(definition.steps[1].next[0], { to: 'done', when: { path: 'decision', equals: 'yes' }, label: 'accepted' });
  assert.deepEqual(readProcess(JSON.parse(processText(definition))), definition, 'the saved text reads back unchanged');
  assert.match(processText(definition), /^\{\n {2}"\$schema": "\.\.\/schemas\/business-process\.schema\.json",\n {2}"schemaVersion": 1,/);
  assert.deepEqual(processGraphIssues(definition), []);
  assert.deepEqual(processDataIssues(definition, () => undefined), []);
});

test('readProcess fails closed on unknown keys, unsafe values, duplicates and unknown references', () => {
  const step = (index, change) => sample({ steps: steps().map((item, position) => position === index ? { ...item, ...change } : item) });
  for (const [value, pattern] of [
    [sample({ script: 'x' }), /Unknown fields: script/], [sample({ schemaVersion: 2 }), /Unsupported process version/], [sample({ id: 'Bad Id' }), /kebab-case/],
    [sample({ status: 'live' }), /draft, active, retired/], [sample({ owner: 'ghost' }), /owner ghost is not a declared role/], [sample({ title: 'a\nb' }), /single-line/],
    [sample({ roles: [...roles, roles[0]] }), /duplicates id author/], [sample({ steps: [] }), /at least one step/], [sample({ rules: [{ id: 'x' }] }), /statement needs text/],
    [step(0, { actor: 'ghost' }), /not a declared role/], [step(0, { id: 'decide' }), /duplicates id decide/], [step(0, { next: [{ to: 'nowhere' }] }), /unknown step nowhere/],
    [step(0, { next: [] }), /at least one transition/], [step(0, { next: [{ to: 'done' }, { to: 'decide', when: { path: 'draft.size', present: true } }] }), /only the last transition/],
    [step(2, { next: [{ to: 'draft' }] }), /terminal and cannot have next/], [step(0, { outcome: 'x' }), /outcome belongs to terminal/], [step(2, { terminal: false }), /terminal must be true/],
    [step(0, { form: 'project-identity' }), /either form or fields/], [step(0, { bind: '__proto__' }), /dotted path/], [step(0, { outputs: ['a..b'] }), /dotted path/],
    [step(0, { fields: [{ id: 'x', kind: 'script', label: 'X' }] }), /supported field kind/], [step(0, { doc: {} }), /needs text or file/],
    [step(0, { doc: { file: '../escape.md' } }), /kebab-case \.md path/], [step(0, { doc: { text: 'x', extra: 1 } }), /Unknown fields: extra/],
    [step(1, { next: [{ to: 'done', when: { path: 'x', run: 1 } }] }), /Unknown fields: run/],
    [sample({ rules: [{ id: 'r', statement: 'S', severity: 'fatal', require: { path: 'a', present: true } }] }), /block, warn, info/],
    [sample({ rules: [{ id: 'r', statement: 'S', severity: 'block', steps: ['ghost'], require: { path: 'a', present: true } }] }), /unknown step ghost/],
    [sample({ rules: [{ id: 'r', statement: 'S', severity: 'block', steps: [], require: { path: 'a', present: true } }] }), /at least one step/],
    [sample({ rules: [{ id: 'r', statement: 'S', severity: 'block', require: { path: 'a' } }] }), /exactly one/],
    [sample({ references: { screens: [] } }), /Unknown fields: screens/],
  ]) assert.throws(() => readProcess(value), pattern, JSON.stringify(value).slice(0, 160));
});

test('graph health finds unreachable steps, dead ends and a missing terminal; data checks find undecidable paths', () => {
  const orphan = readProcess(sample({ steps: [...steps(), { id: 'orphan', title: 'Orphan', actor: 'lead', terminal: true }] }));
  assert.deepEqual(processGraphIssues(orphan).map(item => [item.code, item.step]), [['PROCESS_UNREACHABLE', 'orphan']]);
  const loop = readProcess(sample({ steps: [steps()[0], { id: 'decide', title: 'Decide', actor: 'lead', next: [{ to: 'draft' }] }], rules: [] }));
  assert.deepEqual(processGraphIssues(loop).map(item => [item.code, item.step]), [['PROCESS_NO_TERMINAL', undefined], ['PROCESS_DEAD_END', 'draft'], ['PROCESS_DEAD_END', 'decide']]);
  const trap = readProcess(sample({ steps: [...steps().slice(0, 2).map(item => item.id === 'decide' ? { ...item, next: [{ to: 'trap', when: { path: 'decision', equals: 'no' } }, { to: 'done' }] } : item),
    { id: 'trap', title: 'Trap', actor: 'lead', next: [{ to: 'trap' }] }, steps()[2]] }));
  assert.deepEqual(processGraphIssues(trap).map(item => [item.code, item.step]), [['PROCESS_DEAD_END', 'trap']]);
  const unknown = readProcess(sample({ steps: steps().map(item => item.id === 'decide' ? { ...item, next: [{ to: 'done', when: { path: 'vote', equals: 1 } }, { to: 'dropped' }] } : item),
    rules: [{ id: 'r', statement: 'S', severity: 'block', when: { path: 'other.flag', present: true }, require: { path: 'draft.size', gt: 0 } }] }));
  assert.deepEqual(processDataIssues(unknown, () => undefined).map(item => [item.rule ?? item.step, item.message.split(',')[0]]),
    [['r', 'Rule r reads other.flag'], ['decide', 'Transition decide → done reads vote']]);
  const viaForm = readProcess(sample({ steps: steps().map(item => item.id === 'draft' ? { id: 'draft', title: 'Draft', actor: 'author', form: 'project-identity', bind: 'draft',
    outputs: ['ci.result'], next: [{ to: 'decide' }] } : item), rules: [{ id: 'r', statement: 'S', severity: 'block', require: { all: [{ path: 'draft.name', present: true }, { path: 'ci', present: true }, { path: 'draft.size', present: true }] } }] }));
  const lookup = id => id === 'project-identity' ? [{ id: 'name', kind: 'title', label: 'Name' }, { id: 'ok', kind: 'confirm', label: 'Ok?' },
    { id: 'more', kind: 'section', label: 'More', bind: 'more', fields: [{ id: 'note', kind: 'text', label: 'Note' }] }, { id: 'inline', kind: 'section', label: 'Inline', form: 'missing' }] : undefined;
  assert.deepEqual(processDataIssues(viaForm, lookup).map(item => item.message), ['Rule r reads draft.size, which no step collects or declares as an output.']);
});

test('rules apply by scope; unknown data violates fail-closed while a decided-false when skips the rule', () => {
  const definition = readProcess(sample());
  assert.deepEqual(processRulesFor(definition, 'draft').map(rule => rule.id), ['small', 'tagged', 'note']);
  assert.deepEqual(processRulesFor(definition, 'decide').map(rule => rule.id), ['note']);
  const empty = assessStep(definition, 'draft', {}, new Set());
  assert.deepEqual(empty.results.map(item => [item.rule, item.outcome, item.missing]), [['small', 'violated', ['draft.size']], ['tagged', 'violated', ['draft.tags']], ['note', 'not-applicable', undefined]]);
  assert.deepEqual([empty.blocking.map(item => item.rule), empty.pending.map(item => item.rule)], [['small'], ['tagged']]);
  const acknowledged = assessStep(definition, 'draft', { draft: { size: 8, tags: [] } }, new Set(['tagged', 'small']));
  assert.deepEqual(acknowledged.results.map(item => item.outcome), ['passed', 'acknowledged', 'violated']);
  assert.deepEqual([acknowledged.blocking, acknowledged.pending], [[], []], 'info violations never block and block rules cannot be acknowledged');
  assert.equal(explainRule(empty.results[1]), 'WARN tagged: Drafts are tagged. Why: Search. Missing data: draft.tags.');
  assert.equal(explainRule(acknowledged.results[2]), 'INFO note: Big drafts are noted.');
  const decide = definition.steps[1];
  assert.deepEqual([nextTransition(decide, { decision: 'yes' })?.to, nextTransition(decide, { decision: 'again' })?.to, nextTransition(decide, {})?.to], ['done', 'draft', 'dropped']);
  assert.equal(nextTransition(readProcess(sample({ steps: steps().map(item => item.id === 'decide' ? { ...item, next: item.next.slice(0, 2) } : item) })).steps[1], {}), undefined);
});

test('simulate walks transitions, stops on block, warn, invalid input or no transition, and bounds loops', () => {
  const definition = readProcess(sample());
  const done = simulate(definition, { draft: { size: 3, tags: ['a'] }, decision: 'yes' });
  assert.deepEqual([done.status, done.outcome, done.stoppedAt, done.trail.map(item => item.transition?.to ?? item.step)], ['completed', 'accepted', undefined, ['decide', 'done', 'done']]);
  assert.equal(done.trail[1].transition.label, 'accepted');
  assert.deepEqual(Object.keys(done), ['schemaVersion', 'process', 'version', 'status', 'message', 'outcome', 'trail', 'data']);
  const blocked = simulate(definition, { draft: { size: 30, tags: ['a'] } });
  assert.deepEqual([blocked.status, blocked.stoppedAt, blocked.trail.length], ['blocked', 'draft', 1]);
  assert.match(blocked.message, /^BLOCK small: Drafts stay small\./);
  const warned = simulate(definition, { draft: { size: 3, tags: [] }, decision: 'no' });
  assert.deepEqual([warned.status, warned.stoppedAt], ['needs-acknowledgement', 'draft']);
  const acknowledged = simulate(definition, { draft: { size: 3, tags: [] }, decision: 'no' }, ['tagged']);
  assert.deepEqual([acknowledged.status, acknowledged.outcome, acknowledged.trail[0].rules[1].outcome], ['completed', undefined, 'acknowledged']);
  assert.equal(acknowledged.message, 'Completed at dropped.');
  const invalid = simulateProcess(definition, { data: {}, acknowledge: new Set(), inputIssues: step => step.id === 'draft' ? ['size: Size is required.'] : [] });
  assert.deepEqual([invalid.status, invalid.trail[0].issues], ['invalid-input', ['size: Size is required.']]);
  const stuck = readProcess(sample({ steps: steps().map(item => item.id === 'decide' ? { ...item, next: item.next.slice(0, 2) } : item) }));
  assert.deepEqual([simulate(stuck, { draft: { size: 1, tags: ['a'] } }).status, simulate(stuck, { draft: { size: 1, tags: ['a'] } }).stoppedAt], ['no-transition', 'decide']);
  const loop = simulate(definition, { draft: { size: 1, tags: ['a'] }, decision: 'again' });
  assert.deepEqual([loop.status, loop.trail.length], ['loop-limit', 200]);
});

test('the shipped release-approval example is valid, healthy and demonstrates block and warn rules', async () => {
  const definition = readProcess(JSON.parse(await readFile(resolve(repository, 'configs/processes/release-approval.json'), 'utf8')));
  assert.deepEqual([processGraphIssues(definition), processDataIssues(definition, () => undefined)], [[], []]);
  assert.deepEqual(['block', 'warn', 'info'].map(severity => definition.rules.some(rule => rule.severity === severity)), [true, true, true]);
  const read = async name => JSON.parse(await readFile(resolve(repository, 'configs/processes/examples', name), 'utf8'));
  const blocked = await read('release-approval-blocked.json'), released = await read('release-approval-released.json');
  const run = input => simulate(definition, input.data, input.acknowledge);
  assert.deepEqual([run(blocked).status, run(blocked).stoppedAt], ['blocked', 'checks']);
  assert.deepEqual([run(released).status, run(released).outcome], ['completed', 'released']);
  assert.equal(run({ ...released, acknowledge: [] }).status, 'needs-acknowledgement');
});
