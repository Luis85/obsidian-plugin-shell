import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { catalogIssues, catalogSummary, checkedCatalog, definitionsRoot, loadCatalog } from '../../bin/adapters/wizard-catalog.ts';
import { definitionCommand } from '../../bin/adapters/wizard-command.ts';
import { readForm } from '../../bin/domain/form.ts';
import { readWizard } from '../../bin/domain/wizard.ts';
import { formValueIssues } from '../../bin/domain/form-values.ts';
import { getPath, renderText, setPath } from '../../bin/domain/form-model.ts';
import { composeRegistry, hookNames, wizardModules, wizardRegistry } from '../../bin/presentation/wizards/registry.ts';
const repository = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'wizard-catalog-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function definitions(root, forms = {}, wizards = {}) {
  for (const [folder, items] of [['forms', forms], ['wizards', wizards]]) {
    await mkdir(join(root, folder), { recursive: true });
    for (const [id, value] of Object.entries(items)) await writeFile(join(root, folder, id + '.json'), JSON.stringify(value));
  }
}
const form = (id, fields, extra = {}) => ({ schemaVersion: 1, id, version: 1, title: id, fields, ...extra });
const wizard = (id, steps, extra = {}) => ({ schemaVersion: 1, id, version: 1, title: id, steps, ...extra });

test('shipped wizards and forms live in configs, load, and reference only registered hooks', async () => {
  assert.equal(definitionsRoot, join(repository, 'configs') + '/');
  const catalog = await loadCatalog();
  assert.deepEqual([...catalog.wizards.keys()].sort(), ['brainstorm', 'first-run', 'framework-setup', 'framework-setup-stages', 'new-project', 'project-setup', 'prototype', 'settings']);
  assert.deepEqual([...catalog.forms.keys()].sort(), ['documentation-settings', 'prd-intake', 'project-identity', 'user-settings', 'user-settings-advanced']);
  assert.deepEqual(catalogIssues(catalog, hookNames()), []);
  for (const folder of ['forms', 'wizards']) for (const name of await readdir(join(repository, 'configs', folder))) {
    const raw = JSON.parse(await readFile(join(repository, 'configs', folder, name), 'utf8'));
    assert.equal(raw.$schema, `../schemas/${folder === 'forms' ? 'form' : 'wizard'}.schema.json`, name);
  }
  const schema = JSON.parse(await readFile(join(repository, 'configs/schemas/form.schema.json'), 'utf8'));
  assert.deepEqual(schema.$defs.field.properties.kind.enum, ['text', 'title', 'number', 'select', 'multi', 'boolean', 'confirm', 'list', 'record', 'section']);
});

test('every registered code hook is named by a shipped definition, so the registry carries no dead actions', async () => {
  const catalog = await loadCatalog(), text = JSON.stringify([...catalog.forms.values(), ...catalog.wizards.values()]);
  const builtins = new Set(['wizard.review', 'wizard.agree', 'wizard.save-json']);
  const names = hookNames();
  for (const name of [...names.actions, ...names.choices, ...names.effects, ...names.prepare, ...names.commit])
    assert.ok(builtins.has(name) || text.includes(JSON.stringify(name)), `${name} is registered but unused`);
  assert.throws(() => composeRegistry([...wizardModules, { actions: { 'settings.load': () => undefined } }]), /Duplicate action settings.load/);
});

test('definition validation fails closed for unsafe, ambiguous or unknown shapes', () => {
  const text = { id: 'name', kind: 'text', label: 'Name' };
  for (const [fields, pattern] of [
    [[{ ...text, kind: 'script' }], /supported field kind/],
    [[{ ...text, bind: '__proto__.polluted' }], /dotted path/],
    [[{ ...text, bind: 'a..b' }], /dotted path/],
    [[text, text], /unique identifier/],
    [[{ ...text, when: { field: 'later', equals: 'x' } }, { ...text, id: 'later' }], /earlier field/],
    [[{ ...text, when: { field: 'name', equals: 'x', present: true } }], /exactly one/],
    [[{ ...text, run: 'rm -rf /' }], /Unknown fields: run/],
    [[{ id: 'pick', kind: 'select', label: 'Pick' }], /choices or choicesFrom/],
    [[{ id: 'pick', kind: 'select', label: 'Pick', choices: ['a', 'a'] }], /unique choices/],
    [[{ id: 'pick', kind: 'select', label: 'Pick', choices: ['a'], default: 'b' }], /choose a/],
    [[{ id: 'record', kind: 'record', label: 'Folder: ' }], /needs bind/],
    [[{ id: 'more', kind: 'section', label: 'More', form: 'x', fields: [] }], /form or fields/],
    [[{ ...text, effect: 'Not A Hook' }], /registered hook/],
  ]) assert.throws(() => readForm(form('sample', fields)), pattern, JSON.stringify(fields));
  assert.throws(() => readForm({ ...form('sample', [text]), schemaVersion: 2 }), /Unsupported form version/);
  assert.throws(() => readForm(form('Sample', [text])), /kebab-case/);
  assert.throws(() => readWizard(wizard('w', [{ id: 'a', kind: 'action', action: 'nodot' }])), /registered action/);
  assert.throws(() => readWizard(wizard('w', [{ id: 'a', kind: 'action', action: 'x.y', with: { file: 'a\u0007' } }])), /single-line/);
  assert.throws(() => readWizard(wizard('w', [{ id: 'a', kind: 'message', text: 'hi', retry: 'missing' }])), /name a step/);
  assert.throws(() => readWizard(wizard('w', [{ id: 'a', kind: 'form', fields: [text], when: { path: 'x', changed: true } }])), /only available inside forms/);
  assert.throws(() => readWizard(wizard('w', [])), /at least one step/);
  assert.equal(readWizard(wizard('w', [{ id: 'a', kind: 'form', fields: [text] }], { $schema: 'x' })).$schema, undefined);
});

test('the catalog rejects misnamed files, unknown references and recursive form sections', async () => scratch(async root => {
  await definitions(root, { other: form('renamed', [{ id: 'name', kind: 'text', label: 'Name' }]) });
  await assert.rejects(() => loadCatalog(root), /other.json must be named renamed.json/);
  await rm(join(root, 'forms/other.json'));
  await definitions(root, {
    loop: form('loop', [{ id: 'again', kind: 'section', label: 'Again', form: 'loop' }]),
    hooks: form('hooks', [{ id: 'pick', kind: 'select', label: 'Pick', choicesFrom: 'nobody.choices' }], { commit: 'nobody.commit' }),
  }, { flow: wizard('flow', [{ id: 'a', kind: 'form', form: 'missing' }, { id: 'b', kind: 'action', action: 'nobody.acts' }]) });
  const issues = catalogIssues(await loadCatalog(root), hookNames());
  assert.ok(issues.some(item => /form loop includes itself through loop → loop/.test(item)), issues.join('\n'));
  for (const pattern of [/unknown choice provider nobody.choices/, /unknown commit hook nobody.commit/, /unknown form missing/, /unknown action nobody.acts/])
    assert.ok(issues.some(item => pattern.test(item)), String(pattern));
  await assert.rejects(() => checkedCatalog(hookNames(), root), /DEFINITION_REFERENCE|unknown/);
  await writeFile(join(root, 'forms/broken.json'), '{"schemaVersion": 1,');
  await assert.rejects(() => loadCatalog(root), /broken.json/);
  assert.deepEqual(catalogSummary(await loadCatalog(join(root, 'missing'))), { root: join(root, 'missing'), wizards: [], forms: [] });
}));

test('paths and templates are inert data: no prototype access, missing values render fallbacks', () => {
  const value = Object.create(null);
  setPath(value, 'paths.prds', 'docs/prds');
  assert.equal(getPath(value, 'paths.prds'), 'docs/prds');
  assert.equal(getPath({}, 'constructor'), undefined);
  assert.equal(renderText('{{name|New feature}} / {{list}} / {{constructor.name}} / {{nested.a}}', { list: ['a', 'b'], nested: { a: 1 } }), 'New feature / a, b /  / 1');
  assert.equal(renderText('{{value}}', { value: '{{not.expanded}}' }), '{{not.expanded}}');
});

test('form validate checks a complete value without prompting, honoring conditions and nested sections', async () => {
  const catalog = await loadCatalog(), lookup = id => catalog.forms.get(id);
  assert.deepEqual(formValueIssues(catalog.forms.get('project-identity'), { name: 'Demo', description: 'A demo', product: 'Ship it' }, lookup), []);
  const missing = formValueIssues(catalog.forms.get('project-identity'), { name: 'Demo' }, lookup);
  assert.deepEqual(missing.map(item => [item.field, item.code]), [['description', 'FORM_REQUIRED'], ['product', 'FORM_REQUIRED']]);
  assert.deepEqual(formValueIssues(catalog.forms.get('prd-intake'), { mode: 'scan', files: 'ignored when hidden' }, lookup), []);
  assert.equal(formValueIssues(catalog.forms.get('prd-intake'), { mode: 'add', files: 'docs/a.md' }, lookup)[0].field, 'files');
  const settings = { paths: { prds: 'docs/prds' }, preferences: { ui: 'fancy', firstRun: { port: 'x' } } };
  const issues = formValueIssues(catalog.forms.get('user-settings'), settings, lookup).map(item => item.field);
  assert.deepEqual(issues, ['preferences.ui', 'preferences.firstRun.port']);
});

test('wizard and form commands list, show, check and validate definitions for agents', async () => scratch(async root => {
  const context = { root, frameworkRoot: repository };
  const listed = await definitionCommand({ command: 'wizard', action: 'list', flags: {} }, context);
  assert.equal(listed.status, 'ok'); assert.ok(listed.wizards.some(item => item.id === 'first-run'));
  assert.deepEqual(await definitionCommand({ command: 'form', action: 'check', flags: {} }, context), { root: definitionsRoot, wizards: 8, forms: 5, issues: [], status: 'ok' });
  const shown = await definitionCommand({ command: 'wizard', action: 'show', flags: { name: 'settings' } }, context);
  assert.deepEqual(shown.definition.steps.map(step => step.id), ['load', 'edit', 'review']);
  await writeFile(join(root, 'identity.json'), JSON.stringify({ name: 'Demo', description: '', product: 'Ship' }));
  const validated = await definitionCommand({ command: 'form', action: 'validate', flags: { name: 'project-identity', input: 'identity.json' } }, context);
  assert.deepEqual([validated.valid, validated.status, validated.issues[0].field], [false, 'failed', 'description']);
  await assert.rejects(() => definitionCommand({ command: 'form', action: 'show', flags: { name: 'nope' } }, context), /Unknown form nope/);
  await assert.rejects(() => definitionCommand({ command: 'wizard', action: 'validate', flags: { name: 'settings' } }, context), /Only forms/);
  await assert.rejects(() => definitionCommand({ command: 'wizard', action: '', flags: {} }, context), /in a terminal/);
  assert.equal(Object.keys(wizardRegistry.actions).length, hookNames().actions.size);
}));
