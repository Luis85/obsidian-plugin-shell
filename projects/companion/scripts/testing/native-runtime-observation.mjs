import { expect } from '@playwright/test';

/** Serialized into the renderer. State belongs to a driver JSHandle, never a production global. */
export function attachRuntimeObservation(id) {
  const observation = window.app.plugins.plugins[id].runtime.observation;
  const baseline = observation.snapshot();
  const events = []; let lost = 0; let sequenceGaps = 0; let lastSequence = baseline.sequence;
  const stop = observation.subscribe(event => {
    if (event.sequence !== lastSequence + 1) sequenceGaps++;
    lastSequence = event.sequence;
    if (events.length >= 4096) lost++;
    else events.push(event);
  });
  return { read: () => ({ baseline, current: observation.snapshot(), events: events.slice(), lost, sequenceGaps, lastSequence }), stop };
}

export function assertIndependentObservation(ledger, expectedErrors = []) {
  expect(ledger.baseline.errors).toBe(0); expect(ledger.baseline.observerFailures).toBe(0);
  expect(ledger.current.observerFailures).toBe(0);
  expect(ledger.lost).toBe(0); expect(ledger.sequenceGaps).toBe(0);
  expect(ledger.lastSequence).toBe(ledger.current.sequence);
  expect(ledger.events.length).toBe(ledger.current.sequence - ledger.baseline.sequence);
  const faults = ledger.events.filter(event => event.kind === 'error').map(event => ({ code: event.entry.code, operation: event.entry.operation }));
  expect(faults).toEqual(expectedErrors);
  expect(ledger.current.errors - ledger.baseline.errors).toBe(faults.length);
  expect(ledger.current.resources - ledger.baseline.resources).toBe(ledger.events.length - faults.length);
}

/** Only receipts acquired after attachment are owned by this experiment. */
export function observedResources(ledger) {
  const active = new Map();
  for (const event of ledger.events) {
    if (event.kind !== 'lifecycle') continue;
    const { resource, id, phase } = event.entry; const key = `${resource}:${id}`;
    if (phase === 'acquired') { expect(active.has(key)).toBe(false); active.set(key, event.entry); }
    else { expect(active.has(key)).toBe(true); active.delete(key); }
  }
  return [...active.values()];
}
