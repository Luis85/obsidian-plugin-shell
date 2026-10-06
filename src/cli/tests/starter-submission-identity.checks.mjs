import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { compileProject, loadTemplateSnapshot } from '../compiler/index.ts';
import { manifestRules } from '../adapters/framework/submission.ts';

// A project generated from a shipped starter with its embedded identity must pass the manifest rules of `check submission`.
const root = fileURLToPath(new URL('../../../', import.meta.url)), template = await loadTemplateSnapshot(root);
const names = (await readdir(join(root, 'configs/starters'))).filter(name => name.endsWith('.json')).sort();
const definitions = await Promise.all(names.map(async name => JSON.parse(await readFile(join(root, 'configs/starters', name), 'utf8'))));
const companion = definitions.filter(definition => definition.generator?.kind === 'companion');

test('every Companion starter embeds a neutral identity whose generated manifest passes the submission manifest rules', async () => {
  assert.ok(companion.length > 0);
  for (const definition of companion) {
    const { project } = definition.generator.document;
    // A neutral, non-empty placeholder: an empty author fails the manifest rules, a real person's name lands in user manifests.
    assert.equal(project.author, 'Your Name', definition.id);
    const result = await compileProject({ source: JSON.stringify(definition.generator.document), sourceName: definition.id + '.json', template });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    const manifest = result.artifacts.find(file => file.path === 'manifest.json').content;
    const failures = manifestRules(manifest).filter(rule => rule.status !== 'pass').map(rule => `${rule.id}: ${rule.message}`);
    assert.deepEqual(failures, [], `${definition.id} (${project.id})`);
  }
});

test('starter inputs default to the embedded identity, so the shipped defaults generate the same compliant manifest', () => {
  for (const definition of companion) {
    const { project } = definition.generator.document, inputs = new Map(definition.inputs.map(input => [input.id, input]));
    for (const key of ['author', 'description']) assert.equal(inputs.get(key)?.default, project[key], `${definition.id}: ${key}`);
    if (inputs.get('id')?.default !== undefined) assert.equal(inputs.get('id').default, project.id, `${definition.id}: id`);
  }
});

test('Companion starters name the same next steps as the generated README definition of done', () => {
  for (const definition of companion) {
    assert.deepEqual(definition.nextSteps.slice(0, 2), ['npm ci', 'npm run check'], definition.id);
    assert.ok(definition.nextSteps.slice(2).every(step => /^npm run (?:dev:ui|dev:preview|build:clickdummy)$/.test(step)), definition.id);
  }
});
