import assert from 'node:assert/strict';
import test from 'node:test';
import { retainNativeAction, startAndCloseRecovery } from '../../scripts/testing/native-recovery-handles.mjs';

function fixture(handlers = 1, throws = false, options = {}) {
  const calls = []; let detached = 0; let objectGroup;
  const session = {
    async send(method, input) {
      calls.push({ method, input });
      if (method === 'Runtime.evaluate') { objectGroup = input.objectGroup; return { result: options.missingButton ? {} : { objectId: 'actual-button' } }; }
      // Chromium omits function references when the inspected node has no object group.
      if (method === 'DOMDebugger.getEventListeners') return { listeners: Array.from({ length: handlers }, (_, index) => ({ type: 'click',
        ...(objectGroup && !options.hideReferences && index !== options.missingReferenceAt ? { handler: { objectId: 'actual-handler' }, originalHandler: { objectId: 'registered-handler' } } : {}) })) };
      if (method === 'Runtime.callFunctionOn') return throws ? { exceptionDetails: {} } : { result: { type: 'undefined' } };
      if (method === 'Runtime.releaseObjectGroup' && options.releaseFailure) throw options.releaseFailure;
      return {};
    },
    async detach() { detached++; if (options.detachFailure) throw options.detachFailure; },
  };
  return { page: { context: () => ({ newCDPSession: async () => session }) }, calls, detached: () => detached };
}
test('native recovery retains and replays the actual public-CDP function rather than dispatching a detached DOM event', async () => {
  const f = fixture(); const handle = await retainNativeAction(f.page, 'Review example result');
  await handle.invoke(); await handle.invoke(); await handle.invoke(); assert.equal(handle.calls(), 3);
  const invoked = f.calls.filter(call => call.method === 'Runtime.callFunctionOn');
  assert.equal(invoked.length, 3); assert.ok(invoked.every(call => call.input.objectId === 'actual-handler' && call.input.functionDeclaration.includes('this()')));
  const group = f.calls.find(call => call.method === 'Runtime.evaluate').input.objectGroup;
  assert.match(group, /^native-recovery:[a-f\d-]{36}$/); assert.ok(invoked.every(call => call.input.objectGroup === group));
  const other = fixture(); const second = await retainNativeAction(other.page, 'Review', '.harness-native-notice button');
  assert.ok(other.calls[0].input.expression.includes(JSON.stringify('.harness-native-notice button')));
  assert.notEqual(other.calls[0].input.objectGroup, group); await second.dispose();
  await handle.dispose(); await handle.dispose(); assert.equal(f.detached(), 1);
  assert.deepEqual(f.calls.filter(call => call.method === 'Runtime.releaseObjectGroup').map(call => call.input.objectGroup), [group]);
  await assert.rejects(handle.invoke(), /HANDLE_DISPOSED/); assert.equal(handle.calls(), 3);
});
test('native recovery rejects ambiguous callbacks and actual invocation failure without recording a successful invocation', async () => {
  for (const count of [0, 2]) {
    const f = fixture(count);
    await assert.rejects(retainNativeAction(f.page, 'Review'), error => {
      assert.match(error.message, count === 0 ? /HANDLER_MISSING/ : /HANDLER_AMBIGUOUS/);
      assert.ok(error.message.includes(`"clickListeners":${count}`)); assert.ok(error.message.includes(`"callableHandlers":${count}`)); return true;
    });
    assert.equal(f.detached(), 1); assert.equal(f.calls.filter(call => call.method === 'Runtime.releaseObjectGroup').length, 1);
  }
  const f = fixture(1, true); const handle = await retainNativeAction(f.page, 'Review');
  await assert.rejects(handle.invoke(), /HANDLER_FAILED/); assert.equal(handle.calls(), 0); await handle.dispose();
});
test('native recovery distinguishes unexposed references from duplicate listeners without guessing a function', async () => {
  for (const [count, options, code, callable] of [[1, { hideReferences: true }, 'MISSING', 0], [2, { missingReferenceAt: 1 }, 'AMBIGUOUS', 1]]) {
    const f = fixture(count, false, options);
    await assert.rejects(retainNativeAction(f.page, 'Review'), error => {
      assert.match(error.message, new RegExp(`HANDLER_${code}`));
      const details = JSON.parse(error.message.slice(error.message.indexOf(': ') + 2));
      assert.equal(details.clickListeners, count); assert.equal(details.callableHandlers, callable);
      assert.equal(details.listeners.length, count); assert.equal(details.listeners.at(-1).hasHandler, false); return true;
    });
    assert.equal(f.calls.filter(call => call.method === 'Runtime.callFunctionOn').length, 0); assert.equal(f.detached(), 1);
  }
});
test('native recovery keeps primary and every cleanup failure visible through the recorded message', async () => {
  for (const setupFails of [true, false]) {
    const releaseFailure = new Error('group release failed'); const detachFailure = new Error('session detach failed');
    const f = fixture(1, false, { missingButton: setupFails, releaseFailure, detachFailure });
    let failure;
    try { if (setupFails) await retainNativeAction(f.page, 'Review'); else await (await retainNativeAction(f.page, 'Review')).dispose(); }
    catch (error) { failure = error; }
    assert.ok(failure instanceof AggregateError); assert.match(failure.message, /group release failed/); assert.match(failure.message, /session detach failed/);
    if (setupFails) assert.match(failure.message, /BUTTON_MISSING/);
    assert.deepEqual(failure.errors.slice(-2), [releaseFailure, detachFailure]); assert.equal(f.detached(), 1);
  }
});
test('atomic native progress control invokes the actual button before its public owning leaf closes', () => {
  const previous = globalThis.window; const calls = [];
  const element = { dataset: { type: 'owned' }, querySelectorAll: () => [{ textContent: 'Try owned recovery', click: () => calls.push('actual-click') }] };
  const leaf = { view: { containerEl: element }, detach: () => calls.push('actual-close') };
  try {
    globalThis.window = { app: { workspace: { getLeavesOfType: () => [leaf] } } };
    startAndCloseRecovery(element); assert.deepEqual(calls, ['actual-click', 'actual-close']);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
