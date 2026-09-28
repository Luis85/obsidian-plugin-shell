/** Bound independent I/O without caching source bytes or leaving work running on failure.
 * Results retain input order. A failed worker stops new work; all started work settles before rejection.
 * @template T, R
 * @param {readonly T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} operation
 * @returns {Promise<R[]>}
 */
export async function mapBounded(items, concurrency, operation) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('INVALID_CONCURRENCY');
  const inputs = [...items], results = new Array(inputs.length);
  let next = 0, failed = false, failure;
  async function worker() {
    while (!failed && next < inputs.length) {
      const index = next++;
      try { results[index] = await operation(inputs[index], index); }
      catch (error) { if (!failed) { failed = true; failure = error; } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));
  if (failed) throw failure;
  return results;
}
