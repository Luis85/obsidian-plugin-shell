import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTestQuality, checkTestQuality } from '../../scripts/quality/check-test-quality.mjs';
import { ESLint } from 'eslint';

test('test declaration policy rejects focus and skip through framework imports and aliases', () => {
  for (const call of ['test.only("case", () => {})', 'test.describe.skip("suite", () => {})', 'test["skip"]("case", () => {})', 'test.skip(true, "condition")', 'test.skipIf(true)("case", () => {})']) {
    assert.match(inspectTestQuality(`import { test } from '@playwright/test'; ${call}`)[0], /FOCUSED_OR_SKIPPED_TEST/);
  }
  assert.match(inspectTestQuality('import { it as check } from "vitest"; check.only("case", () => {});')[0], /FOCUSED_OR_SKIPPED_TEST/);
  assert.match(inspectTestQuality('import * as v from "vitest"; v.describe.skip("case", () => {});')[0], /FOCUSED_OR_SKIPPED_TEST/);
  assert.deepEqual(inspectTestQuality('import { test } from "vitest"; test("mentions test.only", () => {}); // test.skip()'), []);
  assert.deepEqual(inspectTestQuality('const unrelated = { skip() {} }; unrelated.skip();'), []);
  assert.deepEqual(inspectTestQuality('import {'), ['TEST_PARSE_ERROR']);
});
test('actual runtime and browser declarations contain no focused or skipped tests', async () => {
  assert.ok((await checkTestQuality()).files > 0);
});
test('configured typed ESLint rejects missing Playwright await and accepts handled operations', async () => {
  const eslint = new ESLint();
  // lintText uses an existing tsconfig-included filename without changing source.
  const filePath = 'tests/runtime/types.ts'; // Retained in both showcase and foundation profiles.
  const source = 'import { test } from "@playwright/test"; test("await probe", async ({ page }) => { page.goto("/"); });';
  const [bad] = await eslint.lintText(source, { filePath });
  assert.ok(bad.messages.some(message => message.ruleId === '@typescript-eslint/no-floating-promises'), JSON.stringify(bad.messages));
  const [good] = await eslint.lintText(source.replace('page.goto', 'await page.goto'), { filePath });
  assert.equal(good.errorCount, 0, JSON.stringify(good.messages));
});
