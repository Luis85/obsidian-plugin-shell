import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { included } from '../../bin/adapters/framework/distribution.ts';
import { maintainerOnly } from '../../bin/compiler/emitters/framework-docs.ts';

const root = 'docs/concepts/jev-prompt-editor/';
const files = ['jev-studio.html', 'src/domain/context.ts', 'vendor/vue.global.prod.js', 'dist/app.js', 'schema/jev-prompt.schema.json', 'docs/RESEARCH.html'];
test('Jev concept is excluded from consumer CLI kits', () => {
  for (const file of files) assert.equal(included(root + file), false, file);
});
test('Jev concept is excluded from generated project scaffolds', () => {
  for (const file of files) assert.equal(maintainerOnly(root + file), true, file);
});
test('ordinary documentation remains available to consumers', () => {
  for (const file of ['docs/product/PRD.md', 'docs/concepts/companion/PROJECT-JSON.md']) {
    assert.equal(included(file), true, file);
    assert.equal(maintainerOnly(file), false, file);
  }
});
test('exclusions do not match similarly named unrelated paths', () => {
  const path = 'docs/concepts/jev-prompt-editor-other/README.md';
  assert.equal(included(path), true);
  assert.equal(maintainerOnly(path), false);
});
test('this maintainer-only regression test is not shipped without its concept', () => {
  const path = 'tests/tooling/jev-concept-distribution.checks.mjs';
  assert.equal(included(path), false);
  assert.equal(maintainerOnly(path), true);
});
test('the retained HTML matches its reviewed manifest', () => {
  const folder = new URL('../../' + root, import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', folder), 'utf8'));
  const hash = createHash('sha256').update(readFileSync(new URL('jev-studio.html', folder))).digest('hex');
  assert.equal(hash, manifest.artifactSha256);
  assert.equal(manifest.kind, 'jev-studio-repository-manifest');
});

test('Jev build enforces the root TypeScript 6 compiler and rejects legacy fallback', () => {
  const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('../../' + root + 'tests/compiler.test.cjs', import.meta.url))], {
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test('every root typecheck script invokes its workspace tool, not a PATH compiler', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.devDependencies.typescript, /^6\.\d+\.\d+$/);
  for (const [name, command] of Object.entries(pkg.scripts).filter(([name]) => name.startsWith('typecheck'))) {
    assert.match(command, /^node node_modules\/(?:typescript\/bin\/tsc|vue-tsc\/bin\/vue-tsc\.js) --noEmit(?: |$)/, name);
  }
});
