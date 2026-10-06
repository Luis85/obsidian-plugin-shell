import type { Mapping, VisualAction, EmitDefinition, Interaction, UiNode } from '../../../../scripts/companion/visual/visual-ir.mjs';
import { visualAssert, visualNodes, visualRoot } from '../../../../scripts/companion/visual/visual-ir.mjs';
import { visualSession, visualVisible } from '../../../../scripts/companion/visual/visual-session.mjs';
import { visualExpressions, type VisualSpec } from '../../../../templates/companion/runtime/visual-runtime.ts';
import { matches, type Schema } from '../../../../templates/companion/runtime/contract.ts';
import { literal, symbol, type Model, type Operation, type Source } from './model.ts';
import type { Add } from './file-code.ts';
import { visualSpecs } from './visual-model.ts';

/** A source operation referenced by a visual definition: a read binding, a mapped field or a source action. */
export interface VisualSourceUse { source: Source; operation: Operation }
interface Scope { m: Model; uses: Map<string, VisualSourceUse>; emits: EmitDefinition[] | null }
const vpUnsafe = new Set(['__proto__', 'prototype', 'constructor']);

const vpKey = /^(?:[A-Za-z][A-Za-z0-9_-]*|0|[1-9][0-9]*)$/;
/** The declared schema one path segment selects: an array index or an own object property. */
function vpChild(schema: Schema, key: string): Schema | null {
  if (schema.type === 'array' && /^\d+$/.test(key)) return schema.items ?? null;
  return schema.type === 'object' ? schema.properties?.[key] ?? null : null;
}
/** A dotted own-data path must resolve inside the declared output schema; unknown or inherited keys never resolve. */
function vpField(schema: Schema | null, field: string): boolean {
  if (field === '') return schema !== null;
  for (const key of field.split('.')) {
    if (!vpKey.test(key) || vpUnsafe.has(key) || !schema) return false;
    schema = vpChild(schema, key);
  }
  return schema !== null;
}
function vpOperation(scope: Scope, sourceId: string, operationId: string, where: string): VisualSourceUse {
  const source = scope.m.sources.find(s => s.id === sourceId), operation = source?.operations.find(o => o.id === operationId);
  visualAssert(source && operation, `${where}: unknown source operation ${sourceId}/${operationId}.`);
  const use = { source, operation }; scope.uses.set(sourceId + '\u0000' + operationId, use); return use;
}
function vpRead(scope: Scope, ref: { sourceId: string; operationId: string; field: string }, where: string): void {
  const { operation } = vpOperation(scope, ref.sourceId, ref.operationId, where), name = `${ref.sourceId}/${ref.operationId}`;
  visualAssert(operation.direction !== 'write', `${where}: ${name} is write-only and cannot be read.`);
  visualAssert(vpField(operation.output, ref.field), `${where}: field ${JSON.stringify(ref.field)} is not in the output of ${name}.`);
}
function vpMapping(scope: Scope, mapping: Mapping, where: string): void {
  if (mapping.kind === 'source') vpRead(scope, mapping, where);
  if (mapping.kind === 'object') for (const field of Object.values(mapping.fields)) vpMapping(scope, field, where);
}
/** An object mapping must supply every required input field and only declared fields of a closed input. */
function vpObjectInput(input: Schema | null, fields: Record<string, Mapping>, name: string, where: string): void {
  visualAssert(input?.type === 'object' && (input.required ?? []).every(key => Object.hasOwn(fields, key)), `${where}: mapped input omits required fields of ${name}.`);
  visualAssert(input.additionalProperties !== false || Object.keys(fields).every(key => Object.hasOwn(input.properties ?? {}, key)), `${where}: mapped input has fields ${name} does not declare.`);
}
function vpSourceAction(scope: Scope, action: VisualAction & { kind: 'source' }, where: string): void {
  const { operation } = vpOperation(scope, action.sourceId, action.operationId, where), input = operation.input, mapping = action.input;
  const name = `${action.sourceId}/${action.operationId}`;
  vpMapping(scope, mapping, where);
  visualAssert((input === null) === (mapping.kind === 'none'), `${where}: ${name} ${input === null ? 'takes no input, so map none' : 'requires an input mapping'}.`);
  if (mapping.kind === 'value') visualAssert(matches(mapping.value, input), `${where}: literal input violates the input of ${name}.`);
  if (mapping.kind === 'object') vpObjectInput(input, mapping.fields, name, where);
}
function vpEmitAction(scope: Scope, action: VisualAction & { kind: 'emit' }, where: string): void {
  vpMapping(scope, action.payload, where);
  const emit = scope.emits?.find(e => e.name === action.event);
  if (!emit) return;
  visualAssert((emit.payloadType === 'void') === (action.payload.kind === 'none'), `${where}: emit ${action.event} payload presence does not match its ${emit.payloadType} contract.`);
  if (action.payload.kind === 'value' && emit.payloadType !== 'unknown') visualAssert(typeof action.payload.value === emit.payloadType, `${where}: emit ${action.event} literal is not a ${emit.payloadType}.`);
}
/** Explicit mappings must agree with the operation input and the declared emit payload before any UI can route them. */
function vpAction(scope: Scope, action: VisualAction, where: string): void {
  if (action.kind === 'source') vpSourceAction(scope, action, where);
  else if (action.kind === 'emit') vpEmitAction(scope, action, where);
}
/** An interaction whose source is hidden or disabled in every enabled state could never run. */
function vpReachable(spec: VisualSpec, nodeId: string): boolean {
  return (['default', 'empty', 'error'] as const).some(state => visualVisible(spec, { ...visualSession(), state }, nodeId));
}
const vpWhere = (spec: VisualSpec) => (spec.kind === 'page' ? `Page ${JSON.stringify(spec.name)}` : `Component ${JSON.stringify(spec.exportName)}`);

/** Scenario fixtures must match the declared output of the operation they stand in for. */
function vpScenarios(scope: Scope, spec: VisualSpec, owner: string): void {
  for (const scenario of spec.scenarios) for (const binding of scenario.bindings) {
    const { operation } = vpOperation(scope, binding.sourceId, binding.operationId, `${owner} scenario ${JSON.stringify(scenario.name)}`);
    visualAssert(matches(binding.value, operation.output), `${owner} scenario ${JSON.stringify(scenario.name)}: fixture for ${binding.sourceId}/${binding.operationId} does not match its output.`);
  }
}
/** Source reads, reachability and actions of one node. */
function vpNode(scope: Scope, spec: VisualSpec, node: UiNode, owner: string): void {
  const where = `${owner} / ${node.name || node.id}`;
  for (const expr of visualExpressions(node)) if (expr.kind === 'source') vpRead(scope, expr, where);
  const events: Interaction[] = 'events' in node ? node.events : [];
  if (events.length) visualAssert(vpReachable(spec, node.id), `${where}: interaction source has no enabled visible state.`);
  for (const interaction of events) for (const action of interaction.actions) vpAction(scope, action, `${where} → ${interaction.label}`);
}
/** Validates every source reference and mapping against the model schemas and returns the referenced operations. */
export function visualSources(m: Model, specs: VisualSpec[] = visualSpecs(m)): VisualSourceUse[] {
  const uses = new Map<string, VisualSourceUse>();
  for (const spec of specs) {
    const scope: Scope = { m, uses, emits: spec.kind === 'component' ? spec.emits : null }, owner = vpWhere(spec);
    vpScenarios(scope, spec, owner);
    for (const node of visualNodes(visualRoot(spec))) vpNode(scope, spec, node, owner);
  }
  return [...uses.values()];
}

/** Bootstrap context: one Pinia-backed port per referenced source operation, navigation and the interaction hooks. */
export function visualPorts(m: Model, add: Add): void {
  const imports = new Set<string>(); const stores = new Set<string>(); const entries: string[] = [];
  for (const { source, operation: op } of visualSources(m)) {
    const name = symbol(source.slug);
    imports.add(`import { define${name}Store } from '../presentation/stores/${source.slug}.ts';`);
    imports.add(`import * as ${name}Contracts from '../application/${source.slug}/contracts.ts';`);
    stores.add(`const ${name} = define${name}Store(sources[${literal(source.slug)}])(pinia);`);
    const state = `${name}[${literal(op.slug)}]`;
    entries.push(`{ sourceId: ${literal(source.id)}, operationId: ${literal(op.id)}, direction: ${literal(op.direction)}, requiresInput: ${op.input !== null},
get data() { return ${state}.data; }, get pending() { return ${state}.pending; }, get error() { return ${state}.error; },
async run(input) { if (!${name}Contracts.is${symbol(op.slug)}Input(input)) throw new Error('INVALID_INPUT'); return ${state}.execute(input); } }`);
  }
  add(`${m.sourceRoot}/bootstrap/visual-context.ts`, `${[...imports].join('\n')}
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { VisualContext } from '../presentation/composables/use-visual.ts';
import { screens } from '../domain/screens.ts';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { handleVisualInteraction } from '../application/visual-interactions.ts';
export function createVisualContext(sources: Sources, pinia: Pinia, openModal: (id: string) => void): VisualContext {
${[...stores].join('\n')}
const navigation = useNavigation(pinia);
return { ports: [${entries.join(',\n')}], handle: request => handleVisualInteraction(request, sources), navigate(target) {
  const screen = screens.find(s => s.id === target); if (!screen || ['action', 'group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
  if (screen.kind === 'modal') openModal(target); else navigation.open(target);
} };
}
`, 'managed');
}
