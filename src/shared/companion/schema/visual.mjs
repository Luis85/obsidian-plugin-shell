import { reference as ref, record, text, line, integer, choice, boolean, dictionary, list, id, key, scalar, json, safeKeys } from './primitives.mjs';
import { VISUAL_STATES, VISUAL_TAGS, VISUAL_TEXT_ROLES, VISUAL_PAYLOAD_TYPES } from '../visual/visual-ir.mjs';
import { VISUAL_CONTROL_KINDS } from '../visual/visual-mapping.mjs';
import { visualCatalog, VISUAL_RESERVED_EXPORTS } from '../visual/visual-catalog.mjs';
import { VISUAL_ELEMENT_ATTRS } from '../visual/visual-validate.mjs';
import { compositionSchema, scenarioSchema, mappingSchema, layoutSchema, layoutSlotSchema } from './composition.mjs';
const identity = prefix => ({ type: 'string', pattern: '^' + prefix + '-[1-9][0-9]*$' });
const forbidden = ['designState', 'designScenario', 'interaction', 'ref', 'key', 'is', 'class', 'style', 'constructor', 'prototype', '__proto__'];
const contractKey = { ...key, not: { enum: forbidden } };
const value = type => ({ anyOf: [record({ kind: { const: 'literal' }, value: type }),
  record({ kind: { const: 'prop' }, name: contractKey }), record({ kind: { const: 'state' }, nodeId: id }),
  record({ kind: { const: 'source' }, sourceId: id, operationId: id, field: text(120) }),
] });
const values = dictionary(ref('visualValue'), 40);
const action = (kind, properties = {}) => record({ kind: { const: kind }, ...properties });
const actions = { anyOf: [action('emit', { event: contractKey, payload: ref('mapping') }), action('navigate', { surfaceId: id }),
  action('set-state', { state: choice(VISUAL_STATES) }), action('toggle', { nodeId: id }), action('focus', { nodeId: id }),
  action('set-value', { nodeId: id, value: scalar }), action('source', { sourceId: id, operationId: id, input: ref('mapping') }),
] };
const interaction = record({ id: identity('vi'), event: { ...text(60, 1), pattern: '^[a-zA-Z][a-zA-Z0-9:_-]*$' },
  label: line(120), actions: list(actions, 8), notes: text(4000), acceptance: text(8000) });
const common = { name: line(120), visibleIn: { ...list(choice(VISUAL_STATES), 5, 1), uniqueItems: true }, a11y: text(2000), notes: text(4000), layout: compositionSchema };
const node = (kind, properties) => record({ ...common, id: identity('vn'), kind: { const: kind }, ...properties }, ['id', 'kind', ...Object.keys(properties)]);
const events = list(interaction, 40), children = list(ref('visualNode'), 120);
const element = node('element', { tag: choice(VISUAL_TAGS), attrs: { ...dictionary(ref('visualScalarValue'), 16) }, children, events });
element.allOf = VISUAL_TAGS.map(tag => ({ if: { properties: { tag: { const: tag } } }, then: { properties: {
  attrs: { propertyNames: { anyOf: [{ enum: ['title', 'role', ...(VISUAL_ELEMENT_ATTRS[tag] ?? [])] }, { pattern: '^aria-[a-z]+(?:-[a-z]+)*$' }] } },
  ...(['input', 'img'].includes(tag) ? { children: { maxItems: 0 } } : {}),
} } }));
const component = node('component', { ref: { anyOf: [record({ kind: { const: 'nuxt-ui' }, entryId: choice(visualCatalog.map(entry => entry.id)) }),
  record({ kind: { const: 'project' }, componentId: id, revisionId: id }, ['kind', 'componentId'])] },
  props: values, slots: dictionary(children), events });
component.properties.variantId = id;
component.properties.control = record({ kind: choice(VISUAL_CONTROL_KINDS), required: boolean,
  options: list(record({ label: { ...text(120, 1), pattern: '\\S' }, value: text(120) }), 60, 1), maxBytes: integer(1, 4000000),
}, ['kind']);
component.properties.control.allOf = [
  { if: { properties: { kind: { const: 'select' } } }, then: { required: ['options'] }, else: { not: { required: ['options'] } } },
  { if: { required: ['maxBytes'] }, then: { properties: { kind: choice(['json-file', 'json-editor', 'markdown-editor', 'textarea', 'text']) } } },
];
component.allOf = visualCatalog.map(entry => ({ if: { properties: { ref: { properties: { kind: { const: 'nuxt-ui' }, entryId: { const: entry.id } } } } },
  then: { properties: { props: record(Object.fromEntries(entry.props.map(prop => [prop.name, value(['string', 'number', 'boolean'].includes(prop.type) ? { anyOf: [{ type: prop.type }, { type: 'null' }] } : json)])), []),
    slots: record(Object.fromEntries(entry.slots.map(slot => [slot.name, children])), []),
  }, not: { required: ['variantId'] } },
}));
const slot = node('slot', { name: line(60), fallback: children });
const external = node('external', { package: ref('packageName'), adapter: { ...text(60, 1), pattern: '^[a-z][a-z0-9-]*$' },
  props: { ...values, propertyNames: contractKey }, events });
const prop = { anyOf: ['string', 'number', 'boolean'].map(type => record({ name: contractKey, type: { const: type }, required: boolean,
  default: type === 'string' ? text(8000) : { type }, description: text(2000),
}, ['name', 'type', 'required'])) };
const contract = { props: list(prop, 32), slots: list({ ...layoutSlotSchema, properties: { ...layoutSlotSchema.properties, name: { ...layoutSlotSchema.properties.name, not: { enum: forbidden } } } }, 32),
  emits: list(record({ name: contractKey, payloadType: choice(VISUAL_PAYLOAD_TYPES), description: text(2000) }, ['name', 'payloadType']), 32),
  variants: list(record({ id, name: line(120), values: dictionary(scalar) }), 12) };
const dependencies = list(record({ package: ref('packageName'), version: { ...text(64, 1), pattern: '^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$' }, purpose: text(400) }), 8);
const page = record({ id: identity('vp'), ownerId: id, name: line(120), root: children, scenarios: list(scenarioSchema, 12), notes: text(8000) }, ['id', 'ownerId', 'name', 'root', 'scenarios']);
const definition = record({ id: identity('vc'), libraryId: id, exportName: { ...text(60, 1), pattern: '^[A-Z][A-Za-z0-9]*$',
  not: { enum: [...VISUAL_RESERVED_EXPORTS, ...visualCatalog.map(entry => entry.component)] } }, description: text(2000), ...contract,
  template: children, scenarios: list(scenarioSchema, 12), notes: text(8000), dependencies,
  implementation: record({ catalog: { const: 'nuxt-ui' }, entryId: choice(visualCatalog.map(entry => entry.id)) }),
}, ['id', 'libraryId', 'exportName', 'description', ...Object.keys(contract), 'template', 'scenarios']);
const revision = record({ id: identity('vr'), componentId: id, version: { ...text(40, 1), pattern: '^\\d+\\.\\d+\\.\\d+$' },
  contract: record(contract), template: children, notes: text(8000), scenarios: list(scenarioSchema, 12), dependencies, designSystem: json,
}, ['id', 'componentId', 'version', 'contract', 'template']);
export const visualDefinitions = { visualKey: contractKey, safeKey: safeKeys, mapping: mappingSchema,
  visualValue: value(json), visualScalarValue: value(scalar), layoutId: identity('vl'),
  packageName: { ...text(214, 1), pattern: '^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$' },
  visualNode: { anyOf: [element, node('text', { role: choice(VISUAL_TEXT_ROLES), value: ref('visualScalarValue') }), component, slot, external] },
  visualDesigns: record({ schema: { const: 3 }, nextId: integer(1), catalog: record({ id: { const: 'nuxt-ui' }, version: { const: 1 } }),
    pages: list(page, 200), components: list(definition, 200), layouts: list(layoutSchema, 60), revisions: list(revision, 200) }),
};
