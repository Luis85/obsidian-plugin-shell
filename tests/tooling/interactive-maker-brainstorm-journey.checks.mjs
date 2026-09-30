import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { PassThrough, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { hash } from '../../scripts/framework/files.ts';
import { main } from '../../bin/shell.ts';
import { brainstormWizard } from '../../bin/presentation/brainstorm.ts';
import { brainstormFeaturePlan } from '../../bin/adapters/brainstorm.ts';
import { terminalFixture } from './interactive-maker-tui-fixture.mjs';
import { brainstormScratch, frameworkRoot, scriptedPlain, readText, readJson } from './interactive-maker-brainstorm-fixture.mjs';

async function respond(f, current, keys, next) {
  await f.until(current); const from = f.chunks.length; f.send(keys);
  if (next) await f.until(next, from);
}
const quickNote = (document, baseSha256, extra = {}) => ({ schemaVersion: 1, name: 'Quick note', purpose: 'Capture a note',
  actors: [], entities: [], pages: [{ title: 'Notes', purpose: 'Write notes', kind: 'view', interactions: [] }],
  acceptance: [], output: 'definition', verification: 'none', projectId: document.project.id, baseSha256, ...extra });

test('real keyboard terminal brainstorm reaches the reviewed package, with Escape returning one section', async () =>
  brainstormScratch(async (options, document) => {
    const before = await readText(options.root, 'design/project.json');
    const f = terminalFixture(); f.session.start();
    try {
      const task = brainstormWizard(f.ui, options);
      await respond(f, 'Brainstorm a new feature', '\r', 'What is the name of the new feature?');
      await respond(f, 'What is the name of the new feature?', 'Quick note\r', 'What problem does this feature solve');
      await respond(f, 'What problem does this feature solve', 'Capture a note\r', 'Who will use or interact with it?');
      await respond(f, 'Who will use or interact with it?', '\r', 'Which actors/entities');
      await respond(f, 'Which actors/entities', '\r', 'Main feature view title');
      await respond(f, 'Main feature view title', 'Notes\r', 'What does the user accomplish on Notes?');
      await respond(f, 'What does the user accomplish on Notes?', 'Write notes\r', 'Feature screens');
      await respond(f, 'Feature screens', '\r', 'Interactions on Notes');
      await respond(f, 'Interactions on Notes', '\r', 'How will you recognize');
      await respond(f, 'How will you recognize', '\x1b', 'Interactions on Notes');
      await respond(f, 'Interactions on Notes', '\r', 'How will you recognize');
      await respond(f, 'How will you recognize', '\r', 'What should be prepared?');
      await respond(f, 'What should be prepared?', '\r', 'Review feature brainstorm');
      await respond(f, 'Review feature brainstorm', '\r', 'Continue to the reviewed file plan?');
      await respond(f, 'Continue to the reviewed file plan?', '\x1b[B\r', 'Review before writing');
      await respond(f, 'Review before writing', '\r', 'Apply this reviewed plan?');
      await respond(f, 'Apply this reviewed plan?', '\x1b[B\r');
      const completion = await task;
      assert.match(completion, /^Brainstorm saved to brainstorms\/quick-note\. /);
      const expected = quickNote(document, hash(before));
      assert.deepEqual((await readJson(options.root, 'brainstorms/quick-note/feature.definition.json')).feature, expected);
      assert.ok((await brainstormFeaturePlan(expected, options)).plan.changes.every(change => change.status === 'unchanged'));
      assert.equal(await readText(options.root, 'design/project.json'), before);
    } finally { f.close(); }
  }));

test('line mode keeps previous answers across :back and reports an unconfigured import without changing the project', async () =>
  brainstormScratch(async (options, document) => {
    const before = await readText(options.root, 'design/project.json');
    const f = scriptedPlain(['', 'Quick note', 'Capture a note', 'Member; Reviewer ;', '', 'Notes', 'Write notes', 'x', ':back',
      '', '', 'Notes', 'Write notes', '1', '2', 'Save note', 'Note persisted', '', 'Note is saved', '', 'maybe', 'yes', 'y', 'y']);
    assert.equal(await brainstormWizard(f.ui, { ...options, offerImport: true }), undefined);
    assert.equal(f.left(), 0);
    assert.equal(f.questions[9], 'Who will use or interact with it? (semicolon separated; empty is allowed) [Member; Reviewer]: ',
      'Back returns to the previous section with its answers as defaults');
    assert.deepEqual(f.questions.slice(-4), ['Continue to the reviewed file plan? (y/N): ', 'Continue to the reviewed file plan? (y/N): ',
      'Apply this reviewed plan? (y/N): ', 'Review importing this feature into the current project now? (y/N): ']);
    const expected = quickNote(document, hash(before), { actors: ['Member', 'Reviewer'], acceptance: ['Note is saved'],
      pages: [{ title: 'Notes', purpose: 'Write notes', kind: 'view', interactions: [{ kind: 'action', label: 'Save note', outcome: 'Note persisted' }] }] });
    const output = f.output();
    assert.ok(output.includes('\nFeature brainstorm\n' + JSON.stringify(expected, null, 2) + '\n'));
    assert.ok(output.includes('Choose one of the displayed options, or enter :back.\n'));
    assert.ok(output.includes('Enter yes or no.\n'));
    assert.match(output, /\nReview 4 file changes\nPlan hash: [a-f0-9]{64}\ncreate {5}brainstorms\/quick-note\/feature\.definition\.json\n/);
    assert.ok(output.endsWith('Files saved. Dependencies and builds were not run.\n' +
      '\nPreserve edited or foreign design file: design/project.json. Export/reconcile it before importing.\n'));
    assert.deepEqual((await readJson(options.root, 'brainstorms/quick-note/feature.definition.json')).feature, expected);
    assert.equal(await readText(options.root, 'design/project.json'), before, 'a failed import writes nothing');
    assert.ok(!(await readdir(options.root)).includes('.framework'));
  }));

test('the shell command starts the plain brainstorm wizard and project mode writes nothing', async () =>
  brainstormScratch(async options => {
    const input = new PassThrough(); input.isTTY = true; let transcript = '', answered = false; const stdout = [];
    const error = new Writable({ write(chunk, _encoding, done) {
      transcript += chunk;
      if (String(chunk).includes('Choose number or ID') && !answered) { answered = true; queueMicrotask(() => input.write('2\n')); }
      done();
    } }); error.isTTY = true;
    const code = await main(['brainstorm', '--ui', 'plain', '--root', options.root], frameworkRoot, { input,
      output: new Writable({ write(chunk, _encoding, done) { stdout.push(String(chunk)); done(); } }), error, env: {} });
    input.destroy();
    assert.equal(code, 0);
    assert.match(transcript, /Brainstorm\n {2}1\. Brainstorm a new feature\n {2}2\. Brainstorm a new project — planned next\n/);
    assert.match(transcript, /Project brainstorming is not implemented by this increment\./);
    assert.deepEqual(stdout, []);
    assert.deepEqual(await readdir(options.root), ['design']);
  }));
