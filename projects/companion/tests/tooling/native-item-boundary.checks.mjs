import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installItemBoundary } from '../../scripts/testing/native-item-ownership.mjs';

test('native fixture cleanup cannot mistake released save for settled I/O, including a late native rejection', async () => {
  const previous = globalThis.window;
  try {
    for (const fails of [false, true]) {
      let complete; let reject; let nativeEntered = false;
      const pending = new Promise((resolve, fail) => { complete = resolve; reject = fail; });
      const plugin = { async saveData() { nativeEntered = true; await pending; } }; const original = plugin.saveData;
      globalThis.window = { app: { plugins: { plugins: { fixture: plugin } } } };
      installItemBoundary('fixture');
      const boundary = window.__qualificationItemBoundary;
      const write = plugin.saveData({ example: 'retained' });
      assert.equal(boundary.state.active, 1); assert.equal(nativeEntered, false);
      // This is the cleanup path after an assertion fails while the test owns a paused save.
      boundary.restore(); await Promise.resolve();
      assert.equal(plugin.saveData, original); assert.equal(nativeEntered, true);
      assert.equal(boundary.state.active, 1, 'restoring bytes here would race still-running I/O');
      if (fails) { reject(new Error('late I/O failure')); await assert.rejects(write, /late I\/O failure/); }
      else { complete(); await write; }
      assert.equal(boundary.state.active, 0);
      assert.equal(boundary.state.completed, fails ? 0 : 1); assert.equal(boundary.state.failed, fails ? 1 : 0);
    }
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
