// Deterministic preview/runtime session over one visual definition. No DOM or I/O.
import { visualAssert, visualIsPlain, visualChildLists, visualRoot, visualLocate, visualWalk } from './visual-ir.mjs';
export function visualSession(scenario = null) { return { state: scenario?.state || 'default', width: scenario?.width || 'wide', values: structuredClone(scenario?.values || {}), bindings: structuredClone(scenario?.bindings || []), hidden: {}, focused: null, emitted: [], navigation: null, requests: [] }; }
function vsesChain(root, nodeId) {
  const walk = (list, path) => { for (const n of list) { if (n.id === nodeId) return [...path, n]; for (const l of visualChildLists(n)) { const hit = walk(l, [...path, n]); if (hit) return hit; } } return null; };
  return walk(root, []);
}
export function visualVisible(definition, session, nodeId) {
  const chain = vsesChain(visualRoot(definition), nodeId); if (!chain) return false;
  return chain.every(n => session.hidden[n.id] !== true && (!n.visibleIn || n.visibleIn.includes(session.state)) && !(session.width === 'narrow' && n.layout?.ui.narrow.hidden));
}
export function visualTransition(definition, session, nodeId, interactionId) {
  const node = visualLocate(visualRoot(definition), nodeId)?.node, interaction = node?.events?.find(i => i.id === interactionId);
  visualAssert(node && interaction, 'The interaction no longer exists.');
  visualAssert(!['loading', 'disabled'].includes(session.state) && visualVisible(definition, session, nodeId), 'Interaction source is not enabled and visible.');
  if (!interaction.actions.length) throw Error('IMPLEMENTATION_REQUIRED: ' + interaction.label);
  const next = structuredClone(session);
  for (const a of interaction.actions) {
    if (a.kind === 'set-state') next.state = a.state;
    else if (a.kind === 'toggle') next.hidden[a.nodeId] = !next.hidden[a.nodeId];
    else if (a.kind === 'set-value') next.values[a.nodeId] = a.value;
    else if (a.kind === 'focus') { visualAssert(visualVisible(definition, next, a.nodeId), 'Focus target is hidden in this state.'); next.focused = a.nodeId; }
    else if (a.kind === 'navigate') next.navigation = a.surfaceId;
    else if (a.kind === 'emit') next.emitted.push({ name: a.event, source: nodeId, ...(a.payload.kind === 'value' ? { payload: a.payload.value } : {}) });
    else if (a.kind === 'source') next.requests.push({ sourceId: a.sourceId, operationId: a.operationId, interactionId });
    else visualAssert(false, 'Unsupported action.');
  }
  return next;
}
export function visualRead(value, field) {
  if (!field) return value;
  for (const key of field.split('.')) { if (['__proto__', 'constructor', 'prototype'].includes(key) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined; value = value[key]; }
  return value;
}
export function visualValue(session, expr, props = {}) {
  if (expr.kind === 'literal') return expr.value;
  if (expr.kind === 'prop') return Object.hasOwn(props, expr.name) ? props[expr.name] : undefined;
  if (expr.kind === 'state') return session.values[expr.nodeId];
  const fixture = session.bindings.find(b => b.sourceId === expr.sourceId && b.operationId === expr.operationId);
  return fixture ? visualRead(fixture.value, expr.field) : undefined;
}
export function visualTestSource(definition) {
  const safe = JSON.stringify(definition).replaceAll('<', '\\u003c'), cases = [], todos = [];
  visualWalk(visualRoot(definition), n => { for (const i of n.events ?? []) {
    const name = JSON.stringify('[' + i.id + '] ' + i.label);
    if (!i.actions.length) { todos.push(`test.todo(${JSON.stringify('[' + i.id + '] ' + i.label + ' — ' + (i.acceptance || i.notes || 'implementation required'))});`); continue; }
    const state = ['default', 'empty', 'error'].find(st => visualVisible(definition, { ...visualSession(), state: st }, n.id));
    cases.push(state ? `test(${name}, () => { const session = { ...visualSession(), state: ${JSON.stringify(state)} }; const before = JSON.stringify(session); const next = visualTransition(definition, session, ${JSON.stringify(n.id)}, ${JSON.stringify(i.id)}); assert.equal(JSON.stringify(session), before); assert.notEqual(JSON.stringify(next), before); });` : `test(${name}, () => { assert.fail('No enabled visible source state: repair this interaction'); });`);
  } });
  return `// Generated executable model tests. No claim of business outcomes or native UI acceptance.\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${[visualAssert, visualIsPlain, visualChildLists, visualRoot, visualWalk, visualLocate, visualSession, vsesChain, visualVisible, visualTransition].map(f => f.toString()).join('\n')}\nconst definition = ${safe};\n${cases.join('\n')}\n${todos.join('\n')}\n`;
}
