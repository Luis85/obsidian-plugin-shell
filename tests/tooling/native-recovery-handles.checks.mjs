import assert from 'node:assert/strict';
import test from 'node:test';
import { retainNativeAction, startAndCloseRecovery } from '../../scripts/testing/native-recovery-handles.mjs';

function fixture(handlers = 1, throws = false) {
  const calls = []; let detached = 0;
  const session = {
    async send(method, input) {
      calls.push({ method, input });
      if (method === 'Runtime.evaluate') return { result: { objectId: 'actual-button' } };
      if (method === 'DOMDebugger.getEventListeners') return { listeners: Array.from({ length: handlers }, () => ({ type: 'click', handler: { objectId: 'actual-handler' } })) };
      if (method === 'Runtime.callFunctionOn') return throws ? { exceptionDetails: {} } : { result: { type: 'undefined' } };
      return {};
    },
    async detach() { detached++; },
  };
  return { page: { context: () => ({ newCDPSession: async () => session }) }, calls, detached: () => detached };
}
test('native recovery retains and replays the actual public-CDP function rather than dispatching a detached DOM event', async () => {
  const f = fixture(); const handle = await retainNativeAction(f.page, 'Review example result');
  await handle.invoke(); await handle.invoke(); await handle.invoke(); assert.equal(handle.calls(), 3);
  const invoked = f.calls.filter(call => call.method === 'Runtime.callFunctionOn');
  assert.equal(invoked.length, 3); assert.ok(invoked.every(call => call.input.objectId === 'actual-handler' && call.input.functionDeclaration.includes('this()')));
  await handle.dispose(); assert.equal(f.detached(), 1);
  assert.deepEqual(f.calls.filter(call => call.method === 'Runtime.releaseObject').map(call => call.input.objectId), ['actual-button', 'actual-handler']);
});
test('native recovery rejects ambiguous callbacks and actual invocation failure without recording a successful invocation', async () => {
  for (const count of [0, 2]) { const f = fixture(count); await assert.rejects(retainNativeAction(f.page, 'Review'), /AMBIGUOUS/); assert.equal(f.detached(), 1); }
  const f = fixture(1, true); const handle = await retainNativeAction(f.page, 'Review');
  await assert.rejects(handle.invoke(), /HANDLER_FAILED/); assert.equal(handle.calls(), 0); await handle.dispose();
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
