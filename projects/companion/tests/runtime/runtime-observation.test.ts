import { expect, it } from 'vitest';
import { createRuntimeObservation } from '../../src/infrastructure/runtime-observation';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import type { Diagnostic, LifecycleObservation } from '../../src/features/api';

it('FRAMEWORK-OBSERVE-01 delivers independent immutable faults and resources with explicit observer failures', () => {
  const runtime = createRuntimeObservation();
  expect(Object.keys(runtime.observation).sort()).toEqual(['snapshot', 'subscribe']);
  const seen: number[] = [];
  const stop = runtime.observation.subscribe(event => {
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.entry)).toBe(true);
    seen.push(event.sequence);
  });
  const bad = runtime.observation.subscribe(() => { throw new Error('observer'); });
  for (let index = 0; index < 205; index++) runtime.error({ sequence: index + 1, code: 'fault.safe', operation: 'test.observe' });
  bad();
  const acquired: LifecycleObservation = { resource: 'notice', phase: 'acquired', id: 1, owner: 'view', operation: 'feedback', count: 1 };
  runtime.lifecycle(acquired);
  expect(seen).toEqual(Array.from({ length: 206 }, (_, i) => i + 1));
  expect(runtime.observation.snapshot()).toEqual({ sequence: 206, errors: 205, resources: 1, observerFailures: 205 });
  stop();
  runtime.error({ sequence: 206, code: 'fault.safe', operation: 'test.observe' });
  expect(seen).toHaveLength(206);
  runtime.observation.subscribe(() => { throw new Error('disposed observer'); });
  runtime.dispose();
  const retainedStop = runtime.observation.subscribe(() => { throw new Error('retained disposed subscription'); });
  runtime.error({ sequence: 207, code: 'fault.safe', operation: 'test.observe' });
  expect(runtime.observation.snapshot().observerFailures).toBe(205);
  retainedStop();
});

it('FRAMEWORK-OBSERVE-02 honors unsubscribe during delivery without removing a sibling observer', () => {
  const runtime = createRuntimeObservation();
  let removed = 0;
  let sibling = 0;
  let stop = () => {};
  runtime.observation.subscribe(() => stop());
  stop = runtime.observation.subscribe(() => { removed++; });
  runtime.observation.subscribe(() => { sibling++; });
  runtime.error({ sequence: 1, code: 'fault.safe', operation: 'test.observe' });
  expect(removed).toBe(0);
  expect(sibling).toBe(1);
  expect(runtime.observation.snapshot().observerFailures).toBe(0);
});

it('FRAMEWORK-OBSERVE-03 counts rejected asynchronous observers even after unsubscription', async () => {
  const runtime = createRuntimeObservation();
  const stop = runtime.observation.subscribe(async () => { throw new Error('async observer'); });
  runtime.error({ sequence: 1, code: 'fault.safe', operation: 'test.observe' });
  stop();
  await Promise.resolve();
  expect(runtime.observation.snapshot()).toEqual({ sequence: 1, errors: 1, resources: 0, observerFailures: 1 });
});

it('FRAMEWORK-OBSERVE-04 contains a rejected fault observer without recursively reporting its own failure', async () => {
  const recorded: Diagnostic[] = [];
  const diagnostics = new Diagnostics(async entry => { recorded.push(entry); throw new Error('observer rejected'); });
  diagnostics.report('fault.safe', 'test.observe');
  await Promise.resolve();
  expect(recorded).toEqual([{ sequence: 1, code: 'fault.safe', operation: 'test.observe' }]);
  expect(diagnostics.current).toEqual(recorded);
  diagnostics.dispose();
});
