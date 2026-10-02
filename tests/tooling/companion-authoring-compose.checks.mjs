import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { composeMvp } from '../../scripts/concepts/mvp-compose.mjs';
import { validateAuthoringDocument, migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { COMPANION_VERSION, validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
const root = new URL('../../', import.meta.url);
const base = await readFile(new URL('docs/concepts/companion/index.html', root), 'utf8');
const graphStyle = await readFile(new URL('docs/concepts/companion/vendor/vue-flow.scoped.css', root), 'utf8');
const bridge = await readFile(new URL('scripts/concepts/mvp-bridge.js', root), 'utf8');
const startup = await readFile(new URL('scripts/concepts/starter-workspace.js', root), 'utf8');
function program(html) { return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('function render()'))[1]; }
function declaration(source, name) {
  const ast = ts.createSourceFile('composed.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === name)?.getText(ast);
}
test('modern export does not reinterpret immutable legacy starter bytes as v6', async () => {
  const html = composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle, startup), composed = program(html);
  const catalog = JSON.parse(await readFile(new URL('docs/concepts/companion/starters/catalog.json', root), 'utf8'));
  for (const entry of catalog.starters) entry.document = JSON.parse(await readFile(new URL('docs/concepts/companion/starters/' + entry.file, root), 'utf8'));
  // Current runtime starts empty: starter definitions are external JSON, never embedded seed data.
  assert.match(html, /<script type="application\/json" id="project-starters-data">\{"schemaVersion":1,"starters":\[\]\}<\/script>/);
  assert.doesNotMatch(html, /id="companion-visual-seed"/);
  const context = vm.createContext({ validateCompanionDocument, validateAuthoringDocument: value => validateAuthoringDocument(structuredClone(value)), COMPANION_VERSION: 6, STARTER_CATALOG_VERSION: 1 });
  const fields = /const STARTER_FIELDS = ([^;]+);/.exec(composed)[0];
  const validate = vm.runInContext(fields + '\n' + ['starterAssert','starterText','validateStarterCatalog'].map(n => declaration(composed,n)).join('\n') + '\nvalidateStarterCatalog;', context);
  assert.equal(validate(catalog), catalog);
  // The retained v5 bytes are validated as v5 and never relabeled to the current version.
  assert.ok(catalog.starters.every(s => s.document.schemaVersion === COMPANION_VERSION));
  const bad = structuredClone(catalog); bad.starters[0].document.schemaVersion = 6;
  assert.throws(() => validate(bad));
  assert.match(composed, /const COMPANION_VERSION = 6;/);
  assert.match(declaration(composed, 'validateStarterCatalog'), /\[5, 6\]\.includes\(entry\.document\.schemaVersion\)/);
});
test('missing scoped graph styles fail closed; declarations and keyframes survive remapping', () => {
  assert.throws(() => composeMvp(base, '', '', bridge, undefined, startup), /MVP_ASSEMBLY/);
  const html = composeMvp(base, '', '', bridge, graphStyle, startup);
  assert.ok(html.includes(graphStyle.replaceAll('#vf-root','#jm-root')));
  assert.match(html, /#jm-root \.vue-flow__container \{\s*position: absolute;/);
});
test('composition leaves the legacy artifact unchanged and escapes embedded script terminators', () => {
  const html = composeMvp(base, 'var test="</script>";', '', bridge, graphStyle, startup);
  assert.match(html, /var test="<\\\/script>"/);
  assert.equal(program(base).includes('const COMPANION_VERSION = 5;'), true);
});

test('current companion transfer preserves both optional tooling switches without enabling either', async () => {
  const composed = program(composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle, startup));
  const input = migrateAuthoringDocument(JSON.parse(await readFile(new URL('docs/concepts/companion/starters/quick-capture.companion.json', root), 'utf8'))).document;
  // The browser bundle validates within one realm. Re-home this VM fixture's plain data before
  // crossing into the real host-realm contract; production prototype/accessor checks stay strict.
  const context = vm.createContext({ COMPANION_FORMAT: input.kind, CompanionJourney: {
    validateAuthoringDocument: value => validateAuthoringDocument(structuredClone(value)),
    migrateAuthoringDocument: value => migrateAuthoringDocument(structuredClone(value)),
  },
    designCopy: value => JSON.parse(JSON.stringify(value)), structuralDesign: () => true, importCounter: () => 0,
    newPlanningProject: identity => ({ ...identity, design: {} }), validSavedDesign: () => true,
    ensureProductModel: value => value, companionDesignExport: value => value,
    companionFolders: p => p.folders, parseCompanionDocument: text => JSON.parse(text) });
  const text = ['validateCompanionDocument', 'migrateCompanionDocument', 'companionReview', 'companionProjectDocument'].map(name => declaration(composed, name)).join('\n');
  const transfer = vm.runInContext(text + '\n({review:companionReview,document:companionProjectDocument})', context);
  for (const [enabled, generateStories] of [[false, false], [false, true], [true, false], [true, true]]) {
    input.tooling = { storybook: { enabled, generateStories } };
    const project = transfer.review(JSON.stringify(input)).project;
    assert.deepEqual(JSON.parse(JSON.stringify(transfer.document(project).tooling)), input.tooling);
  }
  input.tooling = { storybook: { enabled: 'true' } };
  assert.throws(() => transfer.review(JSON.stringify(input)), /boolean/);
});
