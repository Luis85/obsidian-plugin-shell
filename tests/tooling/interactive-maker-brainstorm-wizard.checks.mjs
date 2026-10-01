import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { hash } from '../../scripts/framework/files.ts';
import { brainstormWizard } from '../../bin/presentation/brainstorm.ts';
import { brainstormFeaturePlan } from '../../bin/adapters/brainstorm.ts';
import { BACK, brainstormScratch, scriptedRich, quickNote, readText, readScratchJson } from './interactive-maker-brainstorm-fixture.mjs';

const completionFor = (slug, imported) => 'Brainstorm saved to brainstorms/' + slug + '. Concept: docs/concepts/brainstorms/' + slug +
  '.json. ' + (imported ? 'The feature is imported in the canonical project. ' :
  'The canonical project was not changed; import remains a separate reviewed action. ') + 'No source was generated.\n';

test('guided screens, navigation, Back and review produce the same package as the agent request', async () =>
  brainstormScratch(async (options, document) => {
    const before = await readText(options.root, 'design/project.json');
    const f = scriptedRich({
      'Brainstorm': ['feature'], 'What is the name of the new feature?': ['Capture inbox'],
      'What problem does this feature solve': ['   ', 'Quickly capture and inspect ideas'],
      'Who will use or interact with it?': [' Member \n\n'], 'Which actors/entities or business objects are involved?': ['Capture'],
      'Main feature view title': ['Inbox'], 'Page title': ['Details', 'Scratch', undefined], 'Dialog title': ['Confirm discard'],
      'What does the user accomplish on ': ['Review captured ideas', 'Inspect', 'Confirm the discard', 'Temporary', 'Inspect a selected capture'],
      'Feature screens': ['page', 'modal', 'page', 'remove-3', 'edit-1', 'done'],
      // First pass, then the replacement pass after Back from acceptance.
      'Interactions on ': ['navigate', 'action', 'done', 'navigate', 'done', 'done', 'navigate', 'action', 'done', 'done', 'done'],
      'Where does the user go?': ['Details', 'Confirm discard', 'Details'],
      'Interaction label': ['Open details', undefined, 'Open details'],
      'Action label': ['Save capture', 'Save capture'],
      'What should happen when users choose "': ['Persist after validation', 'Persist after validation'],
      'How will you recognize the feature as useful and correct?': [BACK, 'A saved capture can be reopened'],
      'What should be prepared?': ['definition'], 'Continue to the reviewed file plan?': ['yes'], 'Apply this reviewed plan?': ['yes'],
    });
    const completion = await brainstormWizard(f.ui, options);
    assert.deepEqual(f.left(), [], 'every scripted answer was consumed');
    const expected = { schemaVersion: 1, name: 'Capture inbox', purpose: 'Quickly capture and inspect ideas', actors: ['Member'],
      entities: ['Capture'], pages: [
        { title: 'Inbox', purpose: 'Review captured ideas', kind: 'view', interactions: [
          { kind: 'navigate', label: 'Open details', target: 'Details' },
          { kind: 'action', label: 'Save capture', outcome: 'Persist after validation' }] },
        { title: 'Details', purpose: 'Inspect a selected capture', kind: 'page', interactions: [] },
        { title: 'Confirm discard', purpose: 'Confirm the discard', kind: 'modal', interactions: [] }],
      acceptance: ['A saved capture can be reopened'], output: 'definition', verification: 'none',
      projectId: document.project.id, baseSha256: hash(before) };
    assert.equal(completion, completionFor('capture-inbox', false));
    assert.deepEqual(f.rejected, [['What problem does this feature solve, and what is its purpose?', 'Enter a description.']]);
    assert.deepEqual(f.contexts.map(item => item.details[0]), ['1 / 8', '2 / 8', '3 / 8', '4 / 8', '5 / 8', '6 / 8', '5 / 8', '6 / 8', '7 / 8', '8 / 8']);
    assert.deepEqual([f.contexts[0].title, f.contexts[0].location, f.contexts[0].details[1]], ['New feature', 'Brainstorm / Feature', 'Capture project']);
    assert.equal(f.reviews[0].title, 'Review feature brainstorm');
    assert.equal(f.reviews[0].sections[0].body, JSON.stringify(expected, null, 2));
    assert.deepEqual(f.reviews.map(item => item.title), ['Review feature brainstorm', 'Review before writing']);
    assert.ok(!f.events.some(event => String(event[1]).startsWith('After generation')), 'definitions offer no execution');
    const screens = f.events.filter(event => event[1] === 'Feature screens').map(event => event[2]);
    assert.deepEqual(screens[0], ['done', 'page', 'modal', 'edit-0'], 'the feature view cannot be removed');
    assert.deepEqual(screens[4], ['done', 'page', 'modal', 'edit-0', 'edit-1', 'edit-2', 'remove-1', 'remove-2']);
    assert.equal((await readScratchJson(options.root, 'brainstorms/capture-inbox/feature.definition.json')).feature.pages.length, 3);
    assert.deepEqual((await readScratchJson(options.root, 'brainstorms/capture-inbox/feature.definition.json')).feature, expected);
    assert.deepEqual(f.writes, ['Files saved. Dependencies and builds were not run.\n', completion]);
    assert.equal(await readText(options.root, 'design/project.json'), before, 'no implicit import');
    const agent = await brainstormFeaturePlan(expected, options);
    assert.ok(agent.plan.changes.every(change => change.status === 'unchanged'), 'human and agent requests are byte-identical');
  }));

test('project mode, early Back, declined reviews and a missing project write nothing', async () => brainstormScratch(async options => {
  const run = async answers => { const f = scriptedRich(answers); const result = await brainstormWizard(f.ui, options); assert.deepEqual(f.left(), []); return { f, result }; };
  const project = await run({ 'Brainstorm': ['project'] });
  assert.deepEqual([project.result, project.f.output()], [undefined,
    'Project brainstorming is not implemented by this increment. Use New project for the current preset/prototype flow.\n']);
  const early = await run({ 'Brainstorm': ['feature'], 'What is the name of the new feature?': [BACK] });
  assert.deepEqual([early.result, early.f.output()], [undefined, 'Brainstorm cancelled. No additional files were written.\n']);
  const request = await run(quickNote({ 'Continue to the reviewed file plan?': ['no'], 'Apply this reviewed plan?': [] }));
  assert.equal(request.f.output(), 'Brainstorm cancelled. No additional files were written.\n');
  const plan = await run(quickNote({ 'Apply this reviewed plan?': ['no'] }));
  assert.deepEqual([plan.result, plan.f.output()], [undefined, '']);
  assert.deepEqual((await readdir(options.root)).sort(), ['design']);
  await brainstormScratch(async missing => {
    const f = scriptedRich({ 'Brainstorm': ['feature'] });
    assert.equal(await brainstormWizard(f.ui, missing), undefined);
    assert.equal(f.output(), '\nBRAINSTORM_PROJECT_REQUIRED: Save an existing project before brainstorming a feature; project brainstorming is planned separately.\n');
    assert.deepEqual(await readdir(missing.root), []);
  }, { project: false });
}));

test('an optional import is a separate reviewed plan and a declined import keeps the project unchanged', async () =>
  brainstormScratch(async options => {
    const offered = { ...options, offerImport: true };
    const f = scriptedRich(quickNote({ 'Review importing this feature into the current project now?': ['yes'],
      'Apply this independently reviewed feature import?': ['yes'] }));
    assert.equal(await brainstormWizard(f.ui, offered), completionFor('quick-note', true));
    assert.deepEqual(f.left(), []);
    const importReview = f.reviews.find(item => item.title === 'Review feature import');
    assert.match(importReview.sections[0].body, /^Plan hash: [a-f0-9]{64}\n\nupdate +design\/project\.json\n/);
    assert.equal(JSON.parse(importReview.sections[1].body).mode, 'feature');
    assert.ok(f.events.some(event => event[0] === 'busy' && event[1] === 'Importing the reviewed additive feature concept.'));
    assert.ok(f.writes.includes('Feature imported into the canonical project.\n'));
    const imported = await readScratchJson(options.root, 'design/project.json');
    assert.deepEqual(imported.design.features.items.map(item => item.id), ['quick-note']);
    const after = await readText(options.root, 'design/project.json');
    const declined = scriptedRich(quickNote({ 'What is the name of the new feature?': ['Second note'],
      'Review importing this feature into the current project now?': ['yes'], 'Apply this independently reviewed feature import?': ['no'] }));
    assert.equal(await brainstormWizard(declined.ui, offered), completionFor('second-note', false));
    assert.equal(await readText(options.root, 'design/project.json'), after);
    assert.ok(!declined.writes.some(text => text.startsWith('Feature imported')));
    const skipped = scriptedRich(quickNote({ 'What is the name of the new feature?': ['Third note'],
      'Review importing this feature into the current project now?': ['no'] }));
    assert.equal(await brainstormWizard(skipped.ui, offered), completionFor('third-note', false));
    assert.ok(!skipped.reviews.some(item => item.title === 'Review feature import'));
    assert.equal(await readText(options.root, 'design/project.json'), after);
  }, { configured: true }));
