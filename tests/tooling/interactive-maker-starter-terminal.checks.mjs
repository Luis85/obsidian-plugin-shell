import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { guidedStarter } from '../../bin/presentation/terminal/starter-terminal.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const webapp = JSON.parse(await readFile(join(frameworkRoot, 'configs/starters/webapp.json'), 'utf8'));
/** A data-only starter whose inputs exercise every prompt type: defaults, choices, booleans, integers and optional text. */
const typed = { ...webapp, id: 'typed', name: 'Typed inputs', inputs: [
  { id: 'id', label: 'Project ID', type: 'string', required: true },
  { id: 'name', label: 'Project name', type: 'string', required: true },
  { id: 'count', label: 'Count', type: 'integer', required: true, default: 3 },
  { id: 'enabled', label: 'Enabled', type: 'boolean', required: false },
  { id: 'tone', label: 'Tone', type: 'string', required: false, choices: ['calm', 'bold'] },
  { id: 'note', label: 'Note', type: 'string', required: false },
  { id: 'description', label: 'Description', type: 'string', required: false, default: 'Typed' },
] };
async function withStarters(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'starter-terminal-')));
  try {
    await mkdir(join(root, 'configs/starters'), { recursive: true });
    await writeFile(join(root, 'configs/starters/typed.json'), JSON.stringify(typed));
    await writeFile(join(root, 'configs/starters/webapp.json'), JSON.stringify(webapp));
    await check({ root, frameworkRoot: root });
  } finally { await rm(root, { recursive: true, force: true }); }
}
function scripted(answers) {
  const asked = [], written = [];
  return { asked, written, prompt: async question => { asked.push(question); return answers.shift() ?? ''; }, write: text => { written.push(text); } };
}
const request = (args = [], options = {}) => ({ command: 'new', args, options });
const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code; } };

test('the target directory is asked for, required and passed through for --from imports', () => withStarters(async context => {
  const empty = scripted(['  ']);
  assert.equal(await code(guidedStarter(request(), context, empty.prompt, empty.write)), 'TARGET_REQUIRED');
  const from = scripted(['out']);
  const imported = await guidedStarter(request([], { from: 'export.json' }), context, from.prompt, from.write);
  assert.equal(imported.args.length, 1); assert.equal(imported.options.from, 'export.json');
  assert.deepEqual(from.asked, ['New project directory (e.g. ../my-project): ']);
}));

test('starters are chosen by number, by id or by default, and unknown choices are refused', () => withStarters(async context => {
  const byNumber = scripted(['2', 'my-app', '', 'description']);
  assert.equal((await guidedStarter(request(['target']), context, byNumber.prompt, byNumber.write)).options.starter, 'webapp');
  assert.ok(byNumber.written.some(text => text.includes('1. typed')));
  const byId = scripted(['webapp', 'my-app', '', '']);
  assert.equal((await guidedStarter(request(['target']), context, byId.prompt, byId.write)).options.starter, 'webapp');
  const byDefault = scripted(['', 'my-app', '', '', '', '', '']);
  assert.equal((await guidedStarter(request(['target']), context, byDefault.prompt, byDefault.write)).options.starter, 'typed');
  for (const answer of ['9', 'missing']) {
    const unknown = scripted([answer]);
    assert.equal(await code(guidedStarter(request(['target']), context, unknown.prompt, unknown.write)), 'STARTER_UNKNOWN');
  }
  const absent = scripted([]);
  assert.equal(await code(guidedStarter(request(['target'], { starter: 'gone' }), context, absent.prompt, absent.write)), 'STARTER_UNKNOWN');
}));

test('typed answers are validated, defaulted and serialized as data only', () => withStarters(async context => {
  const answers = scripted(['', 'Typed App', '', 'yes', 'bold', '']);
  const guided = await guidedStarter(request(['target'], { starter: 'typed' }), context, answers.prompt, answers.write);
  assert.deepEqual(JSON.parse(guided.options.answers), { id: 'target', name: 'Typed App', count: 3, enabled: true, tone: 'bold', description: 'Typed' });
  assert.ok(answers.asked.some(question => question === 'Tone (calm, bold): '));
  assert.ok(answers.asked.some(question => question === 'Count [3]: '));
  const numbers = scripted(['7', 'no', 'calm', 'text', 'Own']);
  const counted = await guidedStarter(request(['target'], { starter: 'typed', id: 'given', name: 'Given' }), context, numbers.prompt, numbers.write);
  assert.deepEqual(JSON.parse(counted.options.answers), { id: 'given', name: 'Given', count: 7, enabled: false, tone: 'calm', note: 'text', description: 'Own' });
  for (const [answers, expected] of [[['', 'X', 'many'], 'STARTER_INPUT'], [['', 'X', '', 'maybe'], 'STARTER_INPUT'], [['', 'X', '', '', 'loud'], 'STARTER_INPUT']]) {
    const invalid = scripted(answers);
    assert.equal(await code(guidedStarter(request(['target'], { starter: 'typed' }), context, invalid.prompt, invalid.write)), expected);
  }
}));

test('supplied --answers or --values skip prompts, and both together are refused', () => withStarters(async context => {
  const values = { id: 'from-values', name: 'From Values', count: 1, enabled: false, tone: 'calm', note: '', description: 'Values' };
  await writeFile(join(context.root, 'values.json'), JSON.stringify(values));
  const none = scripted([]);
  const fromFile = await guidedStarter(request(['target'], { starter: 'typed', values: 'values.json' }), context, none.prompt, none.write);
  assert.deepEqual(JSON.parse(fromFile.options.answers), values); assert.equal(fromFile.options.values, undefined); assert.deepEqual(none.asked, []);
  const inline = await guidedStarter(request(['target'], { starter: 'typed', answers: JSON.stringify(values) }), context, none.prompt, none.write);
  assert.deepEqual(JSON.parse(inline.options.answers), values);
  assert.equal(await code(guidedStarter(request(['target'], { starter: 'typed', values: 'values.json', answers: '{}' }), context, none.prompt, none.write)), 'STARTER_INPUT');
}));

test('a required input without a default must be answered', () => withStarters(async context => {
  const strict = { ...typed, id: 'strict', inputs: [...typed.inputs.slice(0, 2), { id: 'title', label: 'Title', type: 'string', required: true }], files: [{ path: 'README.md', content: '# {{title}} {{id}} {{name}}\n' }] };
  await writeFile(join(context.root, 'configs/starters/strict.json'), JSON.stringify(strict));
  const blank = scripted(['']);
  assert.equal(await code(guidedStarter(request(['target'], { starter: 'strict', id: 'strict-app', name: 'Strict' }), context, blank.prompt, blank.write)), 'STARTER_INPUT');
}));

test('companion starters offer Airship and fill single native integration defaults', async () => {
  const context = { root: frameworkRoot, frameworkRoot };
  const custom = scripted(['', '', '', '', '', 'y', '']);
  const view = await guidedStarter(request(['target'], { starter: 'custom-file-view', id: 'folio-app', name: 'Folio App', author: 'Team' }), context, custom.prompt, custom.write);
  assert.equal(view.options.airship, true); assert.equal(view.options.extension, 'folio');
  const menu = scripted(['', '', '', '', '', 'md,txt']);
  const filtered = await guidedStarter(request(['target'], { starter: 'context-menu', id: 'menu-app', name: 'Menu App', author: 'Team', 'no-airship': true }), context, menu.prompt, menu.write);
  assert.equal(filtered.options.airship, undefined); assert.equal(filtered.options.extensions, 'md,txt');
  const plain = scripted(['', '', '', '']);
  const blank = await guidedStarter(request(['target'], { starter: 'blank', id: 'plain-app', name: 'Plain App', author: 'Team', airship: false }), context, plain.prompt, plain.write);
  assert.equal(blank.options.extension, undefined); assert.equal(blank.options.extensions, undefined);
});
