import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable, PassThrough } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { Workspace } from '../../bin/application/workspace.ts';
import { outline } from '../../bin/application/summary.ts';
import { editPage } from '../../bin/presentation/page-editor.ts';
import { studio, prototypeWizard } from '../../bin/presentation/studio.ts';
import { interview } from '../../bin/presentation/guide.ts';
import { loadGuide } from '../../bin/adapters/prototype.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { Back } from '../../bin/presentation/prompts.ts';
import { main } from '../../bin/shell.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
function scripted(answers) {
  let cursor = 0; const transcript = [];
  return { transcript, ask: async prompt => { assert.ok(cursor < answers.length, `Missing answer for ${prompt}`); return answers[cursor++]; },
    write: line => transcript.push(line), done: () => assert.equal(cursor, answers.length) };
}
async function scratch(run) { const root = await mkdtemp(join(tmpdir(), 'maker-ui-')); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); } }
function guideAnswers(guide) {
  return guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => {
    if (field.id === 'title') return '';
    if (field.kind === 'confirm') return 'y';
    if (field.kind === 'select') return String(field.default);
    return '';
  });
}
test('real page guide creates, reuses, bulk-adds and edits components and interactions', async () => {
  const result = runOperations(newDocument('P'), [{ op: 'page.add', title: 'Home' }]);
  const workspace = new Workspace(result.document, null), page = result.created[0];
  const ui = scripted(['new', 'Card', 'bulk', 'Header; Footer', 'existing', '1,1', 'interaction', 'Go',
    'behavior', '1', 'navigate', '1', 'behavior', '1', 'set-state', 'error', 'behavior', '1', 'rename', 'Continue',
    'behavior', '1', 'todo', 'behavior', '1', 'remove', 'behavior', 'back',
    'element', '1', 'up', 'element', '1', 'down', 'element', '1', 'remove', 'element', 'back',
    'element', '1', 'back', 'layout', 'grid', 'layout', 'row', 'rename', 'Overview', 'undo', 'redo', 'back']);
  await editPage(ui, workspace, page); ui.done();
  const model = outline(workspace.document);
  assert.equal(model.pages[0].title, 'Overview'); assert.equal(model.components.length, 3);
  assert.equal(model.pages[0].interactions.length, 0);
  assert.ok(ui.transcript.some(line => line.includes('already at that end')));
});
test('workspace guides and agent commands share the persistence and compiler paths', async () => scratch(async root => {
  const guide = await loadGuide();
  const ui = scripted(['UI project', 'new', 'Home', 'new', 'Card', 'back', 'save', 'n', 'save', 'y',
    'library', 'new', 'Extra', 'library', '2', 'Renamed card', 'library', 'back', 'page', '1', 'back', 'page', 'back',
    'undo', 'redo', 'save', 'y', 'generate', 'code', 'clickdummy', 'n', 'prototype', ...guideAnswers(guide), 'prepared', 'n', 'exit']);
  const workspace = await studio(ui, { root, frameworkRoot, project: 'design/project.json' }); ui.done();
  assert.equal(workspace.dirty, false);
  const saved = JSON.parse(await readFile(join(root, 'design/project.json'), 'utf8'));
  assert.equal(saved.project.name, 'UI project'); assert.equal(saved.design.visualDesigns.components.length, 2);
  const context = { root, frameworkRoot, input: Readable.from([]) };
  const generated = await execute(parseArguments(['sketch', 'generate', '--out', 'code', '--kind', 'clickdummy']), context);
  assert.equal(generated.status, 'planned');
  assert.ok(generated.changes.some(item => item.path === 'code/design/project.json'));
  const discovered = await execute(parseArguments(['prototype', 'guide']), context);
  const validation = { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { title: 'P', approved: false } };
  const validated = await execute(parseArguments(['prototype', 'validate', '--input', '-']), { ...context, input: Readable.from([JSON.stringify(validation)]) });
  assert.equal(validated.ready, false); assert.equal(discovered.guide.id, guide.id);
  await assert.rejects(() => execute(parseArguments(['sketch', 'generate', '--kind', 'invalid']), context));
}));
test('prototype-only guide loads the saved baseline and writes a complete preparation package', async () => scratch(async root => {
  const ui = scripted(['P', 'new', 'Home', 'back', 'save', 'y', 'exit']);
  await studio(ui, { root, frameworkRoot, project: 'design/project.json' });
  const guide = await loadGuide(), wizard = scripted([...guideAnswers(guide), 'prepared', 'y']);
  await prototypeWizard(wizard, { root, frameworkRoot, project: 'design/project.json' }); wizard.done();
  const answers = JSON.parse(await readFile(join(root, 'prepared/prototype-answers.json'), 'utf8'));
  assert.deepEqual(answers.answers.pages, ['Home']);
  assert.ok((await readFile(join(root, 'prepared/execution-prompt.md'), 'utf8')).includes('Home'));
}));
test('guide cancellation, validation retries, dirty-exit refusal and absent pages keep state coherent', async () => scratch(async root => {
  const guide = await loadGuide();
  await assert.rejects(() => interview(scripted([':back']), guide), Back);
  const answers = guideAnswers(guide); answers[0] = 'P';
  const ui = scripted(['', ...answers]);
  const result = await interview(ui, guide); assert.equal(result.title, 'P'); ui.done();
  const session = scripted(['P', 'exit', 'n', ':back', 'exit', 'y']);
  await studio(session, { root, frameworkRoot, project: 'design/project.json' }); session.done();
  await editPage(scripted([]), new Workspace(newDocument('P'), null), 'missing');
}));
test('CLI human help, human failures and terminal cancellation do not pollute machine output', async () => scratch(async root => {
  const output = [], errors = [];
  const stdout = new Writable({ write(chunk, _encoding, done) { output.push(String(chunk)); done(); } });
  const stderr = new Writable({ write(chunk, _encoding, done) { errors.push(String(chunk)); done(); } });
  assert.equal(await main(['--help'], frameworkRoot, { input: Readable.from([]), output: stdout, error: stderr }), 0);
  assert.match(output.join(''), /make first/);
  assert.equal(await main(['sketch', '--input', '-', '--root', root], frameworkRoot, { input: Readable.from(['not-json']), output: stdout, error: stderr }), 1);
  assert.ok(errors.length > 0);
  const input = new PassThrough(); input.isTTY = true;
  const terminal = new Writable({ write(chunk, _encoding, done) {
    if (String(chunk).includes('Project title: ')) queueMicrotask(() => input.write(':back\n'));
    done();
  } }); terminal.isTTY = true;
  assert.equal(await main(['studio', '--root', root], frameworkRoot, { input, output: stdout, error: terminal }), 130);
  input.destroy();
}));
