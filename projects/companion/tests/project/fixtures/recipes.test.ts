import { it, expect } from 'vitest';
import { createFixtureEngine } from "../../../scripts/test-data/engine.mjs";
import { createFixtureAdapter } from "../../../scripts/test-data/adapters.mjs";
import manifest from "../../../scripts/test-data/manifest.json";
it('compiles the authored recipes into deterministic bounded fixture data', () => {
  const engine = createFixtureEngine(); const first = engine.generate(manifest);
  expect(engine.generate(manifest)).toEqual(first); expect(first.operations).toHaveLength(manifest.operations.length);
  expect(first.bytes).toBeLessThanOrEqual(5000000);
  const adapter = createFixtureAdapter(manifest); adapter.dispose();
  expect(() => adapter.reset()).toThrow('disposed');
});
