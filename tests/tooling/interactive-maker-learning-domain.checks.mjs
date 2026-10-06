import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { learningPrerequisiteIssues, learningLine, readLearningPath } from '../../bin/domain/learning-path.ts';
import { learningDocLink, learningDocTargets, learningHeadings, readLearningContentFile, readLearningDocTarget, readLearningMarkdown, renderLearningMarkdown } from '../../bin/domain/learning-markdown.ts';
import { completeLearningStep, learningProgressPath, learningStep, learningStepOpen, learningSummary, newLearningProgress, readLearningProgress, readLearningStepInput } from '../../bin/domain/learning-progress.ts';
import { learningAnswered, learningAnswersAt, learningConditionLabel, learningFile, learningProgressCheck, learningStepForm, learningWizardId } from '../../bin/domain/learning-conditions.ts';
import { readForm } from '../../bin/domain/form.ts';
const step = (id, extra = {}) => ({ id, title: `Step ${id}`, goal: 'Learn something.', ...extra });
const path = (steps, extra = {}) => ({ schemaVersion: 1, id: 'course', version: 1, title: 'Course', summary: 'Learn it.', skill: 'Skill', audience: 'Everyone', estimatedMinutes: 5, steps, ...extra });
const now = '2026-10-04T10:00:00.000Z';
const fields = [{ id: 'name', kind: 'title', label: 'Name' }, { id: 'role', kind: 'select', label: 'Role', choices: ['dev', 'ops'] }];
const full = () => readLearningPath(path([
  step('read', { markdown: 'See [[docs/guide#Start|the guide]] and [[README]].', docs: ['docs/extra'], checklist: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', required: false }],
    actions: [{ id: 'cmd', kind: 'command', label: 'Check', command: 'node bin/app wizard check --json' }], winConditions: [{ kind: 'checklist-complete' }] }),
  step('ask', { fields, bind: 'me', actions: [{ id: 'more', kind: 'form', label: 'More', form: 'project-identity', bind: 'identity' }, { id: 'run', kind: 'wizard', label: 'Run', wizard: '{{me.wizard}}' }],
    winConditions: [{ kind: 'form-valid' }, { kind: 'answer', path: 'me.role', equals: 'dev', label: 'You develop' }, { kind: 'wizard-completed', wizard: '{{me.wizard}}' }] }),
  step('files', { markdown: { file: 'course/files.md' }, winConditions: [
    { kind: 'file-exists', file: 'configs/wizards/{{me.wizard}}.json' }, { kind: 'file-contains', file: 'notes/{{me.name}}.md', text: 'Hello {{me.name}}' }, { kind: 'wizard-check', wizard: 'settings' }] }),
]));

test('a learning path reads every step element: Markdown, docs, forms, checklists, actions and win conditions', () => {
  const course = full();
  assert.deepEqual(course.prerequisites, []);
  assert.equal(course.$schema, undefined);
  assert.deepEqual(course.steps[0].checklist, [{ id: 'a', label: 'A', required: true }, { id: 'b', label: 'B', required: false }]);
  assert.deepEqual(course.steps[1].winConditions[1], { kind: 'answer', label: 'You develop', when: { path: 'me.role', equals: 'dev' } });
  assert.deepEqual(course.steps[1].actions.map(item => [item.kind, item.form ?? item.wizard, item.bind]), [['form', 'project-identity', 'identity'], ['wizard', '{{me.wizard}}', undefined]]);
  assert.deepEqual(course.steps[2].markdown, { file: 'course/files.md' });
  assert.deepEqual(course.steps[2].winConditions.map(item => item.kind), ['file-exists', 'file-contains', 'wizard-check']);
  assert.equal(readLearningPath({ ...path([step('one', { form: 'project-identity', bind: 'identity' })]), $schema: 'x', prerequisites: ['basics'] }).prerequisites[0], 'basics');
});

test('learning path validation fails closed for unknown, unsafe, duplicate or unreachable shapes', () => {
  for (const [steps, pattern] of [
    [[step('a', { run: 'rm -rf /' })], /Unknown fields: run/],
    [[step('a'), step('a')], /unique kebab-case id/],
    [[step('Bad')], /unique kebab-case id/],
    [[step('a', { title: 'two\nlines' })], /single line/],
    [[step('a', { goal: 'bell\u0007' })], /control characters/],
    [[step('a', { fields, bind: '__proto__.x' })], /dotted path/],
    [[step('a', { fields })], /bind needs text/],
    [[step('a', { bind: 'x' })], /bind needs form or fields/],
    [[step('a', { form: 'x', fields, bind: 'x' })], /not both/],
    [[step('a', { form: 'Not An Id', bind: 'x' })], /form id/],
    [[step('a', { checklist: [] })], /at least one item/],
    [[step('a', { checklist: [{ id: 'x', label: 'X', required: 'yes' }] })], /required must be boolean/],
    [[step('a', { checklist: [{ id: 'x', label: 'X' }, { id: 'x', label: 'Y' }] })], /unique kebab-case id/],
    [[step('a', { actions: [{ id: 'x', kind: 'shell', label: 'X' }] })], /wizard, form or command/],
    [[step('a', { actions: [{ id: 'x', kind: 'command', label: 'X', command: 'rm -rf /' }] })], /displayed node bin\/app or npm run/],
    [[step('a', { actions: [{ id: 'x', kind: 'command', label: 'X', command: 'node bin/app x; rm -rf /' }] })], /displayed node bin\/app/],
    [[step('a', { actions: [{ id: 'x', kind: 'wizard', label: 'X', wizard: 'Bad Wizard' }] })], /project-relative path or id template/],
    [[step('a', { actions: [{ id: 'x', kind: 'wizard', label: 'X', wizard: 'a/{{b}}' }] })], /wizard id or one/],
    [[step('a', { actions: [{ id: 'x', kind: 'form', label: 'X', form: 'Bad' }] })], /form id/],
    [[step('a', { actions: [{ id: 'x', kind: 'form', label: 'X', form: 'ok' }] })], /bind needs text/],
    [[step('a', { winConditions: [{ kind: 'script' }] })], /supported win condition/],
    [[step('a', { winConditions: [{ kind: 'checklist-complete', file: 'x' }] })], /Unknown fields: file/],
    [[step('a', { winConditions: [{ kind: 'checklist-complete' }] })], /checklist-complete needs a checklist/],
    [[step('a', { winConditions: [{ kind: 'form-valid' }] })], /form-valid needs a form/],
    [[step('a', { winConditions: [{ kind: 'wizard-completed', wizard: 'settings' }] })], /needs a wizard action in the same step/],
    [[step('a', { winConditions: [{ kind: 'answer', path: 'x', present: true, equals: 'y' }] })], /exactly one/],
    [[step('a', { winConditions: [{ kind: 'answer', path: 'constructor.x', present: true }] })], /dotted path/],
    [[step('a', { winConditions: [{ kind: 'file-exists', file: '../outside.txt' }] })], /project-relative path/],
    [[step('a', { winConditions: [{ kind: 'file-exists', file: 'a b.txt' }] })], /project-relative path/],
    [[step('a', { winConditions: [{ kind: 'file-contains', file: 'a.txt' }] })], /text needs text/],
    [[step('a', { markdown: '<script>alert(1)</script>' })], /executable markup/],
    [[step('a', { markdown: '[x](javascript:alert(1))' })], /executable markup/],
    [[step('a', { markdown: '<img src=x onerror=alert(1)>' })], /executable markup/],
    [[step('a', { markdown: 'Escape \u001b[31m' })], /control characters/],
    [[step('a', { markdown: 'See [[src/main]]' })], /under docs\/, bin\/ or the repository root/],
    [[step('a', { markdown: 'See [[docs/../secret]]' })], /under docs\//],
    [[step('a', { markdown: { file: '../escape.md' } })], /below configs\/learning\/content/],
    [[step('a', { markdown: { file: 'notes.txt' } })], /below configs\/learning\/content/],
    [[step('a', { markdown: { file: 'a.md', extra: true } })], /Unknown fields: extra/],
    [[step('a', { docs: ['docs/page#'] })], /empty or nested heading/],
    [[step('a', { docs: ['docs/page#a#b'] })], /empty or nested heading/],
    [[], /at least one step/],
  ]) assert.throws(() => readLearningPath(path(steps)), pattern, JSON.stringify(steps));
  assert.throws(() => readLearningPath({ ...path([step('a')]), schemaVersion: 2 }), /Unsupported learning path version/);
  assert.throws(() => readLearningPath({ ...path([step('a')]), id: 'Course' }), /kebab-case/);
  assert.throws(() => readLearningPath({ ...path([step('a')]), estimatedMinutes: 1.5 }), /whole number of minutes/);
  assert.throws(() => readLearningPath({ ...path([step('a')]), prerequisites: ['course'] }), /another learning path/);
  assert.throws(() => readLearningPath({ ...path([step('a')]), prerequisites: ['x', 'x'] }), /unique/);
  assert.throws(() => readLearningPath({ ...path([step('a')]), owner: 'me' }), /Unknown fields: owner/);
  assert.throws(() => learningLine('a\tb', 'name', 10), /single line/);
});

test('prerequisites must exist and be acyclic', () => {
  const paths = new Map([['a', { prerequisites: ['b'] }], ['b', { prerequisites: ['c'] }], ['c', { prerequisites: ['a', 'ghost'] }], ['d', { prerequisites: ['a'] }]]);
  const issues = learningPrerequisiteIssues(paths);
  assert.ok(issues.includes('path a: prerequisite cycle a → b → c → a.'), issues.join('\n'));
  assert.ok(issues.includes('path c: unknown prerequisite ghost.'), issues.join('\n'));
  assert.deepEqual(learningPrerequisiteIssues(new Map([['a', { prerequisites: [] }], ['b', { prerequisites: ['a'] }]])), []);
});

test('Markdown links resolve to documentation files and render as plain terminal text', () => {
  assert.deepEqual(learningDocLink('docs/guide#Start'), { target: 'docs/guide#Start', file: 'docs/guide.md', heading: 'Start' });
  assert.deepEqual(learningDocLink('README.md'), { target: 'README.md', file: 'README.md' });
  assert.deepEqual(learningDocTargets('See [[docs/a]] and [[docs/b#X|b]] and [[docs/a]].', ['docs/c', 'docs/a']), ['docs/a', 'docs/b#X', 'docs/c']);
  assert.deepEqual(learningDocTargets(undefined), []);
  assert.equal(renderLearningMarkdown('Read [[docs/a#Forms|the forms]] or [[bin/TUI]].'), 'Read the forms (docs/a.md#Forms) or bin/TUI.md.');
  assert.deepEqual([...learningHeadings('# Title\ntext\n## Run, inspect and check ##\n####### not\n')], ['title', 'run, inspect and check']);
  assert.equal(readLearningMarkdown('Use `<id>` placeholders and <b>bold</b>.', 'x', 100), 'Use `<id>` placeholders and <b>bold</b>.');
  assert.throws(() => readLearningMarkdown('x'.repeat(11), 'x', 10), /1–10 characters/);
  assert.throws(() => readLearningDocTarget(42, 'link'), /needs a documentation link/);
  assert.equal(readLearningContentFile('course/a.md', 'file'), 'course/a.md');
});

test('progress starts empty, advances in order and records completion once', () => {
  const course = full(), start = newLearningProgress(course, now);
  assert.equal(learningProgressPath('course'), '.workbench/learning/course.json');
  assert.deepEqual([start.currentStep, start.pathVersion, Object.keys(start.completed)], ['read', 1, []]);
  assert.equal(learningStepOpen(course, start, 'ask'), false);
  assert.throws(() => completeLearningStep(course, start, 'ask', now), /Complete the steps before ask first/);
  const first = completeLearningStep(course, start, 'read', now);
  assert.deepEqual([first.currentStep, first.completed.read, start.completed.read], ['ask', now, undefined]);
  const again = completeLearningStep(course, first, 'read', '2026-10-05T00:00:00.000Z');
  assert.equal(again.completed.read, now);
  const last = completeLearningStep(course, completeLearningStep(course, first, 'ask', now), 'files', now);
  assert.equal(last.currentStep, 'files');
  assert.deepEqual(learningSummary(course, last), { totalSteps: 3, completedSteps: 3, currentStep: 'files', finished: true, started: true });
  assert.deepEqual(learningSummary(course, null), { totalSteps: 3, completedSteps: 0, currentStep: null, finished: false, started: false });
  assert.throws(() => learningStep(course, 'nope'), /Unknown step nope in course/);
});

test('saved progress is validated against its path and fails closed instead of being repaired', () => {
  const course = full(), saved = { ...completeLearningStep(course, newLearningProgress(course, now), 'read', now), checklists: { read: ['a', 'a'] }, wizards: { onboarding: now }, answers: { me: { name: 'Ann' } } };
  const read = readLearningProgress(JSON.parse(JSON.stringify(saved)), course);
  assert.deepEqual([read.currentStep, read.checklists.read, read.wizards.onboarding, read.answers.me.name], ['ask', ['a'], now, 'Ann']);
  for (const [change, pattern] of [
    [{ producer: 'other' }, /Unknown learning progress file/],
    [{ path: 'other' }, /belongs to other/],
    [{ pathVersion: 0 }, /pathVersion/],
    [{ currentStep: 'gone' }, /Unknown step gone/],
    [{ completed: { gone: now } }, /Unknown step gone/],
    [{ completed: { read: 'yesterday' } }, /ISO timestamp/],
    [{ checklists: { read: ['zzz'] } }, /unknown checklist items/],
    [{ checklists: { ask: ['a'] } }, /unknown checklist items/],
    [{ wizards: { Bad: now } }, /keyed by wizard id/],
    [{ answers: [] }, /Expected a JSON object/],
    [{ approved: true }, /Unknown fields: approved/],
    [{ updatedAt: '2026-13-45T99:00:00Z' }, /ISO timestamp/],
  ]) assert.throws(() => readLearningProgress({ ...saved, ...change }, course), pattern, JSON.stringify(change));
});

test('agent step input carries answers, checklist ticks and an optional completion time', () => {
  const course = full();
  assert.deepEqual(readLearningStepInput({ schemaVersion: 1, checklist: ['a', 'a'], completedAt: now }, course.steps[0]), { checklist: ['a'], completedAt: now });
  assert.deepEqual(readLearningStepInput({ schemaVersion: 1, answers: { name: 'Ann' } }, course.steps[1]), { answers: { name: 'Ann' } });
  assert.throws(() => readLearningStepInput({ schemaVersion: 2 }, course.steps[0]), /schemaVersion 1/);
  assert.throws(() => readLearningStepInput({ schemaVersion: 1, answers: {} }, course.steps[0]), /has no form/);
  assert.throws(() => readLearningStepInput({ schemaVersion: 1, checklist: ['zzz'] }, course.steps[0]), /must name items/);
  assert.throws(() => readLearningStepInput({ schemaVersion: 1, checklist: ['a'] }, course.steps[1]), /must name items/);
  assert.throws(() => readLearningStepInput({ schemaVersion: 1, approve: true }, course.steps[0]), /Unknown fields: approve/);
});

test('progress-only win conditions decide checklists, forms, answers and wizard runs', () => {
  const course = full(), progress = newLearningProgress(course, now), [read, ask, files] = course.steps;
  const identity = readForm({ schemaVersion: 1, id: 'project-identity', version: 1, title: 'Identity', fields: [{ id: 'name', kind: 'title', label: 'Name' }] });
  const lookup = id => id === 'project-identity' ? identity : undefined;
  assert.deepEqual(learningProgressCheck(read, read.winConditions[0], progress, lookup), [false, 'Still open: A']);
  progress.checklists.read = ['a'];
  assert.deepEqual(learningProgressCheck(read, read.winConditions[0], progress, lookup), [true, undefined]);
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[0], progress, lookup), [false, 'Fill in the step form first.']);
  progress.answers.me = { name: 'Ann', role: 'boss' };
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[0], progress, lookup), [false, 'Role: choose dev, ops.']);
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[1], progress, lookup), [false, undefined]);
  progress.answers.me.role = 'dev';
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[0], progress, lookup), [true, undefined]);
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[1], progress, lookup), [true, undefined]);
  assert.throws(() => learningProgressCheck(ask, ask.winConditions[2], progress, lookup), /Answer me.wizard in an earlier step first/);
  progress.answers.me.wizard = 'onboarding';
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[2], progress, lookup), [false, undefined]);
  progress.wizards.onboarding = now;
  assert.deepEqual(learningProgressCheck(ask, ask.winConditions[2], progress, lookup), [true, undefined]);
  assert.equal(learningProgressCheck(files, files.winConditions[0], progress, lookup), undefined);
  const formStep = readLearningPath(path([step('f', { form: 'project-identity', bind: 'id', winConditions: [{ kind: 'form-valid' }] })])).steps[0];
  assert.equal(learningStepForm(formStep, lookup), identity);
  assert.deepEqual(learningProgressCheck(formStep, formStep.winConditions[0], { ...progress, answers: { id: { name: 'Demo' } } }, () => undefined), [false, 'Unknown form project-identity.']);
  assert.equal(learningStepForm(read, lookup), undefined);
});

test('labels and templates render answers literally, and rendered files and ids are rechecked', () => {
  const course = full(), progress = newLearningProgress(course, now), [read, ask, files] = course.steps;
  assert.equal(learningConditionLabel(files.winConditions[0], progress), 'File configs/wizards/{{me.wizard}}.json exists');
  progress.answers.me = { wizard: 'onboarding', name: 'Ann' };
  assert.deepEqual([read, ask, files].flatMap(item => item.winConditions.map(condition => learningConditionLabel(condition, progress))), [
    'All required checklist items are ticked', 'The step form is complete and valid', 'You develop', 'Wizard onboarding was run to its end from this step',
    'File configs/wizards/onboarding.json exists', 'File notes/Ann.md contains "Hello Ann"', 'wizard check passes and lists settings']);
  assert.equal(learningConditionLabel({ kind: 'answer', when: { path: 'x', present: false } }, progress), 'Answer x is not answered');
  assert.equal(learningConditionLabel({ kind: 'answer', when: { path: 'x', notEquals: 'y' } }, progress), 'Answer x is not "y"');
  assert.equal(learningConditionLabel({ kind: 'wizard-check' }, progress), 'wizard check passes');
  assert.equal(learningFile(files.winConditions[0], progress), 'configs/wizards/onboarding.json');
  assert.equal(learningAnswered('{{missing|fallback}}-{{me.name}}', progress), 'fallback-Ann');
  progress.answers.me = { wizard: '../escape', name: '' };
  assert.throws(() => learningFile(files.winConditions[0], progress), /not a safe project-relative file/);
  assert.throws(() => learningFile(files.winConditions[1], progress), /Answer me.name/);
  assert.throws(() => learningWizardId('{{me.wizard}}', progress), /not a wizard id/);
  assert.throws(() => learningFile({ file: '{{dir}}/x' }, { answers: { dir: '.git' } }), /not a safe project-relative file/);
  assert.equal(learningWizardId('settings', progress), 'settings');
  const answers = { me: { name: 'Ann' }, list: [1] };
  assert.deepEqual(learningAnswersAt({ answers }, 'me'), { name: 'Ann' });
  assert.notEqual(learningAnswersAt({ answers }, 'me'), answers.me);
  assert.deepEqual(Object.keys(learningAnswersAt({ answers }, 'list')), []);
});
