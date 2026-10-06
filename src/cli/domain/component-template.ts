import { VISUAL_STATES, VISUAL_TAGS } from '#shared/companion/visual/visual-ir.mjs';
import { visualBuiltinLayouts, visualCatalogEntry, visualRecipes } from '#shared/companion/visual/visual-catalog.mjs';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { buildComponentTemplateSchema } from './component-template-schema.ts';

const TEMPLATE_TYPES = ['component', 'component-with-children', 'page', 'page-with-bricks'] as const;
const ATOMIC_LEVELS = ['atom', 'molecule', 'organism', 'template', 'page'] as const;

export type ComponentTemplateType = typeof TEMPLATE_TYPES[number];
export type AtomicLevel = typeof ATOMIC_LEVELS[number];

type TemplateDesign =
  | { kind: 'catalog'; entryId: string }
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'composition'; tag: string; layout: 'stack' | 'row' | 'grid' }
  | { kind: 'page'; layout: 'stack' | 'row' | 'grid' };

interface TemplateChild {
  template: string;
  slot?: string;
  optional?: boolean;
}

interface TemplateSlot {
  id: string;
  role: string;
  accepts: string[];
}

interface TemplateProp {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
  description?: string;
}

interface TemplateEvent {
  name: string;
  payloadType: 'void' | 'string' | 'number' | 'boolean' | 'unknown';
  description?: string;
}

export interface ComponentTemplate {
  schemaVersion: 1;
  $schema?: string;
  id: string;
  name: string;
  version: string;
  templateType: ComponentTemplateType;
  atomicLevel: AtomicLevel;
  category: string;
  description: string;
  tags: string[];
  recommendedFor: string[];
  useWhen: string[];
  avoidWhen: string[];
  capabilities: string[];
  states: string[];
  props: TemplateProp[];
  events: TemplateEvent[];
  children: TemplateChild[];
  slots: TemplateSlot[];
  design: TemplateDesign;
  accessibility: {
    notes: string;
    keyboard: string[];
    aria: string[];
  };
}

export interface ComponentTemplateEntry {
  template: ComponentTemplate;
  file: string;
  sha256: string;
  origin: 'baseline' | 'project' | 'plugin';
}

export interface ComponentTemplateQuery {
  query?: string;
  templateType?: ComponentTemplateType;
  atomicLevel?: AtomicLevel;
  category?: string;
  tag?: string;
  recommendedFor?: string;
}

const idPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const keyPattern = /^[a-z][A-Za-z0-9]*$/;

function record(value: unknown, label = 'template'): Record<string, unknown> {
  requireSketch(value !== null && typeof value === 'object' && !Array.isArray(value), 'TEMPLATE_INVALID', label + ' must be an object.');
  return value as Record<string, unknown>;
}

function fields(row: Record<string, unknown>, allowed: readonly string[]): void {
  requireSketch(Object.keys(row).every(key => allowed.includes(key)), 'TEMPLATE_INVALID', 'Unknown component-template field.');
}

function containsControlCharacter(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function text(value: unknown, label: string, max = 1000): string {
  requireSketch(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !containsControlCharacter(value),
    'TEMPLATE_INVALID', 'Invalid ' + label + '.');
  return value;
}

function strings(value: unknown, label: string, max = 64): string[] {
  requireSketch(Array.isArray(value) && value.length <= max, 'TEMPLATE_INVALID', 'Invalid ' + label + ' list.');
  const result = value.map(item => text(item, label, 400));
  requireSketch(new Set(result).size === result.length, 'TEMPLATE_INVALID', 'Duplicate ' + label + ' value.');
  return result;
}

function identifier(value: unknown, label = 'template ID'): string {
  const id = text(value, label, 120);
  requireSketch(idPattern.test(id), 'TEMPLATE_INVALID', 'Use a dotted lower-case ' + label + ', for example atom.button.');
  return id;
}

function readProps(value: unknown): TemplateProp[] {
  requireSketch(Array.isArray(value) && value.length <= 32, 'TEMPLATE_INVALID', 'Invalid props list.');
  const props = value.map(raw => {
    const row = record(raw, 'prop');
    fields(row, ['name', 'type', 'required', 'default', 'description']);
    const name = text(row.name, 'prop name', 60);
    const type = String(row.type);
    requireSketch(keyPattern.test(name) && ['string', 'number', 'boolean'].includes(type) && typeof row.required === 'boolean',
      'TEMPLATE_INVALID', 'Invalid template prop.');
    if (row.default !== undefined) {
      requireSketch(typeof row.default === type, 'TEMPLATE_INVALID', 'Default for ' + name + ' must match its type.');
    }
    return {
      name,
      type: type as TemplateProp['type'],
      required: row.required,
      ...(row.default === undefined ? {} : { default: row.default as string | number | boolean }),
      ...(row.description === undefined ? {} : { description: text(row.description, 'prop description', 1000) }),
    };
  });
  requireSketch(new Set(props.map(item => item.name)).size === props.length, 'TEMPLATE_INVALID', 'Duplicate template prop.');
  return props;
}

function readEvents(value: unknown): TemplateEvent[] {
  requireSketch(Array.isArray(value) && value.length <= 32, 'TEMPLATE_INVALID', 'Invalid events list.');
  const events = value.map(raw => {
    const row = record(raw, 'event');
    fields(row, ['name', 'payloadType', 'description']);
    const name = text(row.name, 'event name', 60);
    const payloadType = String(row.payloadType);
    requireSketch(keyPattern.test(name) && ['void', 'string', 'number', 'boolean', 'unknown'].includes(payloadType),
      'TEMPLATE_INVALID', 'Invalid template event.');
    return {
      name,
      payloadType: payloadType as TemplateEvent['payloadType'],
      ...(row.description === undefined ? {} : { description: text(row.description, 'event description', 1000) }),
    };
  });
  requireSketch(new Set(events.map(item => item.name)).size === events.length, 'TEMPLATE_INVALID', 'Duplicate template event.');
  return events;
}

function readChildren(value: unknown): TemplateChild[] {
  requireSketch(Array.isArray(value) && value.length <= 64, 'TEMPLATE_INVALID', 'Invalid children list.');
  return value.map(raw => {
    const row = record(raw, 'child');
    fields(row, ['template', 'slot', 'optional']);
    requireSketch(row.optional === undefined || typeof row.optional === 'boolean', 'TEMPLATE_INVALID', 'Child optional must be boolean.');
    return {
      template: identifier(row.template, 'child template ID'),
      ...(row.slot === undefined ? {} : { slot: text(row.slot, 'child slot', 60) }),
      ...(row.optional === undefined ? {} : { optional: row.optional }),
    };
  });
}

function readSlots(value: unknown): TemplateSlot[] {
  requireSketch(Array.isArray(value) && value.length <= 24, 'TEMPLATE_INVALID', 'Invalid slots list.');
  const slots = value.map(raw => {
    const row = record(raw, 'slot');
    fields(row, ['id', 'role', 'accepts']);
    const id = text(row.id, 'slot ID', 60);
    requireSketch(/^[a-z][a-z0-9-]*$/.test(id), 'TEMPLATE_INVALID', 'Slot IDs use lower-case kebab-case.');
    return { id, role: text(row.role, 'slot role', 100), accepts: strings(row.accepts, 'slot accepts', 16) };
  });
  requireSketch(new Set(slots.map(item => item.id)).size === slots.length, 'TEMPLATE_INVALID', 'Duplicate template slot.');
  return slots;
}

function readDesign(value: unknown): TemplateDesign {
  const row = record(value, 'design');
  const kind = String(row.kind);
  if (kind === 'catalog') {
    fields(row, ['kind', 'entryId']);
    const entryId = text(row.entryId, 'catalog entry', 80);
    requireSketch(Boolean(visualCatalogEntry(entryId)), 'TEMPLATE_INVALID', 'Unknown visual catalog entry ' + entryId + '.');
    return { kind, entryId };
  }
  if (kind === 'recipe') {
    fields(row, ['kind', 'recipeId']);
    const recipeId = text(row.recipeId, 'recipe ID', 100);
    requireSketch([...visualRecipes, ...visualBuiltinLayouts].some(item => item.id === recipeId),
      'TEMPLATE_INVALID', 'Unknown visual recipe ' + recipeId + '.');
    return { kind, recipeId };
  }
  if (kind === 'composition') {
    fields(row, ['kind', 'tag', 'layout']);
    const tag = text(row.tag, 'composition tag', 30);
    const layout = String(row.layout);
    requireSketch(VISUAL_TAGS.includes(tag) && ['stack', 'row', 'grid'].includes(layout), 'TEMPLATE_INVALID', 'Unsupported composition design.');
    return { kind, tag, layout: layout as 'stack' | 'row' | 'grid' };
  }
  fields(row, ['kind', 'layout']);
  requireSketch(kind === 'page' && ['stack', 'row', 'grid'].includes(String(row.layout)), 'TEMPLATE_INVALID', 'Unsupported template design.');
  return { kind: 'page', layout: row.layout as 'stack' | 'row' | 'grid' };
}

function readAccessibility(value: unknown): ComponentTemplate['accessibility'] {
  const row = record(value, 'accessibility');
  fields(row, ['notes', 'keyboard', 'aria']);
  return {
    notes: text(row.notes, 'accessibility notes', 2000),
    keyboard: strings(row.keyboard, 'keyboard guidance', 24),
    aria: strings(row.aria, 'ARIA guidance', 24),
  };
}

interface TemplateIdentity {
  id: string;
  version: string;
  templateType: ComponentTemplateType;
  atomicLevel: AtomicLevel;
  states: string[];
}
function readIdentity(row: Record<string, unknown>): TemplateIdentity {
  requireSketch(row.schemaVersion === 1, 'TEMPLATE_VERSION', 'Unsupported component-template schemaVersion; expected 1.');
  const version = text(row.version, 'version', 40);
  requireSketch(/^\d+\.\d+\.\d+$/.test(version), 'TEMPLATE_INVALID', 'Template version must be semantic x.y.z.');
  requireSketch(TEMPLATE_TYPES.includes(row.templateType as ComponentTemplateType), 'TEMPLATE_INVALID', 'Unknown template type.');
  requireSketch(ATOMIC_LEVELS.includes(row.atomicLevel as AtomicLevel), 'TEMPLATE_INVALID', 'Unknown atomic level.');
  const atomicLevel = row.atomicLevel as AtomicLevel, templateType = row.templateType as ComponentTemplateType;
  const id = identifier(row.id), states = strings(row.states, 'state', 8);
  requireSketch(id.startsWith(atomicLevel + '.'), 'TEMPLATE_INVALID',
    'Template ID prefix must match its Atomic Design level: ' + atomicLevel + '.*.');
  requireSketch(states.every(state => VISUAL_STATES.some(candidate => candidate === state)), 'TEMPLATE_INVALID',
    'Template states must use the visual IR state vocabulary.');
  return { id, version, templateType, atomicLevel, states };
}
function validateTemplateShape(
  atomicLevel: AtomicLevel,
  templateType: ComponentTemplateType,
  children: readonly TemplateChild[],
  slots: readonly TemplateSlot[],
  design: TemplateDesign,
): void {
  const pageType = templateType.startsWith('page');
  requireSketch(pageType === (atomicLevel === 'page'), 'TEMPLATE_INVALID', 'Only page templates use the page atomic level.');
  if (atomicLevel === 'atom') requireSketch(templateType === 'component', 'TEMPLATE_INVALID',
    'Atoms are leaf components and cannot declare child or brick composition.');
  if (templateType === 'page-with-bricks') requireSketch(slots.length > 0, 'TEMPLATE_INVALID',
    'A page-with-bricks template needs at least one named slot.');
  if (templateType === 'component-with-children') requireSketch(children.length > 0 || slots.length > 0, 'TEMPLATE_INVALID',
    'A component-with-children template needs children or slots.');
  if (templateType === 'component') requireSketch(children.length === 0 && slots.length === 0, 'TEMPLATE_INVALID',
    'A component template cannot declare children or bricks; use component-with-children.');
  if (templateType === 'page') requireSketch(slots.length === 0, 'TEMPLATE_INVALID',
    'A page template cannot declare bricks; use page-with-bricks.');
  if (pageType) requireSketch(design.kind === 'page' || design.kind === 'recipe', 'TEMPLATE_INVALID',
    'Page templates use page or recipe designs.');
  else requireSketch(design.kind !== 'page', 'TEMPLATE_INVALID', 'Component templates cannot use a page design.');
}
export function validateComponentTemplate(value: unknown): ComponentTemplate {
  const row = record(value);
  fields(row, ['$schema', 'schemaVersion', 'id', 'name', 'version', 'templateType', 'atomicLevel', 'category', 'description',
    'tags', 'recommendedFor', 'useWhen', 'avoidWhen', 'capabilities', 'states', 'props', 'events', 'children', 'slots', 'design', 'accessibility']);
  const identity = readIdentity(row), children = readChildren(row.children), slots = readSlots(row.slots), design = readDesign(row.design);
  validateTemplateShape(identity.atomicLevel, identity.templateType, children, slots, design);
  return {
    schemaVersion: 1,
    ...(row.$schema === undefined ? {} : { $schema: text(row.$schema, '$schema', 500) }),
    ...identity,
    name: text(row.name, 'name', 120),
    category: text(row.category, 'category', 120),
    description: text(row.description, 'description', 2000),
    tags: strings(row.tags, 'tag'),
    recommendedFor: strings(row.recommendedFor, 'recommendedFor'),
    useWhen: strings(row.useWhen, 'useWhen'),
    avoidWhen: strings(row.avoidWhen, 'avoidWhen'),
    capabilities: strings(row.capabilities, 'capability'),
    props: readProps(row.props),
    events: readEvents(row.events),
    children,
    slots,
    design,
    accessibility: readAccessibility(row.accessibility),
  };
}

export function validateComponentTemplateCatalog(templates: readonly ComponentTemplate[]): void {
  const byId = new Map<string, ComponentTemplate>();
  for (const template of templates) {
    requireSketch(!byId.has(template.id), 'TEMPLATE_DUPLICATE', 'Duplicate component template ' + template.id + '.');
    byId.set(template.id, template);
  }
  const rank: Record<AtomicLevel, number> = { atom: 0, molecule: 1, organism: 2, template: 3, page: 4 };
  for (const template of templates) {
    for (const child of template.children) {
      const target = byId.get(child.template);
      requireSketch(target, 'TEMPLATE_REFERENCE', template.id + ' references missing template ' + child.template + '.');
      requireSketch(!target.templateType.startsWith('page'), 'TEMPLATE_REFERENCE', 'Pages cannot be nested as component-template children.');
      requireSketch(rank[target.atomicLevel] < rank[template.atomicLevel], 'TEMPLATE_REFERENCE',
        template.id + ' must compose lower Atomic Design levels, not ' + target.atomicLevel + '.');
      if (child.slot !== undefined) {
        const slot = template.slots.find(candidate => candidate.id === child.slot);
        requireSketch(slot, 'TEMPLATE_REFERENCE', template.id + ' places a child in unknown slot ' + child.slot + '.');
        requireSketch(slot.accepts.includes(target.id) || slot.accepts.includes(target.atomicLevel) || slot.accepts.includes(target.templateType),
          'TEMPLATE_REFERENCE', template.id + ' slot ' + child.slot + ' does not accept ' + target.id + '.');
      }
    }
  }
  const done = new Set<string>();
  const active = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    requireSketch(!active.has(id), 'TEMPLATE_CYCLE', 'Component-template dependency cycle at ' + id + '.');
    active.add(id);
    for (const child of byId.get(id)!.children) visit(child.template);
    active.delete(id);
    done.add(id);
  };
  templates.forEach(template => visit(template.id));
}


export function componentTemplateSchema(): Record<string, unknown> {
  return buildComponentTemplateSchema(TEMPLATE_TYPES, ATOMIC_LEVELS, idPattern, keyPattern);
}
