import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { hasControls } from '../../bin/domain/errors.ts';
test('control detection rejects all C0/C1 controls while allowing declared text whitespace', () => {
  for (let code = 0; code <= 159; code++) {
    const value = String.fromCodePoint(code), control = code < 32 || code >= 127;
    assert.equal(hasControls(value), control, `single-line character ${code}`);
    assert.equal(hasControls(value, true), control && ![9, 10, 13].includes(code), `multiline character ${code}`);
  }
  assert.equal(hasControls('Résumé 你好 😀'), false);
});
