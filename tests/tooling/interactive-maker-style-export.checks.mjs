import assert from 'node:assert/strict';
import { exportDesignSystem as relocated } from '../../bin/adapters/framework/style-export.ts';
import * as legacy from '../../scripts/framework/style-export.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

test('relocated style renderer preserves compatibility identity and all supported formats', () => {
  assert.equal(legacy.exportDesignSystem, relocated);
  for (const format of ['css', 'json', 'markdown', 'html']) {
    const result = relocated(undefined, 'style-test', format);
    assert.equal(typeof result.content, 'string');
    assert.ok(result.content.length > 0);
    assert.equal(result.extension, format === 'markdown' ? 'md' : format);
    assert.equal(typeof result.mediaType, 'string');
    assert.ok(result.manifest);
  }
});

test('relocated style renderer refuses unsupported formats and accessor-bearing data', () => {
  assert.throws(() => relocated(undefined, 'style-test', 'svg'), { code: 'STYLE_FORMAT' });
  let invoked = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'colors', { enumerable: true, get() { invoked++; return []; } });
  assert.throws(() => relocated(hostile, 'style-test', 'json'), /JSON_DATA_INVALID/);
  assert.equal(invoked, 0);
});
