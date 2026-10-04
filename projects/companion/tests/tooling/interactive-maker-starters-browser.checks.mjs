const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { STARTER_MAX_BYTES, parseBrowserStarter, starterProjection, configureBrowserStarter, exportBrowserStarter } from '../../bin/adapters/starters/browser.ts';
import { validateDefinition } from '../../bin/adapters/starters/validation.ts';
import { fileStarter, shipped } from './starters-fixture.mjs';

// Browser/CLI-shared starter semantics (browser.ts): bounded parsing, the Companion projection, configuration and export.
const blank = await shipped('blank');
const sha = 'a'.repeat(64);
const refusal = (run, code, message) => assert.throws(run, error => error.code === code && error.message === message);

test('browser parsing accepts bounded starter JSON and refuses oversized or non-text input', () => {
  assert.equal(STARTER_MAX_BYTES, 4_000_000);
  assert.deepEqual(parseBrowserStarter(JSON.stringify(blank)), validateDefinition(blank));
  refusal(() => parseBrowserStarter(' '.repeat(STARTER_MAX_BYTES + 1)), 'STARTER_LIMIT', 'Choose a starter JSON no larger than 4 MB.');
  refusal(() => parseBrowserStarter(42), 'STARTER_LIMIT', 'Choose a starter JSON no larger than 4 MB.');
});

test('the projection copies Companion metadata and refuses file starters or unhashed bytes', () => {
  const projection = starterProjection(blank, sha);
  assert.deepEqual(projection, { id: 'blank', name: blank.name, category: blank.category, level: blank.level, summary: blank.summary,
    outcome: blank.outcome, includes: blank.includes, implementation: blank.implementation, tags: blank.tags, version: blank.version,
    file: 'blank.companion.json', sha256: sha, document: blank.generator.document });
  projection.includes.push('mutated'); projection.document.project.id = 'mutated';
  assert.notEqual(blank.includes.at(-1), 'mutated'); assert.equal(blank.generator.document.project.id, 'my-vault-tool');
  refusal(() => starterProjection(fileStarter(), sha), 'STARTER_KIND', 'This file-only starter can be generated through the CLI, but does not declare an editable Companion model.');
  refusal(() => starterProjection(blank, 'A'.repeat(64)), 'STARTER_HASH', 'Expected the SHA-256 of the actual imported bytes.');
});

test('configuration applies only the supplied identity and folder fields', () => {
  const document = configureBrowserStarter(blank, sha, { id: 'field-notes', name: 'Field Notes', codebaseFolder: 'app', testsFolder: 'checks' });
  assert.deepEqual(document.project, { id: 'field-notes', name: 'Field Notes', author: 'Your Name', version: '0.1.0', description: blank.generator.document.project.description });
  assert.deepEqual(document.settings, { codebaseFolder: 'app', testsFolder: 'checks' });
  assert.equal(document.notes.at(-1), '# Project starter\n\nDefinition: blank @ ' + blank.version + '\nSource SHA-256: ' + sha
    + '\n\nThis project is an independent editable copy. Catalog updates never overwrite it. No execution approvals, credentials, machine paths, test results or plugin installation are imported.\n');
  refusal(() => configureBrowserStarter(blank, sha, { name: 'Missing ID' }), 'STARTER_INPUT', 'Supply the required input id.');
});

test('export keeps the reviewed recipe and takes defaults from identity, settings and supplied values', () => {
  const definition = structuredClone(blank);
  definition.inputs.push({ id: 'theme', label: 'Theme', type: 'string', required: false }, { id: 'tone', label: 'Tone', type: 'string', required: false });
  const project = structuredClone(blank.generator.document);
  project.project = { ...project.project, id: 'exported', name: 'Exported' }; project.settings = { codebaseFolder: 'lib', testsFolder: 'spec' };
  const exported = exportBrowserStarter(definition, sha, project, { id: 'ignored', name: 'Ignored', tone: 'calm' });
  assert.deepEqual(exported.inputs.map(input => [input.id, input.default]), [['id', 'exported'], ['name', 'Exported'], ['author', 'Your Name'],
    ['description', blank.generator.document.project.description], ['version', '0.1.0'], ['codebaseFolder', 'lib'], ['testsFolder', 'spec'], ['theme', undefined], ['tone', 'calm']]);
  assert.equal(Object.hasOwn(exported.inputs[7], 'default'), false);
  assert.deepEqual(exported.processes, validateDefinition(blank).processes);
  assert.deepEqual(exported.generator, { kind: 'companion', document: validateDefinition({ ...definition, generator: { kind: 'companion', document: project } }).generator.document });
  refusal(() => exportBrowserStarter(fileStarter(), sha, project, {}), 'STARTER_KIND', 'This file-only starter can be generated through the CLI, but does not declare an editable Companion model.');
});
