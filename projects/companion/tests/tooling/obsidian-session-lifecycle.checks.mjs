import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionLifecycle, withSession, closeOnAbort } from '../../scripts/testing/obsidian-session-lifecycle.mjs';

/** Scripted steps: records call order and fails on demand, without any Obsidian host. */
function steps({ fail = {}, connectGate } = {}) {
  const calls = [];
  const step = (name, value) => async argument => {
    calls.push(argument === undefined ? name : `${name}:${argument}`);
    if (name === 'connect' && connectGate) await connectGate;
    if (fail[name]) throw new Error(`${name} failed`);
    return value;
  };
  return { calls, steps: { prepare: step('prepare'), connect: step('connect', 'client'), initialize: step('initialize'),
    disconnect: step('disconnect'), cleanup: step('cleanup') } };
}
test('[OBSIDIAN-LIFECYCLE-01] a successful session starts once, and close disconnects then cleans up exactly once', async () => {
  const { calls, steps: owned } = steps(); const session = new SessionLifecycle(owned);
  assert.equal(await session.start(), 'client'); assert.equal(await session.start(), 'client');
  await Promise.all([session.close(), session.close()]); await session.close();
  assert.deepEqual(calls, ['prepare', 'connect', 'initialize:client', 'disconnect:client', 'cleanup']);
  await assert.rejects(session.start(), /OBSIDIAN_SESSION_CLOSED/);
  assert.throws(() => new SessionLifecycle({ ...owned, cleanup: undefined }), /SESSION_STEP_MISSING: cleanup/);
});
test('[OBSIDIAN-LIFECYCLE-02] partial startup failures release what was acquired and always run directory cleanup', async () => {
  for (const [failing, expected] of [
    ['prepare', ['prepare', 'cleanup']],
    ['connect', ['prepare', 'connect', 'cleanup']],
    ['initialize', ['prepare', 'connect', 'initialize:client', 'disconnect:client', 'cleanup']],
  ]) {
    const { calls, steps: owned } = steps({ fail: { [failing]: true } }); const session = new SessionLifecycle(owned);
    await assert.rejects(session.start(), new RegExp(`${failing} failed`));
    await session.close();
    assert.deepEqual(calls, expected, failing);
  }
});
test('[OBSIDIAN-LIFECYCLE-03] startup and cleanup failures are both reported', async () => {
  const { steps: owned } = steps({ fail: { initialize: true, cleanup: true } });
  await assert.rejects(new SessionLifecycle(owned).start(), error => error instanceof AggregateError
    && error.errors[0].message === 'initialize failed' && error.errors[1] instanceof AggregateError
    && error.errors[1].errors[0].message === 'cleanup failed');
});
test('[OBSIDIAN-LIFECYCLE-04] a failed disconnect still cleans directories and is surfaced', async () => {
  const { calls, steps: owned } = steps({ fail: { disconnect: true } }); const session = new SessionLifecycle(owned);
  await session.start();
  await assert.rejects(session.close(), error => error instanceof AggregateError && error.errors[0].message === 'disconnect failed');
  assert.deepEqual(calls.slice(-2), ['disconnect:client', 'cleanup']);
});
test('[OBSIDIAN-LIFECYCLE-05] closing during startup cancels it and releases the late connection', async () => {
  let open; const gate = new Promise(resolve => { open = resolve; });
  const { calls, steps: owned } = steps({ connectGate: gate }); const session = new SessionLifecycle(owned);
  const starting = session.start(); await new Promise(resolve => setImmediate(resolve));
  const closing = session.close(); open();
  await assert.rejects(starting, /OBSIDIAN_SESSION_CANCELLED/); await closing;
  assert.deepEqual(calls, ['prepare', 'connect', 'disconnect:client', 'cleanup']);
  assert.equal(session.closed, true);
});
test('[OBSIDIAN-LIFECYCLE-06] withSession preserves the test error when teardown also fails', async () => {
  const body = new Error('assertion failed');
  const failing = steps({ fail: { cleanup: true } });
  await assert.rejects(withSession(new SessionLifecycle(failing.steps), async () => { throw body; }),
    error => error instanceof AggregateError && error.errors[0] === body && /cleanup failed/.test(error.errors[1].errors[0].message));
  const cleanTeardown = steps();
  await assert.rejects(withSession(new SessionLifecycle(cleanTeardown.steps), async () => { throw body; }), error => error === body);
  assert.deepEqual(cleanTeardown.calls.slice(-2), ['disconnect:client', 'cleanup']);
  const teardownOnly = steps({ fail: { cleanup: true } });
  await assert.rejects(withSession(new SessionLifecycle(teardownOnly.steps), async () => 'ok'), /OBSIDIAN_TEARDOWN_FAILED/);
  assert.equal(await withSession(new SessionLifecycle(steps().steps), async client => `${client}!`), 'client!');
});
test('[OBSIDIAN-LIFECYCLE-07] an abort signal closes the session; an already aborted signal closes immediately', async () => {
  const controller = new AbortController(); const live = steps(); const session = new SessionLifecycle(live.steps);
  await session.start(); const abort = closeOnAbort(session, controller.signal);
  controller.abort(); await abort.settled(); abort.dispose();
  assert.deepEqual(live.calls.slice(-2), ['disconnect:client', 'cleanup']);
  const early = steps(); const aborted = new SessionLifecycle(early.steps);
  const handle = closeOnAbort(aborted, AbortSignal.abort()); await handle.settled();
  await assert.rejects(aborted.start(), /OBSIDIAN_SESSION_CLOSED/);
  assert.deepEqual(early.calls, ['cleanup']);
  const none = closeOnAbort(session, undefined); await none.settled(); none.dispose();
});
