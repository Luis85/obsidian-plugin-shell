/** Bound independent I/O without caching source bytes or leaving work running on failure.
 * Results retain input order. A failed worker stops new work; all started work settles before rejection. */
export async function mapBounded<T, R>(
  items: readonly T[],
  concurrency: number,
  operation: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('INVALID_CONCURRENCY');
  const inputs = [...items], results = new Array<R>(inputs.length);
  let next = 0, failed = false, failure: unknown;
  async function worker(): Promise<void> {
    while (!failed && next < inputs.length) {
      const index = next++;
      try { results[index] = await operation(inputs[index]!, index); }
      catch (error) { if (!failed) { failed = true; failure = error; } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));
  if (failed) throw failure;
  return results;
}
