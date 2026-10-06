import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { askSetupForm, confirmKeys, hostingFieldKeys, identityKeys, loadSetupForm, readSetupForm } from '../setup/form.mjs';
import { setupOptions } from '../setup/options.mjs';
import { readForm } from '../../src/cli/domain/form.ts';

const root = resolve(import.meta.dirname, '../..');
const formPath = join(root, 'configs/forms/setup-identity.json');
const shipped = async () => JSON.parse(await readFile(formPath, 'utf8'));
/** A scripted readline stand-in: records each question and answers from the script in order. */
function scripted(replies) {
  const prompts = [];
  return { prompts, replies, question: async text => { prompts.push(text); assert.ok(replies.length, `Unscripted question: ${text}`); return replies.shift(); } };
}
async function scratch(t) {
  const dir = await mkdtemp(join(tmpdir(), 'setup-form-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('[SETUP-FORM-01] the shipped setup interview is one shared-format form that the dependency-free entry locates from its own module', async () => {
  const raw = await shipped();
  const shared = readForm(structuredClone(raw));
  const form = await loadSetupForm(pathToFileURL(formPath));
  assert.equal(form.id, 'setup-identity');
  assert.deepEqual(form.fields.map(field => [field.id, field.kind]), shared.fields.map(field => [field.id, field.kind]));
  assert.deepEqual(form.fields.filter(field => field.kind === 'text').map(field => field.id), [...identityKeys, ...hostingFieldKeys]);
  assert.deepEqual(form.fields.filter(field => field.kind === 'confirm').map(field => field.id), [...confirmKeys]);
  const entry = await readFile(join(root, 'scripts/setup.mjs'), 'utf8');
  assert.match(entry, /new URL\('\.\.\/configs\/forms\/setup-identity\.json', import\.meta\.url\)/);
  assert.equal(new URL('../configs/forms/setup-identity.json', pathToFileURL(join(root, 'scripts/setup.mjs'))).pathname, pathToFileURL(formPath).pathname);
  const reader = await readFile(join(root, 'scripts/setup/form.mjs'), 'utf8');
  const imports = [...reader.matchAll(/^import\s.*?from\s+'([^']+)'/gm)].map(match => match[1]);
  assert.ok(imports.length > 0 && imports.every(name => name.startsWith('node:')), `form.mjs must import only Node builtins: ${imports}`);
});

test('[SETUP-FORM-02] the asker follows the definition with planned defaults and returns exactly an --answers object', async t => {
  const form = await loadSetupForm(pathToFileURL(formPath));
  const defaults = { id: 'plugin-shell', name: 'Plugin Shell', description: 'Shell', author: 'Owner', repo: null, version: '1.0.0', hosting: 'keep current' };
  const prompt = scripted(['field-notes', '  Field Notes  ', '', '', 'your-account/field-notes', ' 2.0.0 ', 'Yes', ' none ']);
  const written = [];
  const answers = await askSetupForm(form, prompt, { defaults, write: text => written.push(text) });
  assert.deepEqual(prompt.replies, []);
  assert.deepEqual(prompt.prompts, ['Plugin ID (id) [plugin-shell]: ', 'Plugin name (name) [Plugin Shell]: ', 'Description (description) [Shell]: ',
    'Author (author) [Owner]: ', 'GitHub repository (repo) [none]: ', 'Version (version) [1.0.0]: ', 'Enable project-local Workbench MCP for Claude Code and Codex? [y/N] ',
    'Hosting platform: github, azure-devops or none (hosting) [keep current]: ']);
  assert.deepEqual(written, form.fields.map(field => `${field.help}\n`));
  assert.deepEqual(answers, { id: 'field-notes', name: 'Field Notes', repo: 'your-account/field-notes', version: '2.0.0', mcp: true, hosting: 'none' });
  const file = join(await scratch(t), 'answers.json');
  await writeFile(file, JSON.stringify(answers));
  const options = await setupOptions(['--answers', file]);
  for (const [key, value] of Object.entries(answers)) assert.equal(options[key], value);
  assert.equal(options.identityRequested, true);

  for (const [reply, expected] of [['', false], ['n', false], ['y', true], ['maybe', false]]) {
    const confirm = scripted(['', '', '', '', '', '', reply, '']);
    assert.deepEqual(await askSetupForm(form, confirm, { defaults }), { mcp: expected }, reply);
  }
  const skipped = scripted(['', '', '', '', '', '']);
  assert.deepEqual(await askSetupForm(form, skipped, { defaults, skip: [...confirmKeys, ...hostingFieldKeys] }), {});
  assert.equal(skipped.prompts.some(text => /MCP|Hosting/.test(text)), false);
});

test('[SETUP-FORM-03] unsupported kinds or keys and definitions that diverge from the answers contract fail closed', async t => {
  const raw = await shipped();
  const withField = (index, change) => ({ ...raw, fields: raw.fields.map((field, at) => at === index ? change(field) : field) });
  const select = withField(4, field => ({ id: field.id, kind: 'select', label: field.label, choices: ['a', 'b'] }));
  assert.doesNotThrow(() => readForm(structuredClone(select)), 'the shared reader accepts kinds that setup must still refuse');
  for (const [value, pattern] of [
    [select, /kind "select" is not supported by npm run setup \(text or confirm only\)/],
    [withField(0, field => ({ ...field, kind: 'title' })), /kind "title" is not supported/],
    [withField(6, field => ({ ...field, kind: 'boolean' })), /kind "boolean" is not supported/],
    [withField(0, field => ({ ...field, default: 'x' })), /keys npm run setup does not support: default/],
    [withField(1, field => ({ ...field, when: { field: 'id', present: true } })), /does not support: when/],
    [{ ...raw, commit: 'settings.read' }, /form uses keys npm run setup does not support: commit/],
    [withField(4, field => ({ ...field, id: 'repository' })), /text field ids must be exactly the answers keys id, name, description, author, repo, version, hosting/],
    [{ ...raw, fields: raw.fields.filter(field => field.id !== 'hosting') }, /text field ids must be exactly/],
    [{ ...raw, fields: raw.fields.filter(field => field.id !== 'version') }, /text field ids must be exactly/],
    [{ ...raw, fields: [...raw.fields, { id: 'license', kind: 'text', label: 'License' }] }, /text field ids must be exactly/],
    [withField(6, field => ({ ...field, id: 'airship' })), /confirm field ids must be exactly mcp/],
    [{ ...raw, fields: raw.fields.filter(field => field.kind !== 'confirm') }, /confirm field ids must be exactly mcp/],
    [{ ...raw, fields: [...raw.fields, raw.fields[0]] }, /unique identifier/],
    [withField(2, field => ({ ...field, label: 'Bad\u0007label' })), /control characters/],
    [{ ...raw, schemaVersion: 2 }, /unsupported schemaVersion/],
    [{ ...raw, fields: [] }, /non-empty array/],
    [[], /JSON object/],
  ]) assert.throws(() => readSetupForm(value), pattern, JSON.stringify(value).slice(0, 120));

  const dir = await scratch(t);
  await writeFile(join(dir, 'select.json'), JSON.stringify(select));
  await assert.rejects(loadSetupForm(pathToFileURL(join(dir, 'select.json'))), /Setup form: fields\[4\]\.kind "select" is not supported/);
  await writeFile(join(dir, 'broken.json'), '{"schemaVersion": 1,');
  await assert.rejects(loadSetupForm(pathToFileURL(join(dir, 'broken.json'))), /Setup form: definition is not valid JSON/);
  await assert.rejects(loadSetupForm(pathToFileURL(join(dir, 'missing.json'))), /Setup form: cannot read .*missing\.json \(ENOENT\)/);
});
