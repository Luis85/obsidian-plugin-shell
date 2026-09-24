import { availableParallelism, freemem, loadavg, platform, totalmem } from 'node:os';

const system = { availableParallelism, freemem, loadavg, platform, totalmem,
  now: () => new Date().toISOString(), memoryUsage: () => process.memoryUsage() };

/** A current diagnostic sample, not an idle-machine assertion or a timing qualification. */
export function nativeLaunchResources(phase, inspect = system) {
  if (!['initial', 'cold-restart'].includes(phase)) throw new Error('NATIVE_RESOURCE_PHASE');
  const host = inspect.platform(); const memory = inspect.memoryUsage();
  return { phase, sampledAt: inspect.now(), boundary: 'before-public-launch-call', classification: 'shared-runner', idleReference: false,
    platform: host, totalMemoryBytes: inspect.totalmem(), freeMemoryBytes: inspect.freemem(), availableParallelism: inspect.availableParallelism(),
    loadAverage: host === 'win32' ? { supported: false, values: null, reason: 'unsupported-on-win32' } : { supported: true, values: inspect.loadavg(), reason: null },
    processMemory: { rss: memory.rss, heapUsed: memory.heapUsed } };
}
