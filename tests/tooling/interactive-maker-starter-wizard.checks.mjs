import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { fieldAnswer, readForm } from '../../bin/domain/form.ts';
import { formValueIssues } from '../../bin/domain/form-values.ts';
import { starterInputForm } from '../../bin/presentation/wizards/starter-inputs.ts';
import { startWizard } from '../../bin/presentation/wizards/registry.ts';
import { guidedStarter } from '../../bin/presentation/terminal/starter-terminal.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const webapp = JSON.parse(await readFile(join(frameworkRoot, 'configs/starters/webapp.json'), 'utf8'));
const inputs = [
  { id: 'id', label: 'Project ID', type: 'string', required: true },
  { id: 'name', label: 'Project name', type: 'string', required: true, default: 'Ignored' },
  { id: 'count', label: 'Count', type: 'integer', required: true, default: 3 },
  { id: 'limit', label: 'Limit', type: 'integer', required: false },
  { id: 'enabled', label: 'Enabled', type: 'boolean', required: false, default: true },
  { id: 'tone', label: 'Tone', type: 'string', required: false, choices: ['calm', 'bold'] },
  { id: 'size', label: 'Size', type: 'integer', required: true, choices: [10, 20], default: 20 },
  { id: 'note', label: 'N'.repeat(350), type: 'string', required: false },
  { id: 'description', label: 'Description', type: 'string', required: false, default: '{{name}} keeps braces' },
];
const typed = { ...webapp, id: 'typed', name: 'Typed inputs', inputs };
function scripted(answers) {
  const asked = [], written = [];
  return { asked, written, prompt: async question => { asked.push(question); return answers.shift() ?? ''; }, write: text => { written.push(text); } };
}
async function withStarters(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'starter-wizard-')));
  try {
    await mkdir(join(root, 'configs/starters'), { recursive: true });
    for (const definition of [typed, webapp]) await writeFile(join(root, `configs/starters/${definition.id}.json`), JSON.stringify(definition));
    await check({ root, frameworkRoot: root });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const request = (args = [], options = {}) => ({ command: 'new', args, options });
const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code; } };

test('starter inputs map to a validated form: text, whole number, Yes/No and select with literal defaults seeded', () => {
  const plan = starterInputForm(typed, '/work/shiny-app', {});
  const fields = Object.fromEntries(plan.form.fields.map(field => [field.id, field]));
  assert.deepEqual(plan.form.fields.map(field => [field.id, field.kind]), [['id', 'text'], ['name', 'text'], ['count', 'number'], ['limit', 'number'],
    ['enabled', 'boolean'], ['tone', 'select'], ['size', 'select'], ['note', 'text'], ['description', 'text']]);
  assert.deepEqual([fields.id.required, fields.id.maxLength, fields.note.required], [true, 4000, false]);
  assert.deepEqual([fields.count.integer, fields.count.required, fields.limit.required], [true, undefined, false]);
  assert.equal(fields.name.default, '{{suggestedName}}');
  assert.deepEqual(fields.tone.choices, [{ id: 'calm', label: 'calm' }, { id: 'bold', label: 'bold' }, { id: 'skip', label: 'Skip (no value)' }]);
  assert.deepEqual(fields.size.choices.map(choice => choice.id), ['10', '20']);
  assert.equal(fields.note.label.length, 300);
  // Literal defaults sit in the edited value, so starter placeholders such as {{name}} are never rendered as templates.
  assert.deepEqual(plan.value, { id: 'shiny-app', count: 3, enabled: true, tone: 'skip', size: '20', description: '{{name}} keeps braces' });
  assert.deepEqual(readForm(structuredClone(plan.form)).fields.length, 9);
});

test('decoding returns typed starter values, leaves skipped optional inputs absent and still applies inputValue', () => {
  const plan = starterInputForm(typed, '/work/shiny-app', {});
  const answers = { ...plan.value, name: 'Shiny', limit: undefined, note: '', tone: 'bold', size: '10', enabled: false };
  assert.deepEqual(plan.decode(answers), { id: 'shiny-app', name: 'Shiny', count: 3, enabled: false, tone: 'bold', size: 10, description: '{{name}} keeps braces' });
  assert.equal(plan.decode({ ...answers, tone: 'skip' }).tone, undefined);
  assert.throws(() => plan.decode({ ...answers, tone: 'loud' }), error => error.code === 'STARTER_INPUT');
  assert.throws(() => plan.decode({ ...answers, name: 'tab\there' }), error => error.code === 'STARTER_INPUT');
  const awkward = { ...typed, inputs: [inputs[0], inputs[1], { id: 'mode', label: 'Mode', type: 'string', required: true, choices: ['skip', ' padded'] }] };
  const positional = starterInputForm(awkward, '/work/app', {});
  assert.deepEqual(positional.form.fields[2].choices, [{ id: 'choice-1', label: 'skip' }, { id: 'choice-2', label: ' padded' }]);
  assert.equal(positional.decode({ ...positional.value, name: 'App', mode: 'choice-2' }).mode, ' padded');
});

test('supplied values are never asked, and a fully supplied starter needs no form', () => {
  const plan = starterInputForm(typed, '/work/app', { id: 'given', name: 'Given', count: 1 });
  assert.equal(plan.form.fields.some(field => ['id', 'name', 'count'].includes(field.id)), false);
  assert.deepEqual(plan.decode(plan.value).id, undefined);
  const full = starterInputForm(webapp, '/work/app', { id: 'a-app', name: 'A', description: 'x' });
  assert.equal(full.form, undefined); assert.deepEqual(full.decode(full.value), {});
});

test('an optional number may be left blank only when required is false', () => {
  const form = readForm({ schemaVersion: 1, id: 'numbers', version: 1, title: 'Numbers', fields: [
    { id: 'limit', kind: 'number', label: 'Limit', integer: true, required: false }, { id: 'count', kind: 'number', label: 'Count' }] });
  assert.equal(fieldAnswer(form.fields[0], undefined), undefined);
  assert.throws(() => fieldAnswer(form.fields[1], undefined), /Count: enter a number/);
  assert.throws(() => fieldAnswer(form.fields[0], 1.5), /whole number/);
  assert.deepEqual(formValueIssues(form, { count: 2 }, () => undefined), []);
});

test('the name default follows the typed id, and blank optional inputs stay out of the answers', () => withStarters(async context => {
  const fresh = scripted(['shiny-app', '', '', '', '', '', '', '', '']);
  const result = await guidedStarter(request(['target'], { starter: 'typed' }), context, fresh.prompt, fresh.write);
  assert.ok(fresh.asked.includes('Project name [Shiny App]: '), fresh.asked.join('|'));
  assert.ok(fresh.asked.includes('Limit: '));
  assert.deepEqual(JSON.parse(result.options.answers), { id: 'shiny-app', name: 'Shiny App', count: 3, enabled: true, size: 20, description: '{{name}} keeps braces' });
  assert.equal('values' in result.options, false); assert.deepEqual(result.args, ['target']);
}));

test('back returns to the starter choice, a different starter forgets earlier answers, and back at the start cancels', () => withStarters(async context => {
  const ui = scripted(['typed', 'first-id', ':back', ':back', 'webapp', '', 'Web', '']);
  const result = await guidedStarter(request(['target']), context, ui.prompt, ui.write);
  assert.equal(result.options.starter, 'webapp');
  assert.deepEqual(JSON.parse(result.options.answers), { id: 'target', name: 'Web', description: 'My application' });
  const cancelled = scripted([':back']);
  assert.equal(await code(guidedStarter(request(), context, cancelled.prompt, cancelled.write)), 'CANCELLED');
  const standalone = scripted([]);
  assert.equal(await code(startWizard({ ask: standalone.prompt, write: standalone.write }, 'new-starter', context)), 'WIZARD_OPTIONS');
}));

test('companion questions can be revisited without losing input answers or keeping a stale opt-in', async () => {
  const context = { root: frameworkRoot, frameworkRoot };
  // Back from the extension returns to the hosting question, then the Airship question, and back again to the starter inputs.
  const ui = scripted(['Own description', '', '', '', '', 'y', '', ':back', ':back', ':back', '', '', '', '', '', 'n', '', 'note']);
  const result = await guidedStarter(request(['target'], { starter: 'custom-file-view', id: 'folio-app', name: 'Folio App', author: 'Team' }), context, ui.prompt, ui.write);
  assert.ok(ui.asked.includes('Description [Own description]: '), 'the revisited form shows the previous answer');
  assert.equal(result.options.airship, undefined); assert.equal(result.options.extension, 'note');
  assert.equal(JSON.parse(result.options.answers).description, 'Own description');
  assert.equal(ui.asked.filter(question => question.startsWith('Enable optional Airship tooling? No install or launch (y/N)')).length, 3);
  assert.equal(ui.asked.filter(question => question.startsWith('Hosting platform for pull requests and CI')).length, 3); assert.equal(result.options.hosting, undefined);
});
