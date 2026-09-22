import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { assertCoverageInventory } from '../../scripts/quality/coverage-inventory.mjs';
test('[COV-02-01] silently omitted production input makes the coverage inventory fail', () => {
  const source = resolve('src/bootstrap/mount-ui.ts');
  assert.throws(() => assertCoverageInventory({ total: {}, [source]: {} }, [source, 'src/main.ts']), /INCOMPLETE_PRODUCTION_COVERAGE/);
  assert.throws(() => assertCoverageInventory({ [source]: {} }, [source]), /MISSING_COVERAGE_TOTAL/);
  assert.equal(assertCoverageInventory({ total: {}, [source]: {} }, [source]).productionInputs, 1);
});
