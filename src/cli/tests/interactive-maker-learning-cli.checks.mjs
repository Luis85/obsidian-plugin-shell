import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { main } from '../app.ts';
import { learningCommand } from '../adapters/learning-command.ts';
import { contactForm, greetWizard, learningPath, project, put, scratch, step } from './support/interactive-maker-learning-fixture.mjs';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
/** The real CLI entry with captured streams; machine output is one JSON document. */
async function run(root, ...argv) {
  const output = new PassThrough(), error = new PassThrough(), chunks = [], errors = [];
  output.on('data', chunk => chunks.push(chunk)); error.on('data', chunk => errors.push(chunk));
  const code = await main([...argv, '--root', root], frameworkRoot, { input: Readable.from([]), output, error, env: {} });
  const text = Buffer.concat(chunks).toString('utf8');
  return { code, text, stderr: Buffer.concat(errors).toString('utf8'), json: argv.includes('--json') ? JSON.parse(text) : undefined };
}
const complete = (root, name, stepId, ...rest) => run(root, 'learn', 'complete-step', '--name', name, '--step', stepId, ...rest, '--json');

test('learn lists, shows and checks the shipped learning paths for agents', async () => scratch(async root => {
  const listed = await run(root, 'learn', 'list', '--json');
  assert.equal(listed.code, 0);
  assert.deepEqual([listed.json.data.status, listed.json.data.issues ?? []], ['ok', []]);
  assert.deepEqual(listed.json.data.paths.map(item => [item.id, item.steps, item.progress.started]),
    [['author-a-learning-path', 3, false], ['author-a-wizard', 6, false], ['idea-to-prototype-with-claude-design', 11, false]]);
  const checked = await run(root, 'learn', 'check', '--json');
  assert.deepEqual([checked.json.data.paths, checked.json.data.issues, checked.json.data.status], [3, [], 'ok']);
  const shown = await run(root, 'learn', 'show', '--name', 'author-a-wizard', '--json');
  assert.equal(shown.json.data.definition.steps[0].id, 'read-the-guide');
  assert.deepEqual([...new Set(shown.json.data.steps[0].docs.map(link => link.file))], ['docs/development/WIZARDS-AND-FORMS.md', 'docs/development/LEARNING-PATHS.md']);
  assert.match(shown.json.data.steps[0].markdown, /# Wizards are data/);
  const unknown = await run(root, 'learn', 'show', '--name', 'nope', '--json');
  assert.deepEqual([unknown.code, unknown.json.diagnostics[0].code], [1, 'LEARNING_UNKNOWN']);
  const usage = await run(root, 'learn', 'teach', '--json');
  assert.match(usage.json.diagnostics[0].message, /learn list, learn show --name <id>/);
  const help = await run(root, 'help', 'learn');
  assert.match(help.text, /node bin\/app learn complete-step --name <id> --step <step>/);
  const plain = await run(root, 'learn');
  assert.equal(plain.code, 1, 'without a terminal, learn needs an action');
  assert.match(plain.stderr, /LEARNING_COMMAND/);
}));

test('agents complete the author-a-wizard path step by step through reviewed, reproducible plans', async () => scratch(async root => {
  const file = join(root, '.workbench/learning/author-a-wizard.json'), name = 'author-a-wizard';
  const blocked = await complete(root, name, 'read-the-guide');
  assert.equal(blocked.json.status, 'blocked');
  assert.match(blocked.json.data.unmet[0].detail, /Still open: I read "Run, inspect and check"/);
  await put(root, 'read.json', { schemaVersion: 1, checklist: ['commands', 'add'] });
  const planned = await complete(root, name, 'read-the-guide', '--input', 'read.json');
  assert.equal(planned.json.status, 'planned');
  await assert.rejects(() => readFile(file), /ENOENT/);
  const applied = await complete(root, name, 'read-the-guide', '--input', 'read.json', '--apply', planned.json.data.planHash);
  assert.equal(applied.json.status, 'applied', applied.text);
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.currentStep, 'plan-your-wizard');
  assert.match(saved.completed['read-the-guide'], /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  assert.equal((await complete(root, name, 'run-your-wizard')).json.diagnostics[0].code, 'LEARNING_ORDER');
  await put(root, 'plan.json', { schemaVersion: 1, answers: { formId: 'contact', wizardId: 'greet' } });
  const invalid = await complete(root, name, 'plan-your-wizard', '--input', 'plan.json');
  assert.deepEqual([invalid.json.diagnostics[0].code, /purpose: .* is required/.test(invalid.json.diagnostics[0].message)], ['LEARNING_ANSWERS', true]);
  await put(root, 'plan.json', { schemaVersion: 1, answers: { purpose: 'Greet a contact', formId: 'contact', wizardId: 'greet' }, completedAt: '2026-10-04T12:30:00.000Z' });
  const plan = await complete(root, name, 'plan-your-wizard', '--input', 'plan.json');
  assert.equal((await complete(root, name, 'plan-your-wizard', '--input', 'plan.json', '--apply', plan.json.data.planHash)).json.status, 'applied');
  assert.equal(JSON.parse(await readFile(file, 'utf8')).completed['plan-your-wizard'], '2026-10-04T12:30:00.000Z');
  const missing = await complete(root, name, 'define-a-form');
  assert.deepEqual(missing.json.data.unmet.map(check => check.detail), ['configs/forms/contact.json does not exist yet.', 'configs/forms/contact.json does not exist yet.']);
  await project(root, { forms: { contact: contactForm } });
  const formPlan = await complete(root, name, 'define-a-form');
  assert.equal((await complete(root, name, 'define-a-form', '--apply', formPlan.json.data.planHash)).json.status, 'applied');
  await put(root, 'configs/wizards/greet.json', { ...greetWizard, steps: [{ id: 'ask', kind: 'form', form: 'missing', bind: 'person' }] });
  const wizardPlan = await complete(root, name, 'define-the-wizard');
  assert.equal(wizardPlan.json.status, 'blocked', 'the wizard does not reference contact yet');
  await project(root, { wizards: { greet: { ...greetWizard, steps: [...greetWizard.steps.slice(0, 2), { id: 'ask-again', kind: 'form', form: 'missing', bind: 'x' }, greetWizard.steps[2]] } } });
  const definedPlan = await complete(root, name, 'define-the-wizard');
  assert.equal((await complete(root, name, 'define-the-wizard', '--apply', definedPlan.json.data.planHash)).json.status, 'applied');
  const failing = await complete(root, name, 'check-the-catalog');
  assert.match(failing.json.data.unmet[0].detail, /wizard greet.ask-again: unknown form missing/);
  await project(root, { wizards: { greet: greetWizard } });
  const checkPlan = await complete(root, name, 'check-the-catalog');
  assert.equal((await complete(root, name, 'check-the-catalog', '--apply', checkPlan.json.data.planHash)).json.status, 'applied');
  const last = await complete(root, name, 'run-your-wizard');
  assert.deepEqual([last.json.status, last.json.data.unmet[0].label], ['blocked', 'Wizard greet was run to its end from this step']);
  const status = await run(root, 'learn', 'status', '--name', name, '--json');
  assert.deepEqual(status.json.data.steps.map(item => [item.id, Boolean(item.completedAt), item.open, item.current]), [
    ['read-the-guide', true, true, false], ['plan-your-wizard', true, true, false], ['define-a-form', true, true, false],
    ['define-the-wizard', true, true, false], ['check-the-catalog', true, true, false], ['run-your-wizard', false, true, true]]);
  assert.deepEqual(status.json.data.progress.answers.plan, { purpose: 'Greet a contact', formId: 'contact', wizardId: 'greet' });
  const listed = await run(root, 'learn', 'list', '--json');
  assert.deepEqual(listed.json.data.paths[1].progress, { totalSteps: 6, completedSteps: 5, currentStep: 'run-your-wizard', finished: false, started: true });
  const restart = await run(root, 'learn', 'restart', '--name', name, '--json');
  assert.equal(restart.json.status, 'planned');
  assert.equal((await run(root, 'learn', 'restart', '--name', name, '--apply', restart.json.data.planHash, '--json')).json.status, 'applied');
  await assert.rejects(() => readFile(file), /ENOENT/);
  assert.equal((await run(root, 'learn', 'status', '--name', name, '--json')).json.data.progress, null);
}));

test('corrupt progress is reported, preserved and only removed by an explicit restart', async () => scratch(async root => {
  const file = join(root, '.workbench/learning/author-a-wizard.json');
  await put(root, '.workbench/learning/author-a-wizard.json', '{ not json');
  const status = await run(root, 'learn', 'status', '--name', 'author-a-wizard', '--json');
  assert.deepEqual([status.code, status.json.diagnostics[0].code], [1, 'LEARNING_PROGRESS']);
  assert.match(status.json.diagnostics[0].message, /left unchanged/);
  assert.deepEqual((await run(root, 'learn', 'list', '--json')).json.data.paths[1].progress, { error: 'LEARNING_PROGRESS' });
  assert.equal((await complete(root, 'author-a-wizard', 'read-the-guide')).json.diagnostics[0].code, 'LEARNING_PROGRESS');
  assert.equal(await readFile(file, 'utf8'), '{ not json');
  const restart = await run(root, 'learn', 'restart', '--name', 'author-a-wizard', '--json');
  assert.equal((await run(root, 'learn', 'restart', '--name', 'author-a-wizard', '--apply', restart.json.data.planHash, '--json')).json.status, 'applied');
}));

test('a catalog with reference issues is listed with its issues and refuses step completion', async () => scratch(async root => {
  const configs = await project(root, { paths: { broken: learningPath('broken', [step('a', { form: 'ghost', bind: 'x' })]), fine: learningPath('fine', [step('a')]) } });
  const context = { root, frameworkRoot };
  const listed = await learningCommand({ command: 'learn', action: 'list', flags: {} }, context, configs);
  assert.deepEqual([listed.status, listed.issues], ['failed', ['path broken.a: unknown form ghost.']]);
  const checked = await learningCommand({ command: 'learn', action: 'check', flags: {} }, context, configs);
  assert.deepEqual([checked.status, checked.paths, checked.root], ['failed', 2, join(configs, 'learning')]);
  await assert.rejects(() => learningCommand({ command: 'learn', action: 'complete-step', flags: { name: 'fine', step: 'a' } }, context, configs), /unknown form ghost/);
  await writeFile(join(configs, 'learning/paths/broken.json'), JSON.stringify(learningPath('broken', [step('a')])));
  const done = await learningCommand({ command: 'learn', action: 'complete-step', flags: { name: 'fine', step: 'a' } }, context, configs);
  assert.deepEqual([done.status, done.checks, done.step], ['planned', [], 'a']);
  await assert.rejects(() => learningCommand({ command: 'learn', action: 'complete-step', flags: { name: 'fine', step: 'zz' } }, context, configs), /Unknown step zz/);
}));
