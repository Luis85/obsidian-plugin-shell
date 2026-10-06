import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTemplateSnapshot } from '../../src/cli/compiler/index.ts';
import { maintainerOnly } from '../../src/cli/compiler/emitters/framework-docs.ts';
import { APPROVALS_PATH } from '../../scripts/quality/self-review-approvals.mjs';

// Generated-project template sources live in templates/: the companion runtime copied into generated projects,
// the developer-kit text templates, the example-removal templates, the adoption skill the kit installs into existing projects
// and the Claude Design folder templates `design prepare` renders. The shared companion contracts stay in scripts/companion.
const root = fileURLToPath(new URL('../../', import.meta.url));
const removed = ['scripts/companion/runtime', 'scripts/companion/devkit', 'scripts/examples/templates'];
async function files(folder) {
  const entries = await readdir(join(root, folder), { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  // Agent worktrees under .claude/worktrees are separate checkouts of this repository, not its sources.
  const nested = await Promise.all(entries.filter(entry => entry.name !== 'node_modules' && `${folder}/${entry.name}` !== '.claude/worktrees')
    .map(entry => entry.isDirectory() ? files(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]));
  return nested.flat();
}

test('templates/ holds only the runtime, developer-kit, example-removal, adoption-skill, design-folder and Astro site templates', async () => {
  const all = await files('templates');
  const kinds = [[/^templates\/companion\/runtime\/[\w-]+\.ts$/, 'runtime'], [/^templates\/companion\/devkit\/[\w.-]+\.tmpl$/, 'devkit'], [/^templates\/examples\/[\w.-]+\.txt$/, 'examples'],
    [/^templates\/adoption\/(?:claude|agents)-skill\/SKILL\.md$/, 'adoption skill'], [/^templates\/design-folder\/[\w-]+\.md\.tmpl$/, 'design folder'],
    [/^templates\/sites\/(?:catalog\.json|[a-z-]+\/[\w./-]+\.tmpl)$/, 'Astro site']];
  const unexpected = all.filter(path => !kinds.some(([pattern]) => pattern.test(path)));
  assert.deepEqual(unexpected, []);
  for (const [pattern, name] of kinds) assert.ok(all.some(path => pattern.test(path)), `${name} templates are present`);
  for (const folder of removed) assert.deepEqual(await files(folder), [], `${folder} was removed`);
});

test('the template snapshot copies every templates/ file except the framework-entry test template, and the contracts stay in scripts/companion', async () => {
  const snapshot = await loadTemplateSnapshot(root);
  const paths = new Set(snapshot.frameworkFiles.map(file => file.path));
  const templates = await files('templates');
  // Only the example-removal template of the framework src/main.ts entry test stays maintainer-only (a generated project replaces that entry).
  assert.deepEqual(templates.filter(maintainerOnly), ['templates/examples/tests__runtime__shell-entry-lifecycle.test.ts.txt']);
  for (const path of templates) assert.equal(paths.has(path), !maintainerOnly(path), path);
  assert.match(snapshot.text('templates/companion/runtime/contract.ts'), /export function matches/);
  for (const contract of ['scripts/companion/composition-contract.mjs', 'scripts/companion/visual/visual-ir.mjs', 'scripts/companion/journey/project-store.ts']) assert.ok(paths.has(contract), contract);
});

test('no source, test, plugin, workflow or configuration file names a removed template path', async () => {
  const self = 'tests/tooling/compiler-template-layout.checks.mjs';
  // The owner approvals record quotes deleted configuration lines verbatim; that history is its purpose, not a live reference.
  const historical = new Set([self, APPROVALS_PATH]);
  const sources = (await Promise.all(['src', 'scripts', 'templates', 'tests', 'plugins', 'configs', '.github', '.claude'].map(files))).flat()
    .filter(path => /\.(?:[cm]?[jt]s|json|ya?ml|md|py)$/.test(path) && !historical.has(path));
  const offenders = [];
  for (const path of sources) {
    const text = await readFile(join(root, path), 'utf8');
    for (const name of removed) if (text.includes(name + '/') || text.includes(`'${name}'`)) offenders.push(`${path}: ${name}`);
  }
  assert.deepEqual(offenders, []);
});
