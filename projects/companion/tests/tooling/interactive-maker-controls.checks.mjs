import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { hasControls } from '../../bin/domain/errors.ts';
import { parseConfirmation } from '../../scripts/shared/confirmation.ts';
test('control detection rejects all C0/C1 controls while allowing declared text whitespace', () => {
  for (let code = 0; code <= 159; code++) {
    const value = String.fromCodePoint(code), control = code < 32 || code >= 127;
    assert.equal(hasControls(value), control, `single-line character ${code}`);
    assert.equal(hasControls(value, true), control && ![9, 10, 13].includes(code), `multiline character ${code}`);
  }
  assert.equal(hasControls('Résumé 你好 😀'), false);
});

test('maker confirmation policy uses the shared typed yes-no contract', () => {
  for (const value of ['y', 'Y', 'yes', ' YES ']) assert.equal(parseConfirmation(value), true);
  for (const value of ['', ' ', 'n', 'N', 'no', ' NO ']) assert.equal(parseConfirmation(value), false);
  for (const value of ['maybe', '1', 'yep']) assert.equal(parseConfirmation(value), null);
});
