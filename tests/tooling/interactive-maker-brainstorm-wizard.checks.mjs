import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { brainstormWizard } from '../../bin/presentation/brainstorm.ts';
import { hash } from '../../scripts/framework/files.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');

async function scratch(fn, { project = true } = {}) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-brainstorm-wizard-'));
  try {
    await mkdir(join(root, 'design'));
    if (project) {
      // A project created through the framework carries its intake receipt; concept import only replaces receipted files.
      const text = documentText(newDocument('Capture project'));
      await writeFile(join(root, 'design/project.json'), text);
      await mkdir(join(root, '.framework'));
      await writeFile(join(root, '.framework/intake.json'), JSON.stringify({ schemaVersion: 1, files: { 'design/project.json': hash(text) } }));
    }
    await fn({ root, frameworkRoot, project: 'design/project.json', input: Readable.from([]), offerImport: true });
  } finally { await rm(root, { recursive: true, force: true }); }
}
/** Line-mode terminal: every question consumes the next scripted answer; running out is a test failure. */
function lineUi(answers) {
  const output = [], questions = [];
  return { output, questions, ui: {
    ask: async question => {
      questions.push(question);
      assert.ok(answers.length, 'Unexpected question: ' + question);
      return answers.shift();
    },
    write: text => { output.push(text); },
  } };
}
/** Rich prompts answer by title so the script reads as the conversation the wizard holds. */
function richUi(script) {
  const output = [], reviews = [], contexts = [], busy = [];
  const next = (title, fallback) => {
    const entry = script.find(([pattern]) => pattern.test(title));
    assert.ok(entry, 'Unexpected rich prompt: ' + title);
    const value = Array.isArray(entry[1]) ? entry[1].shift() : entry[1];
    return value ?? fallback;
  };
  return { output, reviews, contexts, busy, ui: {
    write: text => { output.push(text); },
    ask: async question => assert.fail('Rich mode must not fall back to line input: ' + question),
    rich: {
      text: async request => {
        const value = next(request.title, request.initial);
        if (request.validate) assert.equal(request.validate(value), undefined, request.title);
        return value;
      },
      select: async (title, items, initial) => {
        const value = next(title, initial);
        assert.ok(items.some(item => item.id === value), title + ' offers ' + value);
        return value;
      },
      multi: async () => assert.fail('Brainstorm has no multi-select'),
      review: async (title, sections) => { reviews.push({ title, sections }); },
      context: value => { contexts.push(value); },
      busy: label => { busy.push(label); },
    },
  } };
}

test('line-mode feature brainstorm edits screens, steps back, saves and imports only after separate approvals', async () => {
  await scratch(async options => {
    const { ui, output, questions } = lineUi([
      'feature',
      'Capture inbox', ':back', '', 'Quickly capture ideas',
      'Member; Editor', 'Capture',
      'Inbox', 'Review captured ideas',
      'zzz', 'page', 'Details', 'Inspect a capture',
      'modal', 'Confirm', 'Confirm deletion',
      'edit-1', '', 'Inspect one capture',
      'remove-2', 'done',
      'navigate', 'Details', '', 'action', 'Save capture', 'Persist after validation', 'done',
      'done',
      'A saved capture can be reopened',
      'definition',
      'maybe', 'y',
      'y',
      'y', 'y',
    ]);
    const before = await readFile(join(options.root, 'design/project.json'), 'utf8');
    const completion = await brainstormWizard(ui, options);
    assert.match(completion, /^Brainstorm saved to brainstorms\/capture-inbox\. Concept: .+ The feature is imported in the canonical project\. No source was generated\.\n$/);
    const text = output.join('');
    assert.match(text, /Choose one of the displayed options, or enter :back\./);
    assert.match(text, /Enter yes or no\./);
    assert.match(text, /"name": "Capture inbox"/);
    assert.match(text, /Feature import plan\nPlan hash: [a-f0-9]{64}/);
    assert.match(text, /Feature imported into the canonical project\./);
    assert.ok(questions.some(question => question.startsWith('Interaction label [Open Details]')));
    // The reviewed request is printed once in full before any file plan exists.
    const reviewed = text.slice(text.indexOf('\nFeature brainstorm\n') + 20);
    const definition = JSON.parse(reviewed.slice(0, reviewed.indexOf('\n}\n') + 2));
    const saved = JSON.parse(await readFile(join(options.root, 'brainstorms/capture-inbox/feature.definition.json'), 'utf8'));
    assert.deepEqual([saved.kind, saved.status, saved.execution], ['shell-feature-definition', 'draft', 'not-run']);
    assert.deepEqual(definition.actors, ['Member', 'Editor']);
    assert.deepEqual(definition.pages.map(page => [page.title, page.kind, page.purpose]),
      [['Inbox', 'view', 'Review captured ideas'], ['Details', 'page', 'Inspect one capture']]);
    assert.deepEqual(definition.pages[0].interactions, [
      { kind: 'navigate', label: 'Open Details', target: 'Details' },
      { kind: 'action', label: 'Save capture', outcome: 'Persist after validation' }]);
    assert.deepEqual(definition.pages[1].interactions, []);
    const after = await readFile(join(options.root, 'design/project.json'), 'utf8');
    assert.notEqual(after, before, 'the separately approved import changes the canonical project');
    const imported = JSON.parse(after);
    assert.equal(imported.kind, 'obsidian-companion-project');
    assert.deepEqual(imported.design.features.items.map(item => [item.id, item.name]), [['capture-inbox', 'Capture inbox']]);
  });
});

test('rich feature brainstorm reviews every plan and never starts generated-source processes without approval', async () => {
  await scratch(async options => {
    const { ui, reviews, contexts, busy, output } = richUi([
      [/^Brainstorm$/, 'feature'],
      [/name of the new feature/, 'Quick note'],
      [/problem does this feature solve/, 'Write a note quickly'],
      [/Who will use/, 'Member\n\nEditor'],
      [/actors\/entities/, ''],
      [/Main feature view title/, 'Notes'],
      [/accomplish on Notes/, 'Write and list notes'],
      [/^Feature screens$/, 'done'],
      [/^Interactions on Notes$/, ['action', 'done']],
      [/^Action label$/, 'Save note'],
      [/choose "Save note"/, 'Store the note'],
      [/useful and correct/, 'A note can be reopened'],
      [/What should be prepared/, 'prototype'],
      [/separately approved run/, 'test'],
      [/Continue to the reviewed file plan/, 'yes'],
      [/Apply this reviewed plan/, 'yes'],
      [/importing this feature/, 'no'],
      [/Run the reviewed install\/test plan/, 'no'],
    ]);
    const completion = await brainstormWizard(ui, { ...options, offerImport: true });
    assert.match(completion, /The canonical project was not changed; import remains a separate reviewed action\. Generated source is under brainstorms\/quick-note\/source\/\./);
    assert.deepEqual(reviews.map(item => item.title), ['Review feature brainstorm', 'Review before writing', 'Review generated-source execution']);
    const request = JSON.parse(reviews[0].sections[0].body);
    assert.deepEqual([request.actors, request.entities, request.output, request.verification], [['Member', 'Editor'], [], 'prototype', 'test']);
    assert.match(reviews[2].sections[0].body, /Execution plan hash: [a-f0-9]{64}/);
    assert.deepEqual(contexts.map(item => item.location), ['Brainstorm / Feature', 'Brainstorm / Purpose', 'Brainstorm / Actors and entities',
      'Brainstorm / Screens', 'Brainstorm / Interactions', 'Brainstorm / Acceptance', 'Brainstorm / Output', 'Brainstorm / Build and test']);
    assert.ok(busy.some(label => label.startsWith('Validating the feature')));
    assert.ok(!busy.some(label => label.startsWith('Running the separately approved')), 'declined or blocked plans start no process');
    assert.ok(existsSync(join(options.root, 'brainstorms/quick-note/source')));
    assert.doesNotMatch(output.join(''), /Generated-source verification completed/);
  });
});

test('project mode, early back, declined approvals and a missing project end without writes', async () => {
  await scratch(async options => {
    const project = lineUi(['project']);
    assert.equal(await brainstormWizard(project.ui, options), undefined);
    assert.match(project.output.join(''), /Project brainstorming is not implemented by this increment\./);

    const early = lineUi(['feature', ':back']);
    assert.equal(await brainstormWizard(early.ui, options), undefined);
    assert.match(early.output.join(''), /Brainstorm cancelled\. No additional files were written\./);

    const minimal = ['feature', 'Capture inbox', 'Capture ideas', '', '', 'Inbox', 'Review ideas', 'done', 'done', '', 'definition'];
    const declinedRequest = lineUi([...minimal, 'n']);
    assert.equal(await brainstormWizard(declinedRequest.ui, options), undefined);
    assert.match(declinedRequest.output.join(''), /Brainstorm cancelled\./);

    const declinedPlan = lineUi([...minimal, 'y', 'n']);
    assert.equal(await brainstormWizard(declinedPlan.ui, options), undefined);
    assert.match(declinedPlan.output.join(''), /Review \d+ file changes\nPlan hash: [a-f0-9]{64}/);
    assert.equal(existsSync(join(options.root, 'brainstorms')), false);
  });
  await scratch(async options => {
    const missing = lineUi(['feature']);
    assert.equal(await brainstormWizard(missing.ui, options), undefined);
    assert.match(missing.output.join(''), /BRAINSTORM_PROJECT_REQUIRED: Save an existing project before brainstorming a feature/);
  }, { project: false });
});
