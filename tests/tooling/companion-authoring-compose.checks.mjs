import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { composeMvp } from '../../scripts/concepts/mvp-compose.mjs';
import { createHash } from 'node:crypto';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { starterProjection } from '../../scripts/starters/browser.ts';
import { companionStarterIds, starterDocument, starterPath } from '../support/starter-documents.mjs';
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
test('the current workspace validates external v6 starters and rejects retired project versions', async () => {
  const html = composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle, startup), composed = program(html);
  const catalog = { schemaVersion: 1, starters: [] };
  for (const id of companionStarterIds()) {
    const bytes = await readFile(new URL(starterPath(id), root));
    catalog.starters.push(starterProjection(JSON.parse(bytes.toString('utf8')), createHash('sha256').update(bytes).digest('hex')));
  }
  // Current runtime starts empty: starter definitions are external JSON, never embedded seed data.
  assert.match(html, /<script type="application\/json" id="project-starters-data">\{"schemaVersion":1,"starters":\[\]\}<\/script>/);
  assert.doesNotMatch(html, /id="companion-visual-seed"/);
  const journey = { validateAuthoringDocument: value => validateAuthoringDocument(structuredClone(value)) };
  const context = vm.createContext({ CompanionJourney: journey, validateAuthoringDocument: journey.validateAuthoringDocument, STARTER_CATALOG_VERSION: 1 });
  const fields = /const STARTER_FIELDS = ([^;]+);/.exec(composed)[0];
  const validate = vm.runInContext(fields + '\n' + ['validateCompanionDocument','starterAssert','starterText','validateStarterCatalog'].map(n => declaration(composed,n)).join('\n') + '\nvalidateStarterCatalog;', context);
  assert.equal(validate(catalog), catalog);
  assert.ok(catalog.starters.every(s => s.document.schemaVersion === 6));
  // A retired v5 document is rejected by the v6 contract; it is never relabeled or migrated.
  const retired = structuredClone(catalog); retired.starters[0].document.schemaVersion = 5; retired.starters[0].document.design.schema = 5;
  assert.throws(() => validate(retired), /only schema 6 is supported/);
  assert.match(composed, /const COMPANION_VERSION = 6;/);
  assert.equal(declaration(composed, 'migrateCompanionDocument'), 'function migrateCompanionDocument(v){return {document:CompanionJourney.validateAuthoringDocument(v),report:null};}');
});
test('missing scoped graph styles fail closed; declarations and keyframes survive remapping', () => {
  assert.throws(() => composeMvp(base, '', '', bridge, undefined, startup), /MVP_ASSEMBLY/);
  const html = composeMvp(base, '', '', bridge, graphStyle, startup);
  assert.ok(html.includes(graphStyle.replaceAll('#vf-root','#jm-root')));
  assert.match(html, /#jm-root \.vue-flow__container \{\s*position: absolute;/);
});
test('composition leaves the v5 build base unchanged and escapes embedded script terminators', () => {
  const html = composeMvp(base, 'var test="</script>";', '', bridge, graphStyle, startup);
  assert.match(html, /var test="<\\\/script>"/);
  assert.equal(program(base).includes('const COMPANION_VERSION = 5;'), true);
});

test('current companion transfer preserves both optional tooling switches without enabling either', async () => {
  const composed = program(composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle, startup));
  const input = starterDocument('quick-capture');
  // The browser bundle validates within one realm. Re-home this VM fixture's plain data before
  // crossing into the real host-realm contract; production prototype/accessor checks stay strict.
  const context = vm.createContext({ COMPANION_FORMAT: input.kind, CompanionJourney: {
    validateAuthoringDocument: value => validateAuthoringDocument(structuredClone(value)),
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
