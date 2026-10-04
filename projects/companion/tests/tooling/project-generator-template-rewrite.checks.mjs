import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { boundaryProject } from '../fixtures/generator-boundaries.mjs';
import { selfProject } from '../support/starter-documents.mjs';
import { projectModel } from '../../bin/compiler/emitters/model.ts';
import { copiedTemplateMarker, rewriteTemplate } from '../../bin/compiler/emitters/file-code.ts';
import { relationshipCode } from '../../bin/compiler/emitters/relationship-code.ts';
import { httpCode } from '../../bin/compiler/emitters/http-code.ts';

// Copied template text is rewritten by exact literals; a drifted literal must stop generation, never emit stale text.
const root = fileURLToPath(new URL('../../', import.meta.url));
const live = await loadTemplateSnapshot(root);
// The boundary fixture extends the current (project v6) self-project starter.
const model = projectModel(boundaryProject(selfProject()));
const relationshipTests = 'tests/tooling/project-generator-relationships.checks.mjs';
const httpTests = 'tests/tooling/project-generator-http.checks.mjs';
const nodeTest = "import { test } from 'node:test';";
const drifts = [
  [relationshipCode, relationshipTests, copiedTemplateMarker],
  [relationshipCode, relationshipTests, nodeTest],
  [relationshipCode, relationshipTests, '../../templates/companion/runtime/relationships.ts'],
  [relationshipCode, relationshipTests, '../../templates/companion/runtime/relationship-session.ts'],
  [relationshipCode, 'templates/companion/runtime/relationship-session.ts', "'./relationships.ts'"],
  [relationshipCode, 'templates/companion/runtime/relationship-session.ts', "'./note-values.ts'"],
  [httpCode, httpTests, copiedTemplateMarker],
  [httpCode, httpTests, nodeTest],
  [httpCode, httpTests, '../../templates/companion/runtime/json-http.ts'],
  [httpCode, 'templates/companion/runtime/json-http.ts', "'./contract.ts'"],
];
const outputs = {
  [relationshipTests]: '/relationships.test.mjs', [httpTests]: '/http.test.mjs',
  'templates/companion/runtime/relationship-session.ts': '/application/relationship-session.ts',
  'templates/companion/runtime/json-http.ts': '/infrastructure/json-http.ts',
};
function drifted(path, literal) {
  return { ...live, text: requested => {
    const source = live.text(requested);
    return requested === path ? source.replaceAll(literal, '') : source;
  } };
}
async function emit(emitter, template) {
  const files = new Map();
  await emitter(template, model, (path, content) => files.set(path, content));
  return files;
}

test('template rewrites replace every occurrence and reject a missing literal by name', () => {
  assert.equal(rewriteTemplate("a 'x' b 'x'", [["'x'", "'y'"]], 'example.ts'), "a 'y' b 'y'");
  assert.throws(() => rewriteTemplate("a 'x'", [["'x'", "'y'"], ["'z'", "'w'"]], 'example.ts'),
    { message: "GENERATOR_INVALID: Template example.ts no longer contains 'z'." });
});

test('the copied template suites start with the marker the generator removes', async () => {
  for (const path of [relationshipTests, httpTests]) {
    const source = await readFile(new URL(path, `file://${root}`), 'utf8');
    assert.ok(source.startsWith(copiedTemplateMarker + nodeTest + '\n'), path);
  }
  const files = new Map([...await emit(relationshipCode, live), ...await emit(httpCode, live)]);
  for (const name of ['relationships.test.mjs', 'http.test.mjs']) {
    const content = files.get(`${model.testRoot}/${name}`);
    assert.ok(content?.startsWith("import { test } from 'vitest';\n"), name);
    assert.ok(!content.includes('Copied template text') && !content.includes('templates/companion/runtime'), name);
  }
});

for (const [emitter, path, literal] of drifts) {
  test(`${emitter.name} fails loudly when ${path} no longer contains ${literal.trim()}`, () => {
    const added = [];
    // Template emitters read the in-memory snapshot synchronously, so drift throws before any file is added.
    assert.throws(() => emitter(drifted(path, literal), model, file => added.push(file)), error => {
      assert.ok(error.message.startsWith('GENERATOR_INVALID: Template '), error.message);
      assert.ok(error.message.endsWith(`no longer contains ${literal}.`), error.message);
      return true;
    });
    assert.ok(!added.some(file => file.endsWith(outputs[path])), `${outputs[path]} was emitted from drifted text`);
  });
}
