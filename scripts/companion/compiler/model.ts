import { matches, type Schema } from '../runtime/contract.ts';
import { createHash } from 'node:crypto';
import { validateCompanionDocument, companionRelativeFolder } from '../project-contract.mjs';
export type Row = Record<string, unknown>;
export interface Entity { id: string; slug: string; name: string; folder: string; schema: Schema }
export interface Operation { id: string; slug: string; name: string; direction: string; input: Schema | null; output: Schema | null; contract: Row }
export interface Source { id: string; slug: string; name: string; kind: string; operations: Operation[]; contract: Row }
export interface Screen { id: string; slug: string; label: string; kind: string; parent: string | null; nav: boolean; entry: boolean; command: boolean; ribbon: boolean; goal: string; components: string[] }
export interface Requirement { id: string; key: string; title: string; acceptance: string; prd: string; nodes: string[]; components: string[] }
export interface Model { document: Row; project: Row; sourceRoot: string; testRoot: string; entities: Entity[]; sources: Source[]; screens: Screen[]; links: Row[]; components: Row[]; requirements: Requirement[]; flows: Row[]; warnings: string[] }
export const digest = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
export { serializeJson as json } from '../../contracts/serialization.ts';
export const literal = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export const symbol = (slug: string) => 'G' + slug.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join('');
export function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error('GENERATOR_INVALID: ' + message); }
export function row(value: unknown): Row { requireValue(value && typeof value === 'object' && !Array.isArray(value), 'Expected object.'); return value as Row; }
export function text(value: unknown, max = 1000): string { requireValue(typeof value === 'string' && value.length <= max, 'Expected bounded text.'); return value; }
export function rows(value: unknown, max = 200): Row[] { requireValue(Array.isArray(value) && value.length <= max, 'Expected bounded collection.'); return value.map(row); }
function slug(value: unknown): string { const name = text(value, 60); requireValue(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) && !['constructor','prototype'].includes(name) && companionRelativeFolder(name), 'Unsafe or missing slug: ' + name); return name; }
function unique<T>(items: T[], key: (item: T) => string): void { const seen = new Set<string>(); for (const item of items) { const id = key(item).toLowerCase(); requireValue(!seen.has(id), 'Duplicate identity: ' + id); seen.add(id); } }
function names(value: unknown): string[] { requireValue(Array.isArray(value), 'Expected references.'); return value.map(v => text(v, 120)); }
function fieldName(value: unknown): string { const key = text(value, 60); requireValue(/^[A-Za-z][A-Za-z0-9_-]*$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key), 'Unsafe property name.'); return key; }
export function schema(value: unknown, depth = 0, budget = { count: 0 }): Schema {
  requireValue(depth <= 6 && ++budget.count <= 120, 'Schema exceeds its complexity limit.');
  const v = row(value); const types = Array.isArray(v.type) ? v.type : [v.type];
  requireValue(types.length > 0 && types.length <= 7 && types.every(t => ['string','number','integer','boolean','object','array','null'].includes(String(t))), 'Unsupported schema type.');
  requireValue(Object.keys(v).every(k => ['$schema','type','properties','required','additionalProperties','items','description','format','enum'].includes(k)), 'Unsupported JSON Schema keyword; no silent weakening.');
  requireValue(!Array.isArray(v.type) || types.every(t => !['object','array'].includes(String(t))), 'Only primitive schema unions are supported.');
  const out: Schema = { type: types.length === 1 ? String(types[0]) : types.map(String) };
  if (v.enum !== undefined) { requireValue(Array.isArray(v.enum) && v.enum.length > 0 && v.enum.length <= 30 && v.enum.every(item => item === null || ['string','number','boolean'].includes(typeof item)), 'Invalid enum.'); out.enum = v.enum; }
  if (v.format !== undefined) { requireValue(v.type === 'string' && ['date','date-time','uuid','email','uri'].includes(String(v.format)), 'Unsupported string format.'); out.format = String(v.format); }
  if (v.type === 'object') {
    const props = row(v.properties ?? {}); requireValue(Object.keys(props).length <= 40, 'Too many schema properties.');
    out.properties = Object.fromEntries(Object.entries(props).map(([k,s]) => [fieldName(k), schema(s, depth + 1, budget)]));
    out.required = names(v.required ?? []); requireValue(out.required.every(k => Object.hasOwn(out.properties!, k)), 'Missing required property definition.');
    requireValue(v.additionalProperties === undefined || typeof v.additionalProperties === 'boolean', 'Unsupported additionalProperties schema.');
    out.additionalProperties = v.additionalProperties !== false;
  } else requireValue(v.properties === undefined && v.required === undefined && v.additionalProperties === undefined, 'Object constraints on non-object.');
  if (v.type === 'array') out.items = schema(v.items, depth + 1, budget);
  else requireValue(v.items === undefined, 'Array constraints on non-array.');
  requireValue(!out.enum || out.enum.every(item => matches(item,{...out,enum:undefined})), 'Enum does not match its type/format.');
  return out;
}
function entities(design: Row): Entity[] {
  const semantic = row(design.semantic ?? {}); const relations = rows(semantic.relationships ?? [], 120);
  const result = rows(semantic.entities ?? [], 60).map(e => {
    const properties: Record<string, Schema> = { id: { type: 'string' }, type: { type: 'string', enum:[slug(e.slug)] } }; const required = ['id','type'];
    for (const p of rows(e.properties ?? [], 40)) {
      const key = fieldName(p.key); requireValue(!Object.hasOwn(properties, key), 'Duplicate/reserved entity property: ' + key);
      const type = { text:'string', number:'number', checkbox:'boolean', date:'string', datetime:'string', tags:'array', list:'array' }[String(p.type)];
      requireValue(type, 'Unsupported entity property type.'); requireValue(typeof p.required === 'boolean', 'Invalid required flag.');
      properties[key] = type === 'array' ? { type, items: { type: p.type === 'list' ? ['string','number'] : 'string' } } : { type, ...(p.type === 'date' ? { format:'date' } : p.type === 'datetime' ? { format:'date-time' } : {}) };
      if (p.required) required.push(key);
    }
    for (const r of relations.filter(r => r.source === e.id)) {
      const key = fieldName(r.key); requireValue(!Object.hasOwn(properties, key), 'Relationship/property collision.');
      requireValue(['0..1','1','1..1','0..*','1..*'].includes(String(r.targetCard)), 'Unsupported relationship cardinality.');
      properties[key] = String(r.targetCard).endsWith('*') ? { type:'array', items:{type:'string'} } : {type:'string'};
      if (String(r.targetCard).startsWith('1')) required.push(key);
    }
    const folder = text(e.folder, 120); requireValue(folder === '' || companionRelativeFolder(folder), 'Unsafe entity folder.');
    return { id:text(e.id,120), slug:slug(e.slug), name:text(e.name,80), folder, schema:{type:'object', properties, required, additionalProperties:true} };
  });
  unique(result, e => e.id); unique(result, e => e.slug);
  requireValue(relations.every(r => result.some(e => e.id === r.source) && result.some(e => e.id === r.target)), 'Dangling relationship.');
  return result;
}
function shape(value: unknown, entities: Entity[]): Schema | null {
  const s = row(value); requireValue(typeof s.many === 'boolean', 'Shape must declare multiplicity.'); let out: Schema;
  if (s.mode === 'none') { requireValue(!s.many, 'No-payload shape cannot be a collection.'); return null; }
  requireValue(s.mode !== 'unspecified', 'Finish unspecified source shapes before generating.');
  if (s.mode === 'schema') { requireValue(!s.many, 'Schema controls its own array multiplicity.'); return schema(s.schema); }
  if (s.mode === 'entity') { const e = entities.find(e => e.id === s.entity); requireValue(e, 'Missing source entity.'); out = e.schema; }
  else {
    requireValue(s.mode === 'fields', 'Unsupported shape mode.'); const fields = rows(s.fields,40); requireValue(fields.every(f=>typeof f.required==='boolean'),'Invalid field required flag.'); unique(fields, f => fieldName(f.name));
    out = { type:'object', properties:Object.fromEntries(fields.map(f => { const type = text(f.type); return [fieldName(f.name), schema({type, ...(type === 'array' ? {items:{type:'string'}} : {})})]; })), required:fields.filter(f => f.required === true).map(f => fieldName(f.name)), additionalProperties:true };
  }
  return s.many ? { type:'array',items:out } : out;
}
export function projectModel(input: unknown): Model {
  const document = row(validateCompanionDocument(input)); const design = row(document.design); const project = row(document.project); const settings = row(document.settings);
  const sourceRoot = text(settings.codebaseFolder) + '/generated'; const testRoot = text(settings.testsFolder) + '/project';
  requireValue(!['scripts','docs','harness','node_modules','dist'].some(p => [String(settings.codebaseFolder),String(settings.testsFolder)].some(f => f === p || f.startsWith(p+'/'))), 'Generated roots overlap framework tooling.');
  const entityModels = entities(design); const components = rows(design.library); unique(components, c => slug(c.id)); for (const c of components) { text(c.name,120); text(c.description ?? '',10000); }
  const screens = rows(design.nodes,60).map(n => ({ id:text(n.id,120), slug:slug(n.slug), label:text(n.label,120), kind:text(n.kind,40), parent:n.parent === null ? null : text(n.parent,120), nav:n.nav === true, entry:n.entry === true, command:n.command === true, ribbon:n.ribbon === true, goal:text(n.goal ?? ''), components:rows(n.components ?? [],60).map(c => text(c.id,120)) }));
  unique(screens, n => n.slug); unique(screens,n=>symbol(n.slug)); requireValue(screens.some(n=>!['group','action','modal'].includes(n.kind)), 'Declare at least one navigable screen.');
  for (const n of screens) {
    requireValue(['view','page','modal','settings','action','group'].includes(n.kind), 'Unsupported surface kind: ' + n.kind);
    requireValue(n.parent === null || screens.some(p => p.id === n.parent), 'Dangling screen parent.');
    requireValue(n.components.every(id => components.some(c => c.id === id)), 'Missing component reference.');
    const visited = new Set([n.id]); let p = n.parent;
    while (p) { requireValue(!visited.has(p), 'Cyclic screen containment.'); visited.add(p); p = screens.find(s => s.id === p)!.parent; }
  }
  const links = rows(design.links,120).map(l => ({id:text(l.id,120),from:text(l.from,120),to:text(l.to,120),kind:text(l.kind,80),label:text(l.label ?? '',500)})); unique(links,l=>l.id); requireValue(links.every(l => screens.some(s => s.id === l.from) && screens.some(s => s.id === l.to)), 'Dangling interaction endpoint.');
  const ds = row(design.dataSources ?? {}); const sources = rows(ds.sources ?? [],24).map(s => {
    requireValue(['vault','api','database'].includes(String(s.kind)), 'Unsupported source adapter kind.');
    const operations = rows(s.operations,12).map(o => ({ id:text(o.id,120), slug:slug(o.slug), name:text(o.name,80), direction:text(o.direction,10), input:shape(o.input,entityModels), output:shape(o.output,entityModels), contract:o }));
    requireValue(operations.every(o => ['read','write','both'].includes(o.direction)), 'Unsupported operation direction.'); unique(operations,o => o.slug); unique(operations,o=>symbol(o.slug)); unique(operations,o => o.id);
    return { id:text(s.id,120), slug:slug(s.slug), name:text(s.name,80), kind:String(s.kind), operations, contract:s };
  });
  unique(sources,s => s.slug); unique(sources,s=>symbol(s.slug)); unique(sources,s => s.id); const flows = rows(ds.flows ?? [],120).map(f=>({...f,source:text(f.source,120),operation:text(f.operation,120),id:text(f.id,120),card:text(f.card,120),label:text(f.label ?? '',500),trigger:text(f.trigger,80),direction:text(f.direction,10)})); unique(flows,f=>f.id);
  requireValue(flows.every(f => screens.some(n => n.id === f.card) && sources.some(s => s.id === f.source && s.operations.some(o => o.id === f.operation && (o.direction === f.direction || o.direction === 'both')))), 'Dangling or incompatible source flow.');
  const requirements = rows(design.prds,12).flatMap(p => rows(p.requirements ?? [],100).map(r => ({ id:text(r.id,120), key:'req-'+digest(text(p.id)+':'+text(r.id)).slice(0,12), title:text(r.title,500), acceptance:text(r.acceptance ?? '',10000), prd:text(p.id,120), nodes:names(r.nodes ?? []), components:names(r.components ?? []) })));
  unique(requirements,r => r.key);
  requireValue(requirements.every(r => r.nodes.every(id => screens.some(n => n.id === id)) && r.components.every(id => components.some(c => c.id === id))), 'Dangling requirement reference.');
  return {document,project,sourceRoot,testRoot,entities:entityModels,sources,screens,links,components,requirements,flows,warnings:[
    'Source adapters and PRD business behavior require implementation; generated passing tests verify scaffolding only.',
    'Complex component layouts, editor engines, relationship enforcement and source-flow payload mapping remain explicit extension points.',
    ...(design.detailDesigns ? ['Page/component detail designs compile to Vue layouts, state visibility, typed instances and safe source projections. Business acceptance and payload mapping still require implementation.'] : []),
    'Framework internals remain in src/tests; configured folders locate generated product code and product tests.',
  ]};
}
