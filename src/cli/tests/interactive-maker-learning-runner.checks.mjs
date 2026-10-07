import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { launchLearning } from '../presentation/learning-runner.ts';
import { runLearningWizard } from '../presentation/learning-actions.ts';
import { Back } from '#tui/prompts.ts';
import { wizardCatalog } from '../presentation/wizards/registry.ts';
import { contactForm, greetWizard, learningPath, plainPrompts, project, put, scratch, step, wizard } from './support/interactive-maker-learning-fixture.mjs';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const BACK = Symbol('back');
const tour = learningPath('tour', [
  step('read', { markdown: 'Start with [[docs/guide#Start here|the guide]].', docs: ['README'],
    checklist: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', required: false }],
    actions: [{ id: 'cmd', kind: 'command', label: 'Check it', command: 'node bin/app learn check --json' }], winConditions: [{ kind: 'checklist-complete' }] }),
  step('ask', { fields: [{ id: 'name', kind: 'title', label: 'Your name' }], bind: 'me',
    actions: [{ id: 'more', kind: 'form', label: 'A contact', form: 'contact', bind: 'contact' }, { id: 'run', kind: 'wizard', label: 'Greet', wizard: 'greet' }],
    winConditions: [{ kind: 'form-valid' }, { kind: 'wizard-completed', wizard: 'greet' }] }),
  step('write', { winConditions: [{ kind: 'file-exists', file: 'notes/{{me.name}}.md' }] }),
]);
const later = learningPath('later', [step('only')], { prerequisites: ['tour'] });
async function setup(root) {
  return project(root, { forms: { contact: contactForm }, wizards: { greet: greetWizard }, paths: { tour, later },
    docs: { 'docs/guide.md': '# Guide\n\n## Start here\n', 'README.md': '# Readme\n' } });
}
const options = (root, configsRoot) => ({ root, frameworkRoot, configsRoot });
const learn = (name = '') => ({ command: 'learn', action: '', flags: name ? { name } : {} });
const menu = 'Choose number or ID';

test('a plain terminal run teaches, asks, ticks, runs actions, checks win conditions and saves through review', async () => scratch(async root => {
  const configs = await setup(root), file = join(root, '.workbench/learning/tour.json');
  const f = plainPrompts([
    '2', 'y',
    'check', 'checklist', 'y', 'maybe', '', 'action:cmd', '',
    'check', 'form', 'Ann', 'action:run', 'Bob', 'n', 'action:run', 'Bob', 'y', 'action:more', 'Cy', BACK, '', 'check',
    'check', 'exit', 'y', 'y',
  ], BACK);
  const completion = await launchLearning(f.ui, learn(), options(root, configs));
  assert.equal(completion, 'Progress saved to .workbench/learning/tour.json. Run node bin/app learn --name tour to continue.\n');
  assert.equal(f.left(), 0);
  const text = f.text();
  for (const expected of ['Course tour — Overview', 'Summary\nLearn it.', 'Steps\n[ ] 1. Step read\n[ ] 2. Step ask\n[ ] 3. Step write',
    'Course tour — Step 1/3: Step read', 'Lesson\nStart with the guide (docs/guide.md#Start here).', 'Documentation\n- docs/guide.md → Start here\n- README.md',
    'Checklist\n[ ] A\n[ ] B (optional)', 'Actions\n- Check it\n    node bin/app learn check --json', 'Win conditions\n[ ] All required checklist items are ticked\n    Still open: A',
    'Not yet complete:\n  - All required checklist items are ticked: Still open: A', 'Enter yes or no.', '  node bin/app learn check --json\n\nLearning paths show commands; they never run them for you.',
    'Checklist\n[x] A\n[ ] B (optional)', 'Step completed.', 'Win conditions\n[ ] The step form is complete and valid\n    Fill in the step form first.',
    'Wizard greet did not reach its end; run it again to count it.', 'Wizard greet completed.', 'Hello Bob.',
    'Win conditions\n[x] The step form is complete and valid\n[x] Wizard greet was run to its end from this step', 'Goal\nLearn read.\nCompleted ',
    'Course tour — Step 3/3: Step write', '  - File notes/Ann.md exists: notes/Ann.md does not exist yet.', 'create     .workbench/learning/tour.json', 'Progress saved to .workbench/learning/tour.json.'])
    assert.ok(text.includes(expected), `missing ${JSON.stringify(expected)}\n${text}`);
  assert.ok(f.questions.includes('Start Course tour? (y/N): ') && f.questions.includes('Done: B (optional)? (y/n) [n]: ') && f.questions.includes(`${menu} [check]: `) && f.questions.includes(`${menu} [next]: `));
  assert.ok(text.includes('2. Course tour — Skill (5 min, 0/3 steps)'), text);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual([saved.currentStep, Object.keys(saved.completed), saved.checklists, saved.answers, Object.keys(saved.wizards)],
    ['write', ['read', 'ask'], { read: ['a'] }, { me: { name: 'Ann' }, contact: { name: 'Cy' } }, ['greet']]);

  await put(root, 'notes/Ann.md', 'Hello');
  const resume = plainPrompts(['resume', 'check', 'y', 'y'], BACK);
  assert.equal(await launchLearning(resume.ui, learn('tour'), options(root, configs)), 'Progress saved to .workbench/learning/tour.json. Run node bin/app learn --name tour to continue.\n');
  assert.ok(resume.text().includes('Step completed. You finished Course tour.'), resume.text());
  assert.ok(resume.text().includes('Steps\n[x] 1. Step read\n[x] 2. Step ask\n[ ] 3. Step write'), resume.text());
  assert.deepEqual(Object.keys(JSON.parse(await readFile(file, 'utf8')).completed), ['read', 'ask', 'write']);

  const before = await readFile(file, 'utf8');
  const restart = plainPrompts(['restart', 'exit', 'n'], BACK);
  assert.equal(await launchLearning(restart.ui, learn('tour'), options(root, configs)), 'Progress was not saved; .workbench/learning/tour.json is unchanged.\n');
  assert.ok(restart.text().includes('Course tour — Step 1/3: Step read'), restart.text());
  const declined = plainPrompts(['restart', 'exit', 'y', 'n'], BACK);
  assert.equal(await launchLearning(declined.ui, learn('tour'), options(root, configs)), 'Progress was not saved; .workbench/learning/tour.json is unchanged.\n');
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal(await launchLearning(plainPrompts(['exit'], BACK).ui, learn('tour'), options(root, configs)), undefined);
  const prerequisite = plainPrompts(['n'], BACK);
  assert.equal(await launchLearning(prerequisite.ui, learn('later'), options(root, configs)), undefined);
  assert.ok(prerequisite.text().includes('Recommended first\n[x] Course tour (tour)'), prerequisite.text());
}));

test('leaving without changes saves nothing, Back at the first step exits, and failures keep the step open', async () => scratch(async root => {
  const configs = await setup(root);
  await rm(join(root, 'configs/wizards/greet.json'));
  await put(root, 'configs/wizards/greet.json', wizard('greet', [{ id: 'a', kind: 'form', form: 'missing' }]));
  await assert.rejects(() => launchLearning(plainPrompts([], BACK).ui, learn('tour'), options(root, configs)), /unknown form missing|LEARNING_REFERENCE/);
  await put(root, 'configs/wizards/greet.json', greetWizard);
  await put(root, '.workbench/learning/tour.json', JSON.stringify({ schemaVersion: 1, producer: 'workbench-learning-progress', path: 'tour', pathVersion: 1, currentStep: 'ask',
    completed: { read: '2026-10-04T10:00:00.000Z' }, answers: {}, checklists: { read: ['a'] }, wizards: {}, updatedAt: '2026-10-04T10:00:00.000Z' }));
  const breakWizard = async () => { await put(root, 'configs/wizards/greet.json', wizard('greet', [{ id: 'a', kind: 'form', form: 'missing' }])); return 'action:run'; };
  const f = plainPrompts(['resume', breakWizard, BACK, BACK], BACK);
  const result = await launchLearning(f.ui, learn('tour'), options(root, configs));
  assert.equal(result, 'Nothing new to save for Course tour. Run node bin/app learn --name tour to continue.\n');
  assert.match(f.text(), /DEFINITION_REFERENCE: wizard greet.a: unknown form missing/);
  assert.ok(f.text().includes('Course tour — Step 1/3: Step read'), 'Back from the step menu shows the previous step');
  await put(root, 'configs/wizards/greet.json', greetWizard);
  await assert.rejects(() => launchLearning(plainPrompts([], BACK).ui, learn('ghost'), options(root, configs)), /Unknown learning path ghost/);
}));

test('the terminal UI pages through review sections and ticks the checklist with one multi-select', async () => scratch(async root => {
  const configs = await setup(root), reviews = [], contexts = [];
  const answers = { 'Start Course tour?': ['yes'], 'What would you like to do?': ['action:cmd', 'checklist', 'check', 'exit'], 'Tick what you have done': [['a', 'b']], 'Save your learning progress?': ['no'] };
  const next = title => { assert.ok(answers[title]?.length, 'Unexpected prompt: ' + title); return answers[title].shift(); };
  const ui = { write: () => {}, ask: async () => { throw new Error('plain prompt'); }, rich: {
    context: value => contexts.push(value), busy: () => {}, review: async (title, sections) => { reviews.push({ title, sections: sections.map(item => item.title) }); },
    select: async (title, items) => { const value = next(title); assert.ok(items.some(item => item.id === value), `${title}: ${value}`); return value; },
    multi: async (title, items, selected) => { assert.deepEqual([items.map(item => item.label), selected], [['A', 'B (optional)'], []]); return next(title); },
    text: async () => { throw new Error('no text expected'); },
  } };
  assert.equal(await launchLearning(ui, learn('tour'), options(root, configs)), 'Progress was not saved; .workbench/learning/tour.json is unchanged.\n');
  assert.deepEqual(reviews.map(item => item.title), ['Course tour — Overview', 'Course tour — Step 1/3: Step read', 'Check it', 'Course tour — Step 1/3: Step read', 'Course tour — Step 1/3: Step read', 'Course tour — Step 2/3: Step ask']);
  assert.deepEqual(reviews[1].sections, ['Goal', 'Lesson', 'Documentation', 'Checklist', 'Actions', 'Win conditions']);
  assert.deepEqual(reviews[2].sections, ['Command']);
  assert.deepEqual(contexts[1], { title: 'Course tour', location: 'Step 1/3: Step read', details: ['Skill'] });
  assert.deepEqual(Object.values(answers).flat(), []);
}));

test('a wizard counts as completed only when it reaches its end, never when declined or left', async () => scratch(async root => {
  const configs = await project(root, { forms: { contact: contactForm }, wizards: {
    greet: greetWizard,
    polite: wizard('polite', [{ id: 'ask', kind: 'form', form: 'contact', bind: 'contact' }], { cancelMessage: 'Maybe later.' }),
    branch: wizard('branch', [
      { id: 'ask', kind: 'form', form: 'contact', bind: 'contact' },
      { id: 'stop', kind: 'end', text: 'Stopped.', when: { path: 'contact.name', equals: 'Stop' } },
      { id: 'go', kind: 'message', text: 'Going on.' },
    ]),
  } });
  const definitions = await wizardCatalog(configs), runs = [];
  const attempt = async (id, lines) => { const f = plainPrompts(lines, BACK); runs.push(await runLearningWizard(f.ui, definitions, id, { root, frameworkRoot })); return f; };
  await attempt('greet', ['Ann', 'y']);
  await attempt('greet', ['Ann', 'n']);
  assert.match((await attempt('polite', [BACK])).text(), /Maybe later/);
  assert.match((await attempt('branch', ['Stop'])).text(), /Stopped\./);
  assert.match((await attempt('branch', ['Go'])).text(), /Going on\./);
  assert.deepEqual(runs, [true, false, false, true, true]);
  await assert.rejects(() => attempt('greet', [BACK]), Back);
  await assert.rejects(() => runLearningWizard(plainPrompts([], BACK).ui, definitions, 'ghost', { root, frameworkRoot }), /Unknown wizard ghost/);
  assert.equal(definitions.wizards.get('greet').steps.length, 3, 'the shared catalog definition is never modified');
}));
