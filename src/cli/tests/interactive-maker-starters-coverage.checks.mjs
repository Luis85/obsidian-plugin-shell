const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { starterCoverage } from '../adapters/starters/coverage.ts';
import { fileStarter, shipped } from './support/starters-fixture.mjs';

// Source-derived starter model coverage (coverage.ts), kept separate from executed or native acceptance.
const notRun = { behaviorAcceptance: 'not-run', nativeAcceptance: 'not-run' };
const catalog = {
  primitives: ['u-button', 'u-input', 'u-textarea', 'u-select', 'u-checkbox', 'u-switch', 'u-form', 'u-form-field', 'u-table', 'u-card', 'u-badge', 'u-avatar',
    'u-tabs', 'u-breadcrumb', 'u-dropdown-menu', 'u-command-palette', 'u-modal', 'u-drawer', 'u-alert', 'u-progress', 'u-skeleton', 'u-separator'],
  controls: ['text', 'textarea', 'number', 'checkbox', 'date', 'datetime-local', 'select', 'json-file', 'json-editor', 'markdown-editor'],
  actions: ['emit', 'navigate', 'set-state', 'toggle', 'focus', 'set-value', 'source'],
  states: ['default', 'loading', 'empty', 'error', 'disabled'],
  layouts: ['stack', 'row', 'grid'],
};
const note = 'Presence in JSON is not a passing interaction test. Full native Companion parity requires native adapters and candidate-bound behavioral evidence; this read-only report does not invent either.';
function menu(owner) {
  const stack = [...(Array.isArray(owner.root) ? owner.root : [owner.root])];
  while (stack.length) { const node = stack.pop(); if (node.ref?.entryId === 'u-dropdown-menu') return node; stack.push(...(node.children ?? [])); }
  return null;
}

test('file and project starters report their scope without inventing a visual model', async () => {
  assert.deepEqual(starterCoverage(fileStarter()), { starter: 'note-pack', scope: 'file-blueprint', modeled: null, ...notRun,
    note: 'File payloads are not a declarative visual model.' });
  assert.deepEqual(starterCoverage(await shipped('plugin-vanilla')), { starter: 'plugin-vanilla', scope: 'project-selection', modeled: null, ...notRun,
    note: 'A project starter selects compiler targets; its visual model comes from the prototype interview.' });
  assert.throws(() => starterCoverage({ ...fileStarter(), schemaVersion: 2 }), { code: 'STARTER_VERSION' });
});

test('a Companion starter without visual designs or a sitemap reports every catalog entry missing', async () => {
  const unused = Object.fromEntries(Object.entries(catalog).map(([key, expected]) => [key, { expected, used: [], missing: expected }]));
  assert.deepEqual(starterCoverage(await shipped('blank')), { starter: 'blank', scope: 'declarative-model-inventory',
    modeled: { categories: unused, complete: false, pages: 0, components: 0, revisions: 0, layouts: 0, surfaces: 2, surfacesWithUxAcceptance: 0, routes: 0, journeys: 0 },
    unboundInteractions: [], limitations: [], shippedEditors: ['journey-lens'], declaredEditorBindings: [], ...notRun, note });
});

test('the feature showcase covers the complete catalog across pages, components, layouts and revisions', async () => {
  const report = starterCoverage(await shipped('feature-showcase'));
  const { categories, ...counts } = report.modeled;
  assert.deepEqual(counts, { complete: true, pages: 10, components: 1, revisions: 1, layouts: 1, surfaces: 10, surfacesWithUxAcceptance: 2, routes: 9, journeys: 1 });
  for (const [key, expected] of Object.entries(catalog)) assert.deepEqual(categories[key], { expected, used: [...expected].sort(), missing: [] });
  assert.deepEqual([report.unboundInteractions, report.limitations, report.declaredEditorBindings], [[], [], [{ surface: 'node-9', editor: 'journey-lens' }]]);
});

test('unbound interactions and an inert dropdown menu are reported as limitations, not acceptance', async () => {
  const definition = await shipped('feature-showcase');
  const page = definition.generator.document.design.visualDesigns.pages.find(owner => menu(owner)), node = menu(page);
  node.events = node.events.map(event => ({ ...event, actions: [] }));
  const report = starterCoverage(definition);
  assert.equal(report.modeled.complete, true);
  assert.deepEqual(report.unboundInteractions, node.events.map(event => ({ definition: page.id, node: node.id, interaction: event.id, label: event.label })));
  assert.deepEqual(report.limitations, [{ code: 'MENU_ITEM_ACTION_UNBOUND', definition: page.id, node: node.id,
    message: 'Menu items have no declared item:select actions. Menu rendering alone is not working item behavior.' }]);
  const quick = starterCoverage(await shipped('quick-capture'));
  assert.deepEqual(quick.modeled.categories.states, { expected: catalog.states, used: ['default', 'empty', 'error'], missing: ['loading', 'disabled'] });
  assert.deepEqual(quick.unboundInteractions.map(row => row.label), ['Implement capture inbox', 'Implement capture an idea', 'Implement captured item', 'Implement preferences']);
});
