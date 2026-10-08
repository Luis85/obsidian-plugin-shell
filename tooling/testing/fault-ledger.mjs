/** Test observer only. Runtime integration (including Vue's error handler) is still pending. */
export function createFaultLedger(capacity = 100) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('INVALID_CAPACITY');
  const counts = new Map();
  let observed = 0;
  let overflow = false;
  return Object.freeze({
    record(code, scope) {
      if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(code) || typeof scope !== 'string' ||
          !/^[a-z0-9][a-z0-9:._-]{0,79}$/.test(scope)) throw new Error('INVALID_FAULT_ID');
      observed += 1;
      if (observed > capacity) { overflow = true; return; }
      const key = `${code}|${scope}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
    snapshot() {
      return { observed, overflow, entries: [...counts].sort().map(([key, count]) => {
        const [code, scope] = key.split('|'); return { code, scope, count };
      }) };
    },
    assertExpected(expected = []) {
      const expectedCounts = new Map();
      for (const item of expected) {
        const key = `${item.code}|${item.scope}`;
        if (!Number.isSafeInteger(item.count) || item.count < 1 || expectedCounts.has(key))
          throw new Error('INVALID_EXPECTATION');
        expectedCounts.set(key, item.count);
      }
      if (overflow) throw new Error('FAULT_LEDGER_OVERFLOW');
      if (expectedCounts.size !== counts.size ||
          [...expectedCounts].some(([key, value]) => counts.get(key) !== value))
        throw new Error('FAULT_EXPECTATION_MISMATCH');
    },
  });
}
