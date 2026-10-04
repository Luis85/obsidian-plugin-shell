import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachRuntimeObservation, assertIndependentObservation, observedResources } from '../../scripts/testing/native-runtime-observation.mjs';

function fixture() {
  const state = { sequence: 0, errors: 0, resources: 0, observerFailures: 0 };
  let listener; let stops = 0;
  const observation = { snapshot: () => ({ ...state }), subscribe(callback) { listener = callback; return () => { listener = undefined; stops++; }; } };
  const previous = globalThis.window;
  globalThis.window = { app: { plugins: { plugins: { fixture: { runtime: { observation } } } } } };
  const ledger = attachRuntimeObservation('fixture');
  const emit = (kind, entry, deliver = true) => {
    state[kind === 'error' ? 'errors' : 'resources']++;
    const event = { sequence: ++state.sequence, kind, entry };
    if (deliver) listener?.(event);
  };
  return { ledger, state, emit, stops: () => stops, restore() { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; } };
}
const notice = { resource: 'notice', owner: 'first', operation: 'feedback', id: 1, count: 1 };
const fault = { sequence: 1, code: 'settings.write', operation: 'settings.save' };

test('native read-only subscriber independently preserves exact faults, resources and complete event continuity', () => {
  const f = fixture();
  try {
    f.emit('lifecycle', { ...notice, phase: 'acquired' }); f.emit('error', fault);
    assertIndependentObservation(f.ledger.read(), [{ code: fault.code, operation: fault.operation }]);
    assert.deepEqual(observedResources(f.ledger.read()), [{ ...notice, phase: 'acquired' }]);
    f.emit('lifecycle', { ...notice, phase: 'released' });
    assert.deepEqual(observedResources(f.ledger.read()), []);
    const read = f.ledger.read(); read.events.length = 0;
    assert.equal(f.ledger.read().events.length, 3);
    f.ledger.stop(); assert.equal(f.stops(), 1);
  } finally { f.restore(); }
});

test('native qualification rejects unexpected faults, missing delivery, subscriber failure and orphan release', () => {
  for (const defect of ['fault', 'delivery', 'subscriber', 'release']) {
    const f = fixture();
    try {
      if (defect === 'fault') f.emit('error', fault);
      if (defect === 'delivery') { f.emit('lifecycle', { ...notice, phase: 'acquired' }, false); f.emit('lifecycle', { ...notice, phase: 'released' }); }
      if (defect === 'subscriber') f.state.observerFailures++;
      if (defect === 'release') f.emit('lifecycle', { ...notice, phase: 'released' });
      assert.throws(() => defect === 'release' ? observedResources(f.ledger.read()) : assertIndependentObservation(f.ledger.read()));
    } finally { f.restore(); }
  }
});

test('native ledger cap is explicit failed evidence rather than silent diagnostic truncation', () => {
  const f = fixture();
  try {
    for (let index = 0; index < 4097; index++) f.emit('error', { ...fault, sequence: index + 1 });
    const snapshot = f.ledger.read();
    assert.equal(snapshot.events.length, 4096); assert.equal(snapshot.lost, 1); assert.equal(snapshot.current.errors, 4097);
    assert.throws(() => assertIndependentObservation(snapshot, snapshot.events.map(event => ({ code: event.entry.code, operation: event.entry.operation }))));
  } finally { f.restore(); }
});
