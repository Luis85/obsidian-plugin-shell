import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
interface Row { id: string; implementation: string; test: string }
const root = new URL("../../../", import.meta.url);
const trace: { requirements: Row[] } = JSON.parse(readFileSync(new URL('design/traceability.json', root), 'utf8'));
it('every requirement in design/traceability.json keeps its use case and acceptance test', () => {
  expect(new Set(trace.requirements.map(row => row.id)).size).toBe(trace.requirements.length);
  for (const row of trace.requirements) {
    expect(existsSync(new URL(row.implementation, root)), row.implementation).toBe(true);
    expect(existsSync(new URL(row.test, root)), row.test).toBe(true);
  }
});
