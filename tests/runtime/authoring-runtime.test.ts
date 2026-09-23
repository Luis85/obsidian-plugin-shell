import { expect, it, vi } from 'vitest';
import { createAuthoringRuntime } from '../../src/application/authoring';
import { authoringFixture } from './authoring-fixture';

it('owns extension cleanup once in reverse order and observes independent failures', async () => {
  const f = await authoringFixture(); const order: string[] = [];
  const runtime = createAuthoringRuntime([
    () => ({ commands: [], dispose() { order.push('first'); } }),
    () => ({ commands: [], ribbons: [], dispose() { order.push('second'); throw new Error('cleanup'); } }),
  ], f.services);
  expect(runtime.groups).toEqual([{ commands: [] }, { commands: [], ribbons: [] }]);
  runtime.dispose(); runtime.dispose();
  expect(order).toEqual(['second', 'first']);
  expect(f.services.diagnostics.report).toHaveBeenCalledExactlyOnceWith('authoring.cleanup', 'runtime.dispose');
  f.dispose();
});
it('rolls back initialized owners when a later factory fails', async () => {
  const f = await authoringFixture(); const release = vi.fn();
  expect(() => createAuthoringRuntime([
    () => ({ commands: [], dispose: release }),
    () => { throw new Error('factory failure'); },
  ], f.services)).toThrow('factory failure');
  expect(release).toHaveBeenCalledOnce(); f.dispose();
});
it('cleans malformed synchronous owners and rejects null extensions', async () => {
  const f = await authoringFixture(); const dispose = vi.fn();
  // @ts-expect-error The runtime also fails closed for unchecked external developer code.
  expect(() => createAuthoringRuntime([() => ({ commands: null, dispose })], f.services)).toThrow('AUTHORING_INVALID_EXTENSION');
  expect(dispose).toHaveBeenCalledOnce();
  // @ts-expect-error Null is not an authoring extension.
  expect(() => createAuthoringRuntime([() => null], f.services)).toThrow('AUTHORING_INVALID_EXTENSION');
  // @ts-expect-error A malformed optional ribbon group is rejected before command wiring.
  expect(() => createAuthoringRuntime([() => ({ commands: [], ribbons: {}, dispose })], f.services)).toThrow('AUTHORING_INVALID_EXTENSION');
  expect(() => createAuthoringRuntime([() => ({ get commands(): never { throw new Error('malformed getter'); }, dispose })], f.services)).toThrow('malformed getter');
  expect(dispose).toHaveBeenCalledTimes(3);
  f.dispose();
});
it('observes rejected asynchronous factories and releases fulfilled asynchronous owners', async () => {
  const f = await authoringFixture(); const dispose = vi.fn();
  // @ts-expect-error Async factories are deliberately outside the synchronous registration contract.
  expect(() => createAuthoringRuntime([async () => ({ commands: [], dispose })], f.services)).toThrow('AUTHORING_ASYNC_FACTORY');
  await Promise.resolve(); expect(dispose).toHaveBeenCalledOnce();
  // @ts-expect-error Rejected async factory promises must still be observed independently.
  expect(() => createAuthoringRuntime([async () => { throw new Error('rejected'); }], f.services)).toThrow('AUTHORING_ASYNC_FACTORY');
  await Promise.resolve(); expect(f.services.diagnostics.report).toHaveBeenCalledWith('authoring.factory', 'runtime.initialize');
  f.dispose();
});
