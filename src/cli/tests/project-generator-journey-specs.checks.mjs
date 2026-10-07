import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { projectModel } from '../compiler/emitters/model.ts';
import { authoredJourneyCode } from '../compiler/emitters/authored-journey-code.ts';
import { projectFiles } from './support/project-render.mjs';
import { parseBrowserStarter } from '../adapters/starters/browser.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const starter = async name => parseBrowserStarter(await readFile(`${root}configs/starters/${name}.json`, 'utf8')).generator.document;
const showcase = await starter('feature-showcase'), plugin = await starter('companion-plugin');
const spec = id => `tests/e2e/journeys/${id}.spec.ts`;

function emit(document) {
  const files = new Map();
  authoredJourneyCode(projectModel(structuredClone(document)), (path, content, ownership) => files.set(path, { content, ownership }));
  return files;
}
function withJourneys(journeys, links = [], nodes = []) {
  const document = structuredClone(showcase);
  document.design.sitemap.journeys = journeys;
  document.design.links.push(...links);
  document.design.nodes.push(...nodes);
  return document;
}
/** Titles and kinds of the declared tests, read from the syntax tree rather than from text patterns. */
function declaredTests(content) {
  const source = ts.createSourceFile('x.spec.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), found = [];
  assert.deepEqual(source.parseDiagnostics, []);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isStringLiteralLike(node.arguments[0] ?? node)) {
      const callee = node.expression.getText(source);
      if (['test', 'test.fixme', 'test.describe'].includes(callee)) found.push({ callee, title: node.arguments[0].text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test('navigation-only journey becomes real assertions with step ids in every title', () => {
  const files = emit(showcase);
  assert.deepEqual([...files.keys()].sort(), ['tests/e2e/journeys/journey-explore.spec.ts', 'tests/e2e/journeys/journey-support.ts']);
  const content = files.get(spec('journey-explore')).content, found = declaredTests(content);
  assert.deepEqual(found.map(item => item.callee), ['test.describe', 'test', 'test']);
  assert.equal(found[0].title, '[journey-explore] Explore UI features');
  assert.match(found[1].title, /^\[journey-explore\/step-home\] Open "Feature showcase"$/);
  assert.match(found[2].title, /^\[journey-explore\/step-forms\] Follow "Open Form controls" from "Feature showcase" to "Form controls"$/);
  assert.match(content, /openSurface\(page, "\/#surface=node-1"/);
  assert.match(content, /followControl\(page, "Open Form controls", 0, "\/#surface=node-2", "Form controls"\)/);
  assert.doesNotMatch(content, /fixme/);
  assert.equal(files.get(spec('journey-explore')).ownership, 'managed');
  assert.match(files.get('tests/e2e/journeys/journey-support.ts').content, /data-prototype-ready/);
});

test('business steps stay countable fixme tests with the interaction id and the walk resumes after them', () => {
  const link = { id: 'edge-save', from: 'node-2', to: 'node-3', kind: 'conditional', label: 'Save form' };
  const document = withJourneys([{ id: 'j-mixed', name: 'Mixed', steps: [
    { id: 's1', surface: 'node-1', via: null }, { id: 's2', surface: 'node-2', via: 'edge-11' },
    { id: 's3', surface: 'node-3', via: 'edge-save' }, { id: 's4', surface: 'node-9', via: 'edge-18', unresolved: true, lastKnownLabel: 'Gone' },
    { id: 's5', surface: 'node-1', via: null }, { id: 's6', surface: 'node-4', via: 'edge-13' },
  ] }], [link]);
  const content = emit(document).get(spec('j-mixed')).content, found = declaredTests(content).filter(item => item.callee !== 'test.describe');
  assert.deepEqual(found.map(item => item.callee), ['test', 'test', 'test.fixme', 'test.fixme', 'test.fixme', 'test']);
  assert.match(found[2].title, /^\[j-mixed\/s3\] Reach "Local interactions" \(TODO transition kind conditional requires business interaction behavior; interaction edge-save\)$/);
  assert.match(found[3].title, /^\[j-mixed\/s4\] .*unresolved planning reference/);
  assert.match(found[4].title, /^\[j-mixed\/s5\] .*no declared transition/);
  assert.match(content, /"type":"interaction","description":"edge-save"/);
  // The step after an unperformed step re-opens its source screen by address before following the control.
  const last = content.slice(content.indexOf('[j-mixed/s6]'));
  assert.ok(last.indexOf('openSurface(page, "/#surface=node-1"') >= 0 && last.indexOf('openSurface(page, "/#surface=node-1"') < last.indexOf('followControl('));
});

test('unresolved and unreachable steps are fixme and duplicate control labels are addressed by position', () => {
  const twin = { id: 'edge-twin', from: 'node-1', to: 'node-3', kind: 'navigate', label: 'Open Form controls' };
  const document = withJourneys([{ id: 'j-edge', name: 'Edge cases', steps: [
    { id: 'a', surface: 'node-1', via: null }, { id: 'b', surface: 'node-3', via: 'edge-twin' },
    { id: 'c', surface: 'node-2', via: null, unresolved: true, lastKnownLabel: 'Gone' },
  ] }], [twin]);
  const content = emit(document).get(spec('j-edge')).content;
  assert.match(content, /followControl\(page, "Open Form controls", 1, "\/#surface=node-3"/);
  const fixme = declaredTests(content).filter(item => item.callee === 'test.fixme');
  assert.deepEqual(fixme.map(item => item.title), ['[j-edge/c] Reach "Form controls" (TODO the step is an unresolved planning reference)']);
});

test('dialog targets are asserted as dialogs and steps inside dialogs or on action surfaces are fixme', () => {
  const base = showcase.design.nodes.find(node => node.id === 'node-3');
  const nodes = [{ ...base, id: 'node-dialog', slug: 'confirm', label: 'Confirm "it"', kind: 'modal', nav: false, components: [] },
    { ...base, id: 'node-do', slug: 'do-it', label: 'Do it', kind: 'action', nav: false, components: [] }];
  const links = [{ id: 'edge-dialog', from: 'node-1', to: 'node-dialog', kind: 'open', label: 'Confirm' },
    { id: 'edge-inside', from: 'node-dialog', to: 'node-2', kind: 'navigate', label: 'Go on' }];
  const content = emit(withJourneys([{ id: 'j-dialog', name: 'Dialog', steps: [
    { id: 'd1', surface: 'node-1', via: null }, { id: 'd2', surface: 'node-dialog', via: 'edge-dialog' },
    { id: 'd3', surface: 'node-2', via: 'edge-inside' }, { id: 'd4', surface: 'node-do', via: null },
  ] }], links, nodes)).get(spec('j-dialog')).content;
  assert.deepEqual(declaredTests(content).map(item => item.callee), ['test.describe', 'test', 'test', 'test.fixme', 'test.fixme']);
  assert.match(content, /followToDialog\(page, "Confirm", 0, "Confirm \\"it\\""\)/);
  assert.match(content, /controls inside a dialog are not driven/);
  assert.match(content, /an action or group surface has no preview/);
});

test('transitions leaving a surface bound to the Journey Lens editor are fixme because it renders no generated controls', () => {
  const document = withJourneys([{ id: 'j-editor', name: 'Editor', steps: [
    { id: 'e1', surface: 'node-1', via: null }, { id: 'e2', surface: 'node-9', via: 'edge-18' },
  ] }]);
  document.design.links.push({ id: 'edge-out', from: 'node-9', to: 'node-2', kind: 'navigate', label: 'Leave editor' });
  document.design.sitemap.journeys[0].steps.push({ id: 'e3', surface: 'node-2', via: 'edge-out' });
  const found = declaredTests(emit(document).get(spec('j-editor')).content);
  assert.deepEqual(found.map(item => item.callee), ['test.describe', 'test', 'test', 'test.fixme']);
  assert.match(found[3].title, /interaction edge-out/);
});

test('special characters in ids and titles are escaped, file names are safe and unique', () => {
  const hostile = 'a/../b "q" <script>\u2028';
  const document = withJourneys([
    { id: hostile, name: 'Title </script> "quoted" \\ back\nline', steps: [{ id: 'x"; y', surface: 'node-1', via: null }] },
    { id: 'a:b', name: 'Colon', steps: [{ id: 's', surface: 'node-1', via: null }] },
    { id: 'a/b', name: 'Slash', steps: [{ id: 's', surface: 'node-1', via: null }] },
  ]);
  const files = emit(document), paths = [...files.keys()].filter(path => path.endsWith('.spec.ts'));
  assert.equal(new Set(paths.map(path => path.toLowerCase())).size, 3);
  for (const path of paths) assert.match(path, /^tests\/e2e\/journeys\/[A-Za-z0-9_-]+\.spec\.ts$/);
  const content = files.get(paths.find(path => files.get(path).content.includes('script'))).content;
  assert.doesNotMatch(content, /<script|\u2028/);
  const [describe, step] = declaredTests(content);
  assert.equal(describe.title, '[a/../b "q" <script>\u2028] Title </script> "quoted" \\ back line');
  assert.ok(step.title.startsWith(`[${hostile}/x"; y] `));
});

test('no journeys, empty journeys and unchanged input produce no or identical output', () => {
  assert.equal(emit(withJourneys([])).size, 0);
  assert.equal(emit(withJourneys([{ id: 'j-empty', name: 'Empty', steps: [] }])).size, 0);
  assert.equal(emit(plugin).size, 4);
  assert.deepEqual([...emit(showcase)], [...emit(showcase)]);
});

test('generating the showcase and the companion starter emits their authored journey specs', async () => {
  const names = async (document, ids) => {
    const entries = await projectFiles(root, projectModel(structuredClone(document)));
    const specs = entries.filter(entry => entry.path.startsWith('tests/e2e/journeys/') && entry.path.endsWith('.spec.ts'));
    assert.deepEqual(specs.map(entry => entry.path).sort(), ids.map(spec).sort());
    return specs.map(entry => declaredTests(entry.content)).flat();
  };
  const explore = await names(showcase, ['journey-explore']);
  assert.ok(explore.some(item => item.title.startsWith('[journey-explore/step-forms] ')));
  const all = await names(plugin, ['journey-design', 'journey-starter', 'journey-delivery']);
  for (const id of ['journey-design/step-4', 'journey-starter/step-3', 'journey-delivery/step-4']) assert.ok(all.some(item => item.title.startsWith(`[${id}] `)), id);
});
