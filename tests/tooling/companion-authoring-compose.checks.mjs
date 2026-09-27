import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { composeMvp } from '../../scripts/concepts/mvp-compose.mjs';
import { COMPANION_VERSION, validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
const root = new URL('../../', import.meta.url);
const base = await readFile(new URL('docs/concepts/companion/index.html', root), 'utf8');
const graphStyle = await readFile(new URL('docs/concepts/companion/vendor/vue-flow.scoped.css', root), 'utf8');
const bridge = await readFile(new URL('scripts/concepts/mvp-bridge.js', root), 'utf8');
function program(html) { return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m => m[1].includes('function render()'))[1]; }
function declaration(source, name) {
  const ast = ts.createSourceFile('composed.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === name)?.getText(ast);
}
test('modern export does not reinterpret immutable legacy starter bytes as v6', async () => {
  const composed = program(composeMvp(base, 'var CompanionJourney={};', '', bridge, graphStyle));
  const catalog = JSON.parse(await readFile(new URL('docs/concepts/companion/starters/catalog.json', root), 'utf8'));
  for (const entry of catalog.starters) entry.document = JSON.parse(await readFile(new URL('docs/concepts/companion/starters/' + entry.file, root), 'utf8'));
  const context = vm.createContext({ validateCompanionDocument, COMPANION_VERSION: 6, STARTER_CATALOG_VERSION: 1 });
  const fields = /const STARTER_FIELDS = ([^;]+);/.exec(composed)[0];
  const validate = vm.runInContext(fields + '\n' + ['starterAssert','starterText','validateStarterCatalog'].map(n => declaration(composed,n)).join('\n') + '\nvalidateStarterCatalog;', context);
  assert.equal(validate(catalog), catalog);
  assert.ok(catalog.starters.every(s => s.document.schemaVersion === COMPANION_VERSION));
  const bad = structuredClone(catalog); bad.starters[0].document.schemaVersion = 6;
  assert.throws(() => validate(bad));
  assert.match(composed, /const COMPANION_VERSION = 6;/);
  assert.match(declaration(composed, 'validateStarterCatalog'), /entry.document.schemaVersion === 5/);
});
test('missing scoped graph styles fail closed; declarations and keyframes survive remapping', () => {
  assert.throws(() => composeMvp(base, '', '', bridge), /MVP_ASSEMBLY/);
  const html = composeMvp(base, '', '', bridge, graphStyle);
  assert.ok(html.includes(graphStyle.replaceAll('#vf-root','#jm-root')));
  assert.match(html, /#jm-root \.vue-flow__container \{\s*position: absolute;/);
});
test('composition leaves the legacy artifact unchanged and escapes embedded script terminators', () => {
  const html = composeMvp(base, 'var test="</script>";', '', bridge, graphStyle);
  assert.match(html, /var test="<\\\/script>"/);
  assert.equal(program(base).includes('const COMPANION_VERSION = 5;'), true);
});
