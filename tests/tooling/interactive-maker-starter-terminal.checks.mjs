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
  // The shared select refuses an unknown choice and asks again instead of ending the interview.
  for (const answer of ['9', 'missing']) {
    const unknown = scripted([answer, 'webapp', 'my-app', '', '']);
    assert.equal((await guidedStarter(request(['target']), context, unknown.prompt, unknown.write)).options.starter, 'webapp');
    assert.ok(unknown.written.some(text => text.includes('Choose one of the displayed options')));
    assert.equal(unknown.asked.filter(question => question.startsWith('Choose number or ID')).length, 2);
  }
  const absent = scripted([]);
  assert.equal(await code(guidedStarter(request(['target'], { starter: 'gone' }), context, absent.prompt, absent.write)), 'STARTER_UNKNOWN');
}));

test('typed answers are validated, defaulted and serialized as data only', () => withStarters(async context => {
  const answers = scripted(['', 'Typed App', '', 'yes', 'bold', '']);
  const guided = await guidedStarter(request(['target'], { starter: 'typed' }), context, answers.prompt, answers.write);
  assert.deepEqual(JSON.parse(guided.options.answers), { id: 'target', name: 'Typed App', count: 3, enabled: true, tone: 'bold', description: 'Typed' });
  // Choices are a numbered select now, so they are listed rather than inlined in the question.
  assert.ok(answers.written.some(text => text.includes('Tone') && text.includes('1. calm') && text.includes('2. bold')));
  assert.ok(answers.asked.some(question => question === 'Count [3]: '));
  const numbers = scripted(['7', 'no', 'calm', 'text', 'Own']);
  const counted = await guidedStarter(request(['target'], { starter: 'typed', id: 'given', name: 'Given' }), context, numbers.prompt, numbers.write);
  assert.deepEqual(JSON.parse(counted.options.answers), { id: 'given', name: 'Given', count: 7, enabled: false, tone: 'calm', note: 'text', description: 'Own' });
  // Invalid answers are reported and asked again; they never become values (the follow-up blank keeps the default).
  for (const [answers, reported, key, kept] of [[['', 'X', 'many'], 'Count: enter a number.', 'count', 3],
    [['', 'X', '', 'maybe'], 'Choose one of the displayed options', 'enabled', false], [['', 'X', '', '', 'loud'], 'Choose one of the displayed options', 'tone', undefined]]) {
    const invalid = scripted(answers);
    const guided = await guidedStarter(request(['target'], { starter: 'typed' }), context, invalid.prompt, invalid.write);
    assert.ok(invalid.written.some(text => text.includes(reported)), reported);
    assert.equal(JSON.parse(guided.options.answers)[key], kept);
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
  // A blank answer is refused and the question asked again until it is answered.
  const blank = scripted(['', 'Strict title']);
  const guided = await guidedStarter(request(['target'], { starter: 'strict', id: 'strict-app', name: 'Strict' }), context, blank.prompt, blank.write);
  assert.deepEqual(blank.asked, ['Title: ', 'Title: ']);
  assert.ok(blank.written.some(text => text.includes('Title needs text')));
  assert.equal(JSON.parse(guided.options.answers).title, 'Strict title');
}));

test('companion starters offer Airship and hosting and fill single native integration defaults', async () => {
  const context = { root: frameworkRoot, frameworkRoot };
  const custom = scripted(['', '', '', '', '', 'y', '', '']);
  const view = await guidedStarter(request(['target'], { starter: 'custom-file-view', id: 'folio-app', name: 'Folio App', author: 'Team' }), context, custom.prompt, custom.write);
  assert.equal(view.options.airship, true); assert.equal(view.options.extension, 'folio');
  // A new folder has no remote: the hosting default is GitHub and accepting it leaves the starter document unchanged.
  assert.match(custom.asked[6], /^Hosting platform .*\[github\]: $/); assert.equal(view.options.hosting, undefined);
  const menu = scripted(['', '', '', '', '', 'azure-devops', 'https://dev.azure.com/contoso', 'Menus', 'menu-repo', 'md,txt']);
  const filtered = await guidedStarter(request(['target'], { starter: 'context-menu', id: 'menu-app', name: 'Menu App', author: 'Team', 'no-airship': true }), context, menu.prompt, menu.write);
  assert.equal(filtered.options.airship, undefined); assert.equal(filtered.options.extensions, 'md,txt');
  assert.deepEqual([filtered.options.hosting, filtered.options['azure-organization'], filtered.options['azure-project'], filtered.options['azure-repository']],
    ['azure-devops', 'https://dev.azure.com/contoso', 'Menus', 'menu-repo']);
  const plain = scripted(['', '', '', '', 'none']);
  const blank = await guidedStarter(request(['target'], { starter: 'blank', id: 'plain-app', name: 'Plain App', author: 'Team', airship: false }), context, plain.prompt, plain.write);
  assert.equal(blank.options.extension, undefined); assert.equal(blank.options.extensions, undefined); assert.equal(blank.options.hosting, 'none');
  const explicit = scripted([]);
  const flagged = await guidedStarter(request(['target'], { starter: 'blank', id: 'plain-app', name: 'Plain App', author: 'Team', airship: false, hosting: 'github', answers: '{}' }), context, explicit.prompt, explicit.write);
  assert.equal(flagged.options.hosting, 'github'); assert.ok(explicit.asked.every(question => !/Hosting|Azure/.test(question)));
  assert.equal(await code(guidedStarter(request(['target'], { starter: 'blank', id: 'plain-app', name: 'Plain App', author: 'Team', airship: false }), context, scripted(['', '', '', '', 'gitlab']).prompt, () => {})), 'HOSTING_OPTION_PLATFORM');
});
