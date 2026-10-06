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
  const defName = definition.name ?? definition.exportName ?? definition.id;
  const elemName = node?.name ?? nodeId;
  visualAssert(node && interaction, `${defName} "${elemName}": The interaction no longer exists.`);
  visualAssert(!['loading', 'disabled'].includes(session.state) && visualVisible(definition, session, nodeId), `${defName} "${elemName}": Interaction source is not enabled and visible.`);
  if (!interaction.actions.length) throw Error('IMPLEMENTATION_REQUIRED: ' + interaction.label);
  const next = structuredClone(session);
  for (const a of interaction.actions) {
    if (a.kind === 'set-state') next.state = a.state;
    else if (a.kind === 'toggle') next.hidden[a.nodeId] = !next.hidden[a.nodeId];
    else if (a.kind === 'set-value') next.values[a.nodeId] = a.value;
    else if (a.kind === 'focus') { const focusTarget = visualLocate(visualRoot(definition), a.nodeId)?.node; const targetName = focusTarget?.name ?? a.nodeId; visualAssert(visualVisible(definition, next, a.nodeId), `${defName} "${targetName}": Focus target is hidden in this state.`); next.focused = a.nodeId; }
    else if (a.kind === 'navigate') next.navigation = a.surfaceId;
    else if (a.kind === 'emit') next.emitted.push({ name: a.event, source: nodeId, ...(a.payload.kind === 'value' ? { payload: a.payload.value } : {}) });
    else if (a.kind === 'source') next.requests.push({ sourceId: a.sourceId, operationId: a.operationId, interactionId });
    else visualAssert(false, `${defName} "${elemName}": Unsupported action.`);
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
// Each declared action's own effect is asserted, so idempotent effects (a reset to the current state) still pass.
function vsesExpected(actions) {
  const j = JSON.stringify, last = kind => actions.filter(a => a.kind === kind).at(-1), out = [];
  const state = last('set-state'); if (state) out.push(`assert.equal(next.state, ${j(state.state)});`);
  for (const id of new Set(actions.filter(a => a.kind === 'toggle').map(a => a.nodeId))) out.push(`assert.equal(next.hidden[${j(id)}] === true, ${actions.filter(a => a.kind === 'toggle' && a.nodeId === id).length % 2 === 1});`);
  for (const [id, value] of new Map(actions.filter(a => a.kind === 'set-value').map(a => [a.nodeId, a.value]))) out.push(`assert.deepEqual(next.values[${j(id)}], ${j(value)});`);
  const focus = last('focus'); if (focus) out.push(`assert.equal(next.focused, ${j(focus.nodeId)});`);
  const nav = last('navigate'); if (nav) out.push(`assert.equal(next.navigation, ${j(nav.surfaceId)});`);
  const emits = actions.filter(a => a.kind === 'emit').map(a => a.event); if (emits.length) out.push(`assert.deepEqual(next.emitted.map(e => e.name), ${j(emits)});`);
  const reads = actions.filter(a => a.kind === 'source').map(a => a.sourceId + '/' + a.operationId); if (reads.length) out.push(`assert.deepEqual(next.requests.map(r => r.sourceId + '/' + r.operationId), ${j(reads)});`);
  return out.join(' ');
}
export function visualTestSource(definition) {
  const safe = JSON.stringify(definition).replaceAll('<', '\\u003c'), cases = [], todos = [];
  visualWalk(visualRoot(definition), n => { for (const i of n.events ?? []) {
    const name = JSON.stringify('[' + i.id + '] ' + i.label);
    if (!i.actions.length) { todos.push(`test.todo(${JSON.stringify('[' + i.id + '] ' + i.label + ' — ' + (i.acceptance || i.notes || 'implementation required'))});`); continue; }
    const state = ['default', 'empty', 'error'].find(st => visualVisible(definition, { ...visualSession(), state: st }, n.id));
    cases.push(state ? `test(${name}, () => { const session = { ...visualSession(), state: ${JSON.stringify(state)} }; const before = JSON.stringify(session); const next = visualTransition(definition, session, ${JSON.stringify(n.id)}, ${JSON.stringify(i.id)}); assert.equal(JSON.stringify(session), before); ${vsesExpected(i.actions)} });` : `test(${name}, () => { assert.fail('No enabled visible source state: repair this interaction'); });`);
  } });
  return `// Generated executable model tests. No claim of business outcomes or native UI acceptance.\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${[visualAssert, visualIsPlain, visualChildLists, visualRoot, visualWalk, visualLocate, visualSession, vsesChain, visualVisible, visualTransition].map(f => f.toString()).join('\n')}\nconst definition = ${safe};\n${cases.join('\n')}\n${todos.join('\n')}\n`;
}
