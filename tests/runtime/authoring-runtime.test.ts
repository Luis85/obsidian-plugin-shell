import { expect, it, vi } from 'vitest';
import { createAuthoringRuntime } from '../../src/application/authoring';
import { authoringFixture } from './authoring-fixture';
import { booleanSettingFixture } from './boolean-setting-fixture';

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
it('initializes registered settings read-only and independently owns their disposal', async () => {
  const f = await authoringFixture(); const control = booleanSettingFixture();
  const runtime = createAuthoringRuntime([() => ({ commands: [], settings: [control.setting], dispose() {} })], f.services);
  await runtime.initialize(); expect(control.setting.value).toBe(false); expect(control.storage.save).not.toHaveBeenCalled();
  runtime.dispose(); expect(control.events.size).toBe(0); expect(control.setting.readonly).toBe(true);
  await runtime.initialize(); control.dispose(); f.dispose();
});
it('rejects duplicate or malformed native setting registrations before exposing controls', async () => {
  const f = await authoringFixture(); const first = booleanSettingFixture(); const second = booleanSettingFixture();
  expect(() => createAuthoringRuntime([() => ({ commands: [], settings: [first.setting, second.setting], dispose() {} })], f.services)).toThrow('AUTHORING_SETTING_CATALOG');
  expect(first.events.size).toBe(0); expect(second.events.size).toBe(0);
  // @ts-expect-error Native settings must be explicit validated BooleanSetting instances.
  expect(() => createAuthoringRuntime([() => ({ commands: [], settings: [{}], dispose() {} })], f.services)).toThrow('AUTHORING_INVALID_EXTENSION');
  first.dispose(); second.dispose(); f.dispose();
});
