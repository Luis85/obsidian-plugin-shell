import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { composeMvp } from '../concepts/mvp-compose.mjs';
import { createHash } from 'node:crypto';
import { validateAuthoringDocument, parseAuthoringDocument } from '../../src/shared/companion/authoring-contract.ts';
import { starterProjection } from '../../src/cli/adapters/starters/browser.ts';
import { companionStarterIds, starterDocument, starterPath } from '../../tests/support/starter-documents.mjs';
import { retiredProject } from '../../tests/support/retired-projects.mjs';
const root = new URL('../../', import.meta.url);
const base = await readFile(new URL('docs/concepts/companion/index.html', root), 'utf8');
const graphStyle = await readFile(new URL('docs/concepts/companion/vendor/vue-flow.scoped.css', root), 'utf8');
const bridge = await readFile(new URL('tooling/concepts/mvp-bridge.js', root), 'utf8');
const names = await readFile(new URL('src/companion/app/companion-contract.js', root), 'utf8');
function program(html) { return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('function render()'))[1]; }
function contractScript(html) {
  const blocks = [...html.matchAll(/<script data-contract="CompanionContract">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, 'Exactly one bundled project contract');
  return blocks[0][1];
}
function declaration(source, name) {
  const ast = ts.createSourceFile('composed.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === name)?.getText(ast);
}
test('the composed workspace validates external v6 starters with the bundled contract and refuses retired versions', async () => {
  const html = composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle), composed = program(html);
  const catalog = { schemaVersion: 1, starters: [] };
  for (const id of companionStarterIds()) {
    const bytes = await readFile(new URL(starterPath(id), root));
    catalog.starters.push(starterProjection(JSON.parse(bytes.toString('utf8')), createHash('sha256').update(bytes).digest('hex')));
  }
  // The current runtime starts empty: starter definitions are external JSON, never embedded seed data.
  assert.doesNotMatch(html, /id="project-starters-data"|id="companion-visual-seed"/);
  // The page's own contract realm: the bundled CompanionContract plus the concept's names for it. Data is parsed inside it.
  const context = vm.createContext({});
  vm.runInContext(contractScript(html) + '\n' + names, context);
  const inRealm = value => vm.runInContext('JSON.parse(' + JSON.stringify(JSON.stringify(value)) + ')', context);
  assert.equal(vm.runInContext('COMPANION_VERSION', context), 6);
  assert.equal(context.validateStarterCatalog(inRealm(catalog)).starters.length, catalog.starters.length);
  assert.ok(catalog.starters.length > 0 && catalog.starters.every(s => s.document.schemaVersion === 6));
  // A retired v5 document is rejected by the v6 contract; it is never relabeled or migrated.
  const retired = structuredClone(catalog); retired.starters[0].document = retiredProject(5);
  assert.throws(() => context.validateStarterCatalog(inRealm(retired)), /STARTER_INVALID: Starters require project schema 6/);
  assert.throws(() => context.parseCompanionDocument(JSON.stringify(retiredProject(4))), /COMPANION_VERSION/);
  for (const name of ['migrateCompanionDocument', 'customizeStarter', 'companionExampleProject', 'jmSeed']) assert.equal(declaration(composed, name), undefined, name);
});
test('missing scoped graph styles fail closed; declarations and keyframes survive remapping', () => {
  assert.throws(() => composeMvp(base, '', '', bridge, undefined), /MVP_ASSEMBLY/);
  const html = composeMvp(base, '', '', bridge, graphStyle);
  assert.ok(html.includes(graphStyle.replaceAll('#vf-root','#jm-root')));
  assert.match(html, /#jm-root \.vue-flow__container \{\s*position: absolute;/);
});
test('composition keeps the schema 6 concept contract unchanged and escapes embedded script terminators', () => {
  const html = composeMvp(base, 'var test="</script>";', '', bridge, graphStyle);
  assert.match(html, /var test="<\\\/script>"/);
  assert.equal(contractScript(html), contractScript(base));
  assert.ok(program(base).includes('const COMPANION_VERSION = CompanionContract.AUTHORING_VERSION;'));
  assert.equal(declaration(program(html), 'validateCompanionDocument'), declaration(program(base), 'validateCompanionDocument'));
});

test('current companion transfer preserves both optional tooling switches without enabling either', async () => {
  const composed = program(composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle));
  const input = starterDocument('quick-capture');
  // Host-realm contract over plain data re-homed with structuredClone; production prototype/accessor checks stay strict.
  const context = vm.createContext({ COMPANION_FORMAT: input.kind, COMPANION_VERSION: 6, CompanionContract: {
    validateAuthoringDocument: value => validateAuthoringDocument(structuredClone(value)), parseAuthoringDocument,
  },
    designCopy: value => JSON.parse(JSON.stringify(value)), structuralDesign: () => true, importCounter: () => 0,
    newPlanningProject: identity => ({ ...identity, design: {} }), validSavedDesign: () => true,
    ensureProductModel: value => value, designSnapshot: ({ schema, ...value }) => value, companionFolders: p => p.folders });
  const text = ['validateCompanionDocument', 'parseCompanionDocument', 'companionReview', 'companionProjectDocument'].map(name => declaration(composed, name)).join('\n');
  const transfer = vm.runInContext(text + '\n({review:companionReview,document:companionProjectDocument})', context);
  for (const [enabled, generateStories] of [[false, false], [false, true], [true, false], [true, true]]) {
    input.tooling = { storybook: { enabled, generateStories } };
    const project = transfer.review(JSON.stringify(input)).project;
    assert.deepEqual(JSON.parse(JSON.stringify(transfer.document(project).tooling)), input.tooling);
  }
  delete input.tooling;
  assert.equal('tooling' in transfer.document(transfer.review(JSON.stringify(input)).project), false);
  input.tooling = { storybook: { enabled: 'true' } };
  assert.throws(() => transfer.review(JSON.stringify(input)), /boolean/);
});
