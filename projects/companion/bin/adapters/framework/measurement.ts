import { setImmediate } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { requireThat } from './contracts.ts';

export function sampleSummary(samples: readonly number[]) {
  requireThat(Array.isArray(samples) && samples.length > 0 && samples.length <= 30 &&
    Array.from({length:samples.length},(_,index)=>Object.getOwnPropertyDescriptor(samples,String(index))).every(field=>
      field && 'value' in field && typeof field.value==='number' && Number.isFinite(field.value) && field.value>=0), 'MEASUREMENT_INVALID', 'Measurements must be finite, nonnegative and complete.');
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: samples.length, minMs: sorted[0]!, maxMs: sorted.at(-1)!,
    medianMs: sorted[Math.ceil(sorted.length * 0.5) - 1]!, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    meanMs: samples.reduce((total, sample) => total + sample, 0) / samples.length };
}

/** A failed warmup/sample aborts the series. Never filter out failures or slow measurements. */
export async function measureOperation(operation: () => unknown, count: number, signal?: AbortSignal, now = () => performance.now()) {
  requireThat(Number.isInteger(count) && count >= 3 && count <= 30, 'MEASUREMENT_COUNT', 'Choose 3 to 30 measured samples.');
  async function invoke() {
    await setImmediate();
    requireThat(!signal?.aborted, 'CANCELLED', 'Measurement cancelled.');
    const before = now(); const value=operation(); const after = now();
    requireThat(value===null || typeof value!=='object' || !('then' in value), 'MEASUREMENT_ASYNC', 'Only completed synchronous operations can be measured here.');
    requireThat(Number.isFinite(before) && Number.isFinite(after) && after >= before, 'MEASUREMENT_CLOCK', 'Invalid monotonic clock sample.');
    requireThat(!signal?.aborted, 'CANCELLED', 'Measurement cancelled.');
    return after - before;
  }
  const coldMs = await invoke();
  const warmupMs = [await invoke(), await invoke(), await invoke()];
  const samplesMs:number[]=[];
  for(let index=0;index<count;index++)samplesMs.push(await invoke());
  return { coldMs, warmupMs, samplesMs, ...sampleSummary(samplesMs) };
}
