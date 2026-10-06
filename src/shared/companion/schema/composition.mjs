import { reference as ref, record, text, line, integer, number, choice, boolean, dictionary, list, id, json } from './primitives.mjs';
import { VISUAL_STATES, VISUAL_LAYOUT_MODES } from '../visual/visual-ir.mjs';
const token = { anyOf: [{ const: '' }, id] };
export const compositionSchema = record({ mode: choice(VISUAL_LAYOUT_MODES), ui: record({
  gap: number(0, 160), padding: number(0, 160), columns: integer(1, 12),
  align: choice(['start', 'center', 'end', 'stretch']), justify: choice(['start', 'center', 'end', 'space-between']), wrap: boolean,
  overflow: choice(['visible', 'auto', 'hidden']), widthMode: choice(['fill', 'hug', 'fixed']), width: number(24, 1600),
  minWidth: number(0, 1600), maxWidth: number(24, 4000),
  narrow: record({ layout: choice(VISUAL_LAYOUT_MODES), columns: integer(1, 12), hidden: boolean }),
  tokens: record(Object.fromEntries(['gap', 'padding', 'color', 'background', 'radius', 'typography'].map(name => [name, token]))),
}) });
export const scenarioSchema = record({ id, name: { ...text(120, 1), pattern: '\\S' }, state: choice(VISUAL_STATES), width: choice(['wide', 'narrow']),
  values: dictionary(json), bindings: list(record({ sourceId: id, operationId: id, value: json }), 20),
  recipe: record({ sourceId: id, operationId: id, engine: text(60), seed: integer(0, 2147483647), count: integer(1, 100),
    fingerprint: { type: 'string', pattern: '^[a-f0-9]{1,8}$' } }),
}, ['id', 'name', 'state', 'width', 'values', 'bindings']);
const simple = kind => record({ kind: { const: kind } });
export const mappingSchema = { anyOf: [simple('none'), simple('event'),
  record({ kind: { const: 'value' }, value: json }), record({ kind: { const: 'draft' }, nodeId: id }),
  record({ kind: { const: 'prop' }, name: ref('visualKey') }),
  record({ kind: { const: 'source' }, sourceId: id, operationId: id, field: text(120) }),
  record({ kind: { const: 'object' }, fields: { ...dictionary(ref('mapping'), 40), propertyNames: { allOf: [ref('safeKey'), { pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' }] } } }),
] };
export const layoutSlotSchema = record({ name: { ...text(60, 1), pattern: '^[a-z][A-Za-z0-9-]*$' }, required: boolean, description: text(2000) }, ['name', 'required']);
export const layoutSchema = record({ id: ref('layoutId'), name: line(120), description: text(400), scope: choice(['page', 'region']),
  category: choice(['application', 'dashboard', 'master-detail', 'form', 'settings', 'website', 'custom']), root: list(ref('visualNode'), 120),
  slots: list(layoutSlotSchema, 12), sourcePageId: id,
}, ['id', 'name', 'description', 'scope', 'category', 'root', 'slots']);
