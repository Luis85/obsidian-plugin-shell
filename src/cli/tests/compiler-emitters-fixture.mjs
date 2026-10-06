// Shared inputs for the companion code-emitter checks: real project fixtures, the real template snapshot and an
// `add` recorder that keeps every emitted path, content and ownership exactly as the emitter produced them.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../compiler/emitters/model.ts';
import { validateAuthoringDocument } from '#shared/companion/authoring-contract.ts';
import { starterDocument } from '../../../tests/support/starter-documents.mjs';
import { loadTemplateSnapshot } from '../compiler/adapters/template-snapshot.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
const detail = validateAuthoringDocument(await json('tests/fixtures/companion/visual-project.json'));
export const template = await loadTemplateSnapshot(root);

/** The visual-design fixture (two pages, one authored component and the authoring vault source). */
export const detailDocument = () => structuredClone(detail);
export const model = document => projectModel(document);
/** Collects emitted artifacts; a duplicate path is a defect the generator itself would also refuse. */
export function recorder() {
  const files = new Map();
  const add = (path, content, ownership = 'extension') => {
    if (files.has(path)) throw new Error('DUPLICATE_EMIT: ' + path);
    files.set(path, { content, ownership });
  };
  return { files, add, text: path => {
    const entry = files.get(path); if (!entry) throw new Error('NOT_EMITTED: ' + path);
    return entry.content;
  } };
}
/** The detail fixture's authored component with required/defaulted props, a valued variant and a scenario. */
export function richComponentDocument() {
  const document = detailDocument(), store = document.design.visualDesigns, component = store.components[0];
  component.props.push({ name: 'count', type: 'number', required: true }, { name: 'label', type: 'string', required: false, default: 'Hello', description: 'Shown label' },
    { name: 'open', type: 'boolean', required: true });
  component.scenarios.push({ id: 'narrow-review', name: 'Narrow review', state: 'empty', width: 'narrow', values: {}, bindings: [] });
  component.variants[1].values = { busy: true };
  const instance = store.pages[0].root[0].children.find(node => node.id === 'vn-11');
  instance.props.count = { kind: 'literal', value: 2 }; instance.props.open = { kind: 'literal', value: false };
  return document;
}
/** A closed journey-lens editor binding on the first page surface of the quick-capture starter. */
export async function journeyDocument(custom = false) {
  const document = await starterDocument('quick-capture');
  if (custom) document.settings = { codebaseFolder: 'application/source', testsFolder: 'checks' };
  document.design.editors = { schema: 1, bindings: [{ surface: document.design.nodes.find(node => node.kind === 'page').id, editor: 'journey-lens' }] };
  return document;
}
const none = { mode: 'none', entity: null, many: false, fields: [], schema: null };
const schemaShape = schema => ({ mode: 'schema', entity: null, many: false, fields: [], schema });
/** The tasks-projects starter plus native task CRUD, a task self-parent, a read-only list, an unimplemented write and an HTTPS source. */
export async function dataDocument(properties = []) {
  const document = await starterDocument('tasks-projects'), design = document.design, task = design.semantic.entities[0];
  task.properties.push(...properties.map(([key, type, required = false], index) => ({ id: 'er-property-' + (50 + index), key, type, required })));
  design.semantic.relationships.push({ id: 'er-relationship-20', name: 'Subtask of', source: task.id, target: task.id, key: 'parent_ref', sourceCard: '0..*', targetCard: '0..1', onDelete: 'restrict' });
  design.dataSources.sources[0].operations.push({ id: 'ds-operation-9', slug: 'archive', name: 'Archive', direction: 'write', method: 'adapter', resource: 'Starter/Task',
    description: 'Unimplemented write', input: { mode: 'fields', entity: null, many: false, fields: [{ name: 'id', type: 'string', required: true }, { name: 'tags', type: 'array', required: false }], schema: null }, output: none });
  const entity = projectModel(document).entities.find(item => item.id === task.id);
  const { noteWireSchemas } = await import('../compiler/emitters/note-contracts.ts');
  design.dataSources.sources.push({ id: 'ds-source-10', slug: 'task-notes', name: 'Task notes', kind: 'vault', status: 'active', description: 'Native task notes', locator: 'vault://active', auth: 'none', credentialRef: '',
    operations: ['list', 'create', 'update', 'delete'].map((kind, index) => {
      const wire = noteWireSchemas(entity, kind), shape = schema => schema ? schemaShape(schema) : none;
      return { id: 'ds-operation-' + (11 + index), slug: kind + '-tasks', name: kind, direction: kind === 'list' ? 'read' : 'write', method: 'adapter', resource: task.folder,
        description: 'Native ' + kind, input: shape(wire.input), output: shape(wire.output), implementation: { kind: 'note', entity: task.id, operation: kind } };
    }) });
  design.dataSources.sources.push({ id: 'ds-source-30', slug: 'status-api', name: 'Status API', kind: 'api', status: 'active', description: 'HTTPS status', locator: 'https://example.invalid/v1', auth: 'runtime', credentialRef: 'status-token',
    operations: [{ id: 'ds-operation-31', slug: 'status', name: 'Status', direction: 'read', method: 'GET', resource: '/status', description: 'Read status', input: none,
      output: schemaShape({ type: 'object', properties: { status: { type: 'string', enum: ['ready', 'busy'] }, checked: { type: 'string', format: 'date-time' } }, required: ['status'], additionalProperties: false }) },
    { id: 'ds-operation-32', slug: 'ping', name: 'Ping', direction: 'write', method: 'POST', resource: '/ping', description: 'Ping', input: schemaShape({ type: 'object', properties: { count: { type: 'integer' } }, required: ['count'] }), output: none }] });
  design.dataSources.nextId = 40;
  return document;
}
const lit = value => ({ kind: 'literal', value });
const nuxt = (id, entryId, props = {}, extra = {}) => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props, slots: {}, events: [], ...extra });
const on = (id, event, actions, extra = {}) => ({ id, event, label: 'Run ' + id, notes: '', acceptance: '', actions, ...extra });
const draft = nodeId => ({ kind: 'draft', nodeId });
const read = field => ({ kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field });
/** The detail fixture plus a writable record source, an editor page with every runtime control and action kind,
 * and an authored component with typed emits, a slot, an external adapter, a pinned revision and a scenario. */
export function richVisualDocument() {
  const document = richComponentDocument(), design = document.design, store = design.visualDesigns, component = store.components[0];
  design.dataSources.sources.push({ id: 'ds-source-60', slug: 'record-writer', name: 'Record writer', kind: 'vault', status: 'active', description: 'Writes records', locator: 'vault://active', auth: 'none', credentialRef: '',
    operations: [{ id: 'ds-operation-61', slug: 'save-record', name: 'Save record', direction: 'write', method: 'adapter', resource: '', description: 'Save',
      input: schemaShape({ type: 'object', properties: { title: { type: 'string' }, count: { type: 'number' }, done: { type: 'boolean' }, origin: { type: 'string' } }, required: ['title'], additionalProperties: false }),
      output: schemaShape({ type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }) },
    { id: 'ds-operation-62', slug: 'touch', name: 'Touch', direction: 'both', method: 'adapter', resource: '', description: 'Touch', input: none, output: schemaShape({ type: 'boolean' }) }] });
  component.emits.push({ name: 'amount', payloadType: 'number' }, { name: 'raw', payloadType: 'unknown' }, { name: 'flag', payloadType: 'boolean' });
  component.dependencies = [{ package: 'chart.js', version: '4.4.0', purpose: 'Charts' }];
  component.slots.push({ name: 'default', required: false });
  const panel = component.template[0];
  panel.children.push(
    { id: 'vn-100', kind: 'slot', name: 'default', fallback: [{ id: 'vn-101', kind: 'text', role: 'h3', value: { kind: 'prop', name: 'label' } }] },
    { id: 'vn-70', kind: 'external', package: 'chart.js', adapter: 'chart', props: { title: { kind: 'prop', name: 'title' }, points: lit([1, 2]) },
      events: [on('vi-71', 'select', [{ kind: 'emit', event: 'select', payload: { kind: 'event' } }])] },
    { id: 'vn-74', kind: 'external', package: 'chart.js', adapter: 'map', props: { zoom: lit(2) }, events: [], visibleIn: ['loading'] },
    nuxt('vn-72', 'u-button', { label: lit('Emit') }, { events: [on('vi-73', 'click', [
      { kind: 'emit', event: 'select', payload: { kind: 'prop', name: 'title' } }, { kind: 'emit', event: 'amount', payload: { kind: 'prop', name: 'title' } },
      { kind: 'emit', event: 'raw', payload: { kind: 'value', value: { any: true } } }, { kind: 'emit', event: 'cancel', payload: { kind: 'none' } }, { kind: 'emit', event: 'flag', payload: { kind: 'prop', name: 'open' } }])] }));
  store.revisions.push({ id: 'vr-1', componentId: component.id, version: '1.0.0', contract: { props: component.props.filter(p => ['title', 'busy', 'count', 'open'].includes(p.name)), slots: [component.slots[0]], emits: [component.emits[0]], variants: [{ id: 'compact', name: 'compact', values: { busy: true } }] }, template: [] });
  const page = store.pages[1].root[0];
  page.children.push(
    nuxt('vn-80', 'u-input', {}, { control: { kind: 'text', required: true }, a11y: 'Title input', layout: page.layout }),
    nuxt('vn-81', 'u-input', {}, { control: { kind: 'number' }, events: [on('vi-82', 'change', [{ kind: 'set-value', nodeId: 'vn-80', value: 'Typed' }, { kind: 'focus', nodeId: 'vn-80' }])] }),
    nuxt('vn-83', 'u-checkbox', { modelValue: lit(false) }, { control: { kind: 'checkbox' } }),
    nuxt('vn-84', 'u-select', {}, { control: { kind: 'select', options: [{ label: 'One', value: 'one' }] } }),
    nuxt('vn-85', 'u-switch', {}, { control: { kind: 'checkbox' } }),
    nuxt('vn-86', 'u-textarea', {}, { control: { kind: 'json-editor' } }),
    nuxt('vn-87', 'u-button', { label: lit('Save') }, { events: [on('vi-88', 'click', [{ kind: 'source', sourceId: 'ds-source-60', operationId: 'ds-operation-61',
      input: { kind: 'object', fields: { title: draft('vn-80'), count: draft('vn-81'), done: draft('vn-83'), origin: read('0.title') } } }, { kind: 'set-state', state: 'empty' }]),
    on('vi-89', 'click', [{ kind: 'toggle', nodeId: 'vn-90' }, { kind: 'set-value', nodeId: 'vn-83', value: true }, { kind: 'source', sourceId: 'ds-source-60', operationId: 'ds-operation-62', input: { kind: 'none' } }]),
    on('vi-95', 'focus', [], { acceptance: '' })] }),
    { id: 'vn-90', kind: 'text', role: 'span', value: { kind: 'state', nodeId: 'vn-80' }, visibleIn: ['default', 'empty'] },
    nuxt('vn-91', 'u-table', { data: read(''), columns: lit([{ accessorKey: 'title' }, { accessorKey: 'id' }, { header: 'No key' }]) }),
    nuxt('vn-92', 'u-table', { data: read('') }),
    nuxt('vn-93', 'u-badge', { label: read('0.id') }, { slots: { default: [{ id: 'vn-94', kind: 'text', role: 'span', value: read('0.title') }] } }),
    { id: 'vn-96', kind: 'element', tag: 'button', attrs: { title: read('0.id'), role: lit('link'), 'aria-label': read('') }, children: [], events: [on('vi-97', 'click', [{ kind: 'navigate', surfaceId: 'node-48' }], { acceptance: 'Opens import' })] },
    { id: 'vn-98', kind: 'element', tag: 'input', attrs: {}, children: [], events: [on('vi-99', 'keydown', [{ kind: 'navigate', surfaceId: 'node-3' }])], visibleIn: ['error'] },
    { id: 'vn-105', kind: 'text', role: 'p', value: read('0.title'), visibleIn: ['error'] },
    nuxt('vn-102', 'u-modal', { open: lit(false) }, { slots: { body: [{ id: 'vn-103', kind: 'text', role: 'p', value: lit('Hidden') }] } }),
    { ...nuxt('vn-104', 'u-button', { label: lit('Pinned') }), ref: { kind: 'project', componentId: component.id, revisionId: 'vr-1' }, variantId: 'compact', props: { count: lit(1), open: lit(true) } });
  store.nextId = 200;
  store.pages[0].root[0].children.find(node => node.id === 'vn-11').variantId = 'compact';
  store.pages[1].scenarios.push({ id: 'filled', name: 'Filled', state: 'default', width: 'wide', values: { 'vn-80': 'Draft' }, bindings: [{ sourceId: 'ds-source-1', operationId: 'ds-operation-6', value: [{ id: 'c1', type: 'component', title: 'Card' }] }] });
  return document;
}
