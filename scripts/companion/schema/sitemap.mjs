import { record, text, list, json, nullable, choice, boolean, number, dictionary } from './primitives.mjs';
const id = { ...text(120, 1), pattern: '^[^\\u0000-\\u001f\\u007f]*\\S[^\\u0000-\\u001f\\u007f]*$', not: { enum: ['__proto__', 'constructor', 'prototype'] } };
const label = { ...text(120, 1), pattern: '\\S' };
const ids = maximum => ({ ...list(id, maximum), uniqueItems: true });
const position = record({ x: number(-50000, 50000), y: number(-50000, 50000) });
const step = record({ id, surface: id, via: nullable(id), unresolved: { const: true }, lastKnownLabel: label }, ['id', 'surface', 'via']);
step.allOf = [{ if: { required: ['unresolved'] }, then: { required: ['lastKnownLabel'] } }];
export const sitemapDefinitions = {
  surface: record({ id, label: label, kind: choice(['view', 'page', 'group', 'modal', 'settings', 'action']), parent: nullable(id),
    slug: text(120), nav: boolean, entry: boolean }, ['id', 'label', 'kind', 'parent'], json),
  transition: record({ id, from: id, to: id, kind: { ...text(80, 1), pattern: '\\S' }, label: label }, undefined, json),
  canvas: record({ positions: dictionary(position, 60), collapsed: list(id, 60) }, ['positions'], json),
  sitemap: record({ schema: { const: 1 }, routes: list(record({ id, surface: id, path: {
    ...text(240, 1), pattern: '^/(?:(?:[A-Za-z0-9_-]+|:[A-Za-z_][A-Za-z0-9_]*)(?:/(?:[A-Za-z0-9_-]+|:[A-Za-z_][A-Za-z0-9_]*))*)?$',
  } }), 60), journeys: list(record({ id, name: label, steps: list(step, 120) }), 64) }),
  features: record({ schema: { const: 1 }, items: list(record({ id, name: label, surfaces: ids(60), entryPoints: ids(60),
    components: ids(200), requirements: ids(1200), dependsOn: ids(60) }), 60) }),
};
