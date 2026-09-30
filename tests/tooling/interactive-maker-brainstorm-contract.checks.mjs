import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { hash } from '../../scripts/framework/files.ts';
import { readFeatureBrainstorm, featureConcept, brainstormGuide, brainstormSchema } from '../../bin/domain/brainstorm.ts';
import { captureRequest } from './interactive-maker-brainstorm-fixture.mjs';

const view = { title: 'Inbox', purpose: 'Review captured ideas' };
const rejects = (patch, code) => assert.throws(() => readFeatureBrainstorm({ ...captureRequest, ...patch }),
  error => error?.code === code, 'expected ' + code + ' for ' + JSON.stringify(patch));
const current = document => ({ document, sha256: hash(documentText(document)) });

test('every malformed or ambiguous feature request fails closed with a specific diagnostic', () => {
  rejects({ schemaVersion: 2 }, 'BRAINSTORM_VERSION');
  rejects({ name: 'Capture\ninbox' }, 'BRAINSTORM_TEXT');
  rejects({ actors: ['Member', 'member'] }, 'BRAINSTORM_DUPLICATE');
  rejects({ pages: [] }, 'BRAINSTORM_PAGES');
  rejects({ pages: [view, { title: 'inbox', purpose: 'Again' }] }, 'BRAINSTORM_DUPLICATE');
  rejects({ pages: [{ ...view, kind: 'modal' }] }, 'BRAINSTORM_PAGE_KIND');
  rejects({ pages: [view, { title: 'Second view', kind: 'view', purpose: 'Not nested' }] }, 'BRAINSTORM_PAGE_KIND');
  rejects({ pages: [view, { title: 'Popup', kind: 'sheet', purpose: 'Unknown kind' }] }, 'BRAINSTORM_PAGE_KIND');
  rejects({ pages: [{ ...view, interactions: [{ kind: 'script', label: 'Run', target: 'Inbox' }] }] }, 'BRAINSTORM_INTERACTION');
  rejects({ pages: [{ ...view, interactions: [{ kind: 'action', label: 'Save', target: 'Inbox', outcome: 'Saved' }] }] }, 'BRAINSTORM_INTERACTION');
  rejects({ pages: [{ ...view, interactions: [{ label: 'Reload', target: 'Inbox', outcome: 'Reloaded' }] }] }, 'BRAINSTORM_INTERACTION');
  rejects({ pages: [{ ...view, interactions: [{ kind: 'action', label: 'Save', outcome: 'One' },
    { kind: 'action', label: 'save', outcome: 'Two' }] }] }, 'BRAINSTORM_DUPLICATE');
  rejects({ output: 'binary' }, 'BRAINSTORM_OUTPUT');
  rejects({ output: 'prototype', verification: 'deploy' }, 'BRAINSTORM_VERIFICATION');
  rejects({ baseSha256: 'ABC' }, 'BRAINSTORM_BASE');
  rejects({ baseSha256: 42 }, 'BRAINSTORM_BASE');
  const minimal = readFeatureBrainstorm({ schemaVersion: 1, name: 'Minimal', purpose: 'Smallest request', pages: [view] });
  assert.deepEqual(minimal, { schemaVersion: 1, name: 'Minimal', purpose: 'Smallest request', actors: [], entities: [],
    pages: [{ title: 'Inbox', purpose: 'Review captured ideas', kind: 'view', interactions: [] }], acceptance: [],
    output: 'definition', verification: 'none' }, 'defaults are explicit and no binding is invented');
  const baseline = newDocument('Capture project');
  assert.throws(() => featureConcept({ ...minimal, projectId: 'another-project' }, current(baseline)),
    error => error?.code === 'BRAINSTORM_PROJECT');
  assert.deepEqual(brainstormGuide.questions.map(item => item.field), ['name', 'purpose', 'actors', 'entities', 'pages',
    'pages[].purpose', 'pages[].interactions', 'acceptance', 'output', 'verification']);
  assert.throws(() => { brainstormGuide.next = 'mutated'; }, TypeError, 'discovery guide is immutable');
  assert.deepEqual(brainstormSchema().required, ['schemaVersion', 'name', 'purpose', 'pages']);
});

test('existing surfaces, routes, links and stale ID counters never collide with a new feature', () => {
  const seeded = runOperations(newDocument('Capture project'), [{ op: 'page.add', title: 'Home' }, { op: 'page.add', title: 'Other' }]).document;
  seeded.design.nextId = 1;
  seeded.design.sitemap.routes[0].path = '/capture-inbox/:item';
  seeded.design.sitemap.routes[1].path = '/capture-inbox/inbox';
  const before = structuredClone(seeded), request = readFeatureBrainstorm(captureRequest);
  const first = featureConcept(request, current(seeded));
  assert.deepEqual(seeded, before, 'the saved project is never mutated in place');
  assert.deepEqual(first.mapping, [
    { title: 'Inbox', surfaceId: 'node-3', route: '/capture-inbox/inbox-2' },
    { title: 'Details', surfaceId: 'node-5', route: '/capture-inbox/details' },
  ], 'stale nextId skips node-1/node-2 and an existing literal route gets a suffix');
  assert.deepEqual(first.concept.changes.map(change => change.collection + ':' + change.id), [
    'nodes:node-3', 'sitemap.routes:route-4', 'visualDesigns.pages:vp-3', 'nodes:node-5', 'sitemap.routes:route-6',
    'visualDesigns.pages:vp-6', 'links:edge-7', 'features.items:capture-inbox']);
  const inbox = first.candidate.design.nodes.find(node => node.id === 'node-3');
  assert.equal(inbox.entry, false, 'an existing entry surface stays the only entry');
  assert.equal(first.candidate.design.nodes.find(node => node.id === 'node-5').parent, 'node-3');
  assert.deepEqual(first.candidate.design.links.at(-1), { id: 'edge-7', from: 'node-3', to: 'node-5', kind: 'navigate', label: 'Open details' });
  assert.equal(first.candidate.design.visualDesigns.pages.find(page => page.ownerId === 'node-5').notes, 'No interactions declared yet.');
  assert.equal(first.candidate.design.nextId, 8);
  assert.equal(first.definition.featureId, 'capture-inbox');

  const again = featureConcept(request, current(first.candidate));
  assert.equal(again.definition.featureId, 'capture-inbox-2', 'an existing feature ID is never reused');
  assert.deepEqual(again.mapping.map(item => item.route), ['/capture-inbox-2/inbox-2', '/capture-inbox-2/details-2']);
  assert.equal(again.candidate.design.features.items.length, 2);
  assert.equal(again.candidate.design.links.length, 2, 'the existing transition is preserved and one is added');
  const ids = again.candidate.design.nodes.map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('dialogs stay unrouted overlays opened from the feature view', () => {
  const request = readFeatureBrainstorm({ schemaVersion: 1, name: 'Discard flow', purpose: 'Confirm destructive discard',
    pages: [{ title: 'Drafts', purpose: 'List drafts', interactions: [{ label: 'Discard', target: 'Confirm discard' }] },
      { title: 'Confirm discard', kind: 'modal', purpose: 'Confirm the discard' }] });
  const baseline = newDocument('Capture project');
  const result = featureConcept(request, current(baseline));
  assert.deepEqual(result.mapping.map(item => [item.title, item.route]), [['Drafts', '/discard-flow/drafts'], ['Confirm discard', null]]);
  const dialog = result.candidate.design.nodes.find(node => node.label === 'Confirm discard');
  assert.equal(dialog.parent, null);
  assert.equal(result.candidate.design.nodes[0].entry, true, 'an empty project gets the feature view as entry');
  assert.equal(result.candidate.design.links[0].kind, 'open');
  assert.equal(result.candidate.design.visualDesigns.pages[0].notes, 'Planned interactions (not implemented): Discard → Confirm discard');
});
