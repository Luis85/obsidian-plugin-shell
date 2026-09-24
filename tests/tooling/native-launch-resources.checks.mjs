import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeLaunchResources } from '../../scripts/testing/native-launch-resources.mjs';

test('each native launch resource receipt samples fresh shared-runner memory and load without claiming an idle reference', () => {
  let count = 0;
  const inspect = { platform: () => 'linux', totalmem: () => 10000, freemem: () => 2000 - ++count * 100,
    availableParallelism: () => 2, loadavg: () => [count, count + 1, count + 2],
    memoryUsage: () => ({ rss: 100, heapUsed: 50 }), now: () => '2026-09-24T18:00:00.000Z' };
  const initial = nativeLaunchResources('initial', inspect); const restart = nativeLaunchResources('cold-restart', inspect);
  assert.equal(initial.freeMemoryBytes, 1900); assert.equal(restart.freeMemoryBytes, 1800);
  assert.deepEqual(initial.loadAverage.values, [1, 2, 3]); assert.deepEqual(restart.loadAverage.values, [2, 3, 4]);
  for (const sample of [initial, restart]) {
    assert.equal(sample.classification, 'shared-runner'); assert.equal(sample.idleReference, false);
    assert.equal(sample.boundary, 'before-public-launch-call'); assert.deepEqual(sample.processMemory, { rss: 100, heapUsed: 50 });
  }
  assert.throws(() => nativeLaunchResources('invented', inspect), /NATIVE_RESOURCE_PHASE/);
});
test('Windows unsupported load averages stay explicitly unavailable instead of reporting false zero-load evidence', () => {
  const sample = nativeLaunchResources('initial', { platform: () => 'win32', totalmem: () => 10000, freemem: () => 1000,
    availableParallelism: () => 4, loadavg: () => assert.fail('Windows zeroes are not measured load'),
    memoryUsage: () => ({ rss: 100, heapUsed: 50 }), now: () => '2026-09-24T18:00:00.000Z' });
  assert.deepEqual(sample.loadAverage, { supported: false, values: null, reason: 'unsupported-on-win32' });
  assert.equal(sample.idleReference, false);
});
test('the actual local resource reader provides current diagnostic numbers without launching a host', () => {
  const before = Date.now(); const sample = nativeLaunchResources('initial');
  assert.ok(Date.parse(sample.sampledAt) >= before && Date.parse(sample.sampledAt) <= Date.now());
  for (const value of [sample.totalMemoryBytes, sample.freeMemoryBytes, sample.availableParallelism, sample.processMemory.rss, sample.processMemory.heapUsed]) assert.ok(Number.isSafeInteger(value) && value >= 0);
  assert.ok(sample.totalMemoryBytes > 0 && sample.freeMemoryBytes <= sample.totalMemoryBytes && sample.availableParallelism > 0);
});
