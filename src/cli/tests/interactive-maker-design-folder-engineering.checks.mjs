import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { designFolderPlan, designFolderStatus } from '../adapters/design-folder.ts';
import { engineeringFacts } from '../adapters/design-facts.ts';
import { applyPrepared } from '../adapters/storage.ts';
import { documentTitle, libraryUsage, lineLimits, originFacts, packageFacts, tokenFacts, traceFacts } from '../domain/design-facts.ts';
import { sha256 } from '#shared/platform/hash.ts';
import { newDocument, documentText } from '../domain/document.ts';
import { runOperations } from '../application/operations.ts';
import { fileSymlink } from './support/file-symlink.mjs';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const folder = 'docs/design/field-notes', guidePath = `${folder}/ENGINEERING_HANDOFF_GUIDE.md`;
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'design-engineering-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root, path, content) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), typeof content === 'string' ? content : JSON.stringify(content)); }
const read = (root, path) => readFile(join(root, path), 'utf8');
const tokens = `/* Host-owned values. */\n:where(.plugin-shell) {\n  --plugin-shell-surface: var(--background-primary);\n  --plugin-shell-space-md: var(--size-4-3);\n}\n`;
/** A project with every fact source the guide reads, shaped like the shell and its generated projects. */
async function factProject(root) {
  const document = runOperations(newDocument('Field notes'), [
    { op: 'page.add', title: 'Inbox', as: 'inbox' }, { op: 'page.add', title: 'Archive' },
    { op: 'interaction.add', page: '@inbox', title: 'Capture note' }]).document;
  await put(root, 'design/project.json', documentText(document));
  await put(root, 'package.json', { name: 'field-notes', scripts: { typecheck: 'tsc', test: 'node --test', 'check:style-literals': 'node x', deploy: 'x' },
    dependencies: { vue: '3.5.43', '@nuxt/ui': '4.11.3', lodash: '4.17.21' }, devDependencies: { typescript: '6.0.3' } });
  await put(root, 'configs/quality/thresholds.json', { schemaVersion: 1, codeLines: { source: 400, tests: 450, mainTs: 100 } });
  await put(root, 'src/styles/tokens.css', tokens);
  await put(root, 'src/presentation/components/InboxList.vue', "<script setup lang=\"ts\">\nimport UButton from '@nuxt/ui/components/Button.vue';\n</script>\n<template><UCard><UButton /></UCard></template>\n");
  await put(root, 'src/presentation/components/panels/ArchivePanel.vue', '<template><UButton label="Restore" /></template>\n');
  await mkdir(join(root, 'src/presentation/composables'), { recursive: true });
  await put(root, 'design/visual-traceability.json', { definitions: [{ id: 'vp-1', kind: 'page', ownerId: 'node-1', component: 'src/generated/presentation/pages/InboxPage.vue' }],
    interactions: [{ id: 'vi-7', definitionId: 'vp-1', nodeId: 'node-1', label: 'Capture note', verification: 'business-todo',
      implementation: 'src/generated/application/interactions/vi-7.ts', test: 'tests/project/acceptance/vi-7.test.ts' },
    { id: 'vi-8', definitionId: 'vp-1', nodeId: 'node-1', label: 'Escape', verification: 'business-todo', implementation: '../outside.ts', test: null }] });
  await put(root, 'design/compiler-origins.json', { schemaVersion: 1, artifacts: [{ path: 'src/core/project.ts', origins: [{ entityId: 'node-2' }] }, { path: '/etc/passwd', origins: [{ entityId: 'node-2' }] }] });
  await put(root, 'AGENTS.md', '# Field notes rules\n\nKeep views thin.\n');
  await put(root, 'docs/architecture/STYLES.md', 'Intro\n\n## Modular CSS\n');
  return document;
}
const prepare = async (root, mode = 'prepare') => { const plan = await designFolderPlan({ root, frameworkRoot, name: 'field-notes', mode }); await applyPrepared(plan, plan.planHash); return plan; };
test('the engineering guide states the target codebase from its own files and names every source', async () => scratch(async root => {
  await factProject(root);
  await prepare(root);
  const guide = await read(root, guidePath);
  assert.match(guide, /^# Field notes: engineering handoff guide$/m);
  assert.match(guide, /Target: Obsidian plugin, frontend `nuxtui` \(source: built-in shell default; no saved project configuration\)/);
  assert.match(guide, /\| `vue` \| 3\.5\.43 \| UI framework \|\n\| `@nuxt\/ui` \| 4\.11\.3 \| component library \|/);
  assert.doesNotMatch(guide, /lodash/, 'only design-relevant packages are listed');
  assert.match(guide, /- `src\/presentation\/components\/`: Vue single-file components/);
  assert.match(guide, /- `src\/presentation\/composables\/`: view behaviour/);
  assert.doesNotMatch(guide, /src\/presentation\/stores\//, 'only folders that exist are named');
  assert.match(guide, /\| Inbox \| `node-1` \| `src\/generated\/presentation\/pages\/InboxPage\.vue` \|/);
  assert.match(guide, /\| Archive \| `node-2` \| `src\/core\/project\.ts` \|/);
  assert.doesNotMatch(guide, /etc\/passwd|outside\.ts/, 'unsafe paths from traceability files are dropped');
  assert.match(guide, /\| Capture note \| `vi-7` \| `node-1` \| business-todo \| `src\/generated\/application\/interactions\/vi-7\.ts` \| `tests\/project\/acceptance\/vi-7\.test\.ts` \|/);
  assert.match(guide, /- `src\/presentation\/components\/InboxList\.vue`\n- `src\/presentation\/components\/panels\/ArchivePanel\.vue`/);
  assert.match(guide, /`UButton` 2 · `UCard` 1/);
  assert.match(guide, /`src\/styles\/tokens\.css` declares 2 custom properties, scoped to `:where\(\.plugin-shell\)`/);
  assert.match(guide, /\| `--plugin-shell-space-md` \| `var\(--size-4-3\)` \|/);
  assert.match(guide, /fail `npm run check:style-literals`/);
  assert.match(guide, /at most 400 code lines and a test file 450/);
  assert.match(guide, /`npm run typecheck`, `npm run test`, `npm run check:style-literals`\./);
  assert.doesNotMatch(guide, /npm run deploy/, 'only known gate scripts are named');
  assert.match(guide, /- `AGENTS\.md`: Field notes rules\n- `docs\/architecture\/STYLES\.md`: Modular CSS/);
  assert.match(guide, new RegExp(`\\| \`package\\.json\` \\| \`${sha256(await read(root, 'package.json')).slice(0, 12)}\` \\| read \\|`));
  assert.match(guide, /\| `src\/\*\*\/\*\.vue, \*\.component\.ts \(2 files\)` \|/);
  assert.match(guide, /8\. In `handoff\/implementation-map\.md`, list the prototype files and the target files from section 2/);
  const manifest = JSON.parse(await read(root, `${folder}/design.manifest.json`));
  const facts = await engineeringFacts(root, { codebaseFolder: 'src', testsFolder: 'tests' });
  assert.equal(manifest.facts, facts.fingerprint);
  assert.ok(manifest.managed.some(file => file.path === 'ENGINEERING_HANDOFF_GUIDE.md' && file.sha256 === sha256(guide)));
  assert.deepEqual((await designFolderStatus(root, frameworkRoot, 'field-notes')).folders.map(item => [item.state, item.facts]), [['current', 'current']]);
}));
test('a code change makes the guide stale without touching the design source, and sync rewrites only the guide', async () => scratch(async root => {
  await factProject(root);
  await prepare(root);
  await put(root, 'src/styles/tokens.css', tokens.replace('}\n', '  --plugin-shell-accent: var(--interactive-accent);\n}\n'));
  const stale = (await designFolderStatus(root, frameworkRoot, 'field-notes')).folders[0];
  assert.deepEqual([stale.state, stale.facts], ['stale', 'changed']);
  assert.equal(stale.source.sha256, sha256(await read(root, 'design/project.json')), 'the design source itself did not change');
  const sync = await prepare(root, 'sync');
  assert.deepEqual(sync.plan.changes.filter(change => change.status !== 'unchanged').map(change => change.path.slice(folder.length + 1)), ['ENGINEERING_HANDOFF_GUIDE.md', 'design.manifest.json']);
  assert.match(await read(root, guidePath), /\| `--plugin-shell-accent` \| `var\(--interactive-accent\)` \|/);
  assert.deepEqual((await designFolderStatus(root, frameworkRoot, 'field-notes')).folders.map(item => [item.state, item.facts]), [['current', 'current']]);
}));
test('a project without fact sources gets an honest guide that names nothing it could not read', async () => scratch(async root => {
  await put(root, 'design/project.json', documentText(runOperations(newDocument('Field notes'), [{ op: 'page.add', title: 'Inbox' }]).document));
  await prepare(root);
  const guide = await read(root, guidePath);
  assert.match(guide, /No package\.json with known UI packages was found at the project root, so the stack is unknown/);
  assert.match(guide, /no compiler traceability files yet, so no screen has generated code/);
  assert.match(guide, /\| Inbox \| `node-1` \| not generated yet \|/);
  assert.match(guide, /No component files were found under src\//);
  assert.match(guide, /No token stylesheet was found/);
  assert.match(guide, /No gate scripts were found in package\.json/);
  assert.match(guide, /No architecture documents were found/);
  assert.match(guide, /\| Source \| SHA-256 \| Note \|\n\| --- \| --- \| --- \|\n\| `built-in shell default; no saved project configuration` \| — \| target selection \|/);
}));
test('linked and invalid fact sources are recorded as unreadable or invalid, never followed', async t => scratch(async root => {
  await factProject(root);
  await put(root, 'outside/tokens.css', ':root { --stolen: red; }\n');
  await rm(join(root, 'src/styles/tokens.css'));
  const linked = await fileSymlink(t, join(root, 'outside/tokens.css'), join(root, 'src/styles/tokens.css'));
  await put(root, 'design/compiler-origins.json', '{ not json');
  // A junction needs no Windows symlink privilege and is still reported as a link.
  await symlink(join(root, 'outside'), join(root, 'src/presentation/components/linked'), 'junction');
  const facts = await engineeringFacts(root, { codebaseFolder: 'src', testsFolder: 'tests' });
  assert.equal(facts.tokens, null);
  if (linked) assert.ok(facts.sources.some(item => item.path === 'src/styles/tokens.css' && item.note === 'unreadable'));
  assert.ok(facts.sources.some(item => item.path === 'design/compiler-origins.json' && item.note === 'invalid JSON'));
  assert.equal(facts.origins.size, 0);
  assert.ok(facts.components.every(path => !path.includes('linked')));
  const escaping = await engineeringFacts(join(root, 'src'), { codebaseFolder: '../src', testsFolder: 'tests' });
  assert.deepEqual([escaping.components, escaping.layout, escaping.placement], [[], [], []], 'a source folder outside the root is never scanned');
}));
test('fact parsers keep only well-formed, design-relevant values', () => {
  assert.equal(packageFacts('x'), null);
  assert.deepEqual(packageFacts({ name: ' demo ', scripts: { test: 'x', 'bad name': 'y' }, dependencies: { vue: '3.5.43' } }), { name: 'demo', stack: [{ name: 'vue', version: '3.5.43', role: 'UI framework' }], scripts: ['test'] });
  assert.equal(tokenFacts('a.css', '/* --x: 1; */ .a { color: red; }'), null);
  assert.deepEqual(tokenFacts('a.css', '.a,\n.b { --x : 1px ; }').aliases, [{ name: '--x', value: '1px' }]);
  assert.deepEqual(libraryUsage(['<UButton/><UButton />', "import X from '@nuxt/ui/components/Badge.vue'"]), [{ name: 'UBadge', uses: 1 }, { name: 'UButton', uses: 1 }]);
  assert.equal(traceFacts({ definitions: [] }), null);
  assert.deepEqual(traceFacts({ definitions: [{ id: 'vp', kind: 'page', ownerId: 'n', component: 'C:\\x.vue' }], interactions: [{ id: 'vi', definitionId: 'vp', nodeId: 'n', implementation: 'a/../b.ts' }] }),
    { definitions: [], interactions: [{ id: 'vi', definitionId: 'vp', nodeId: 'n', label: 'vi', verification: 'unspecified', implementation: null, test: null }] });
  assert.deepEqual([...originFacts({ artifacts: [{ path: 'a.ts', origins: [{ entityId: 'n' }, { entityId: 'n' }] }, 'junk'] })], [['n', ['a.ts']]]);
  assert.equal(lineLimits({ codeLines: { source: '400', tests: 450 } }), null);
  assert.equal(documentTitle('text\n### Deep\n'), null);
});
