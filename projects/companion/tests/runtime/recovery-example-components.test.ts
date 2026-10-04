// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import type { useRecoveryExample } from '../../src/presentation/composables/use-recovery-example';
import type { NoticeAction } from '../../src/application/ports';
import { browserNotification } from '../../harness/app/notification-sink';
import { button, click, componentFixture, settle } from './component-fixture';

const retained = vi.hoisted((): ReturnType<typeof useRecoveryExample>[] => []);
vi.mock('../../src/presentation/composables/use-recovery-example', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/presentation/composables/use-recovery-example')>();
  return { ...original, useRecoveryExample(owner: string) { const action = original.useRecoveryExample(owner); retained.push(action); return action; } };
});
afterEach(() => { retained.length = 0; vi.restoreAllMocks(); document.body.replaceChildren(); });
async function fixture() {
  const f = await componentFixture(); const callbacks: (() => void)[] = []; const cancels: ReturnType<typeof vi.fn>[] = [];
  const actions: NoticeAction[] = []; const sinks = new Set<() => void>();
  vi.spyOn(f.services.scheduler, 'after').mockImplementation((_delay, callback) => { callbacks.push(callback); const cancel = vi.fn(); cancels.push(cancel); return cancel; });
  f.native.notification = (text, choices) => {
    actions.push(...choices);
    return browserNotification(text, choices, close => { sinks.add(close); return () => { sinks.delete(close); }; });
  };
  await click(f.root, 'Events & feedback');
  const controller = retained.at(-1); if (!controller) throw new Error('MISSING_REAL_RECOVERY_CONTROLLER');
  return { ...f, callbacks, cancels, actions, sinks, controller };
}
function confirm() {
  const submit = document.querySelector<HTMLButtonElement>('.harness-modal button[type="submit"]');
  if (!submit) throw new Error('MISSING_REAL_MODAL_SUBMIT'); submit.click();
}

it('[RECOVERY-COMPLETE] real demo waits for modal completion and reviews without document or settings writes', async () => {
  const f = await fixture();
  try {
    const pending = f.controller.startRecovery(); await settle();
    expect(button(f.root, 'Try owned recovery').disabled).toBe(true);
    await f.controller.startRecovery(); expect(document.querySelectorAll('.harness-modal')).toHaveLength(1);
    const action = f.actions[0]; if (!action) throw new Error('MISSING_NATIVE_SINK_ACTION');
    action.invoke(); action.invoke(); await settle();
    expect(f.services.notices.current.find(entry => entry.operation === 'review')?.actions?.[0]?.busy).toBe(true);
    f.callbacks[0]?.(); await settle(); expect(document.body.textContent).toContain('Waiting for the example dialog');
    confirm(); await pending; await settle();
    expect(f.services.notices.current).toMatchObject([{ operation: 'reviewed', kind: 'success' }]);
    expect(document.body.textContent).toContain('Example reviewed. No files changed.');
    expect(f.controller.pendingRecovery.value).toBe(false); expect(f.sinks.size).toBe(1);
    expect(f.write).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled(); expect([...f.files]).toEqual([]); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RECOVERY-CLOSE] retained real sink callbacks and start handle cannot revive a closed owner while sibling remains usable', async () => {
  const f = await fixture(); const sibling = document.createElement('div'); document.body.append(sibling);
  const closeSibling = mountShowcase(sibling, f.services); await settle();
  try {
    const pending = f.controller.startRecovery(); await settle();
    const action = f.actions[0]; if (!action) throw new Error('MISSING_NATIVE_SINK_ACTION');
    action.invoke(); action.invoke(); await settle();
    expect(f.services.notices.current.find(entry => entry.operation === 'review')?.actions?.[0]?.busy).toBe(true);
    f.close(); await pending; await settle();
    const frozen = f.controller.pendingRecovery.value; const count = f.callbacks.length;
    action.invoke(); await f.controller.startRecovery(); for (const callback of f.callbacks) callback(); await settle();
    expect(f.controller.pendingRecovery.value).toBe(frozen); expect(f.callbacks).toHaveLength(count);
    expect(f.cancels[0]).toHaveBeenCalledOnce(); expect(f.sinks.size).toBe(0);
    expect(document.querySelectorAll('.harness-modal')).toHaveLength(0); expect(f.services.notices.current).toEqual([]);
    await click(sibling, 'Events & feedback'); await click(sibling, 'Publish a typed event');
    expect(sibling.querySelector('.shell-event-table')?.textContent).toContain('showcase.ping');
    expect(f.write).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
  } finally { closeSibling(); f.dispose(); }
});

it('[RECOVERY-CANCEL] actual modal cancellation cancels delayed progress and permits a deliberate fresh example', async () => {
  const f = await fixture();
  try {
    const pending = f.controller.startRecovery(); await settle();
    document.querySelector('.harness-modal')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await pending; await settle(); expect(f.services.notices.current).toEqual([]); expect(f.cancels[0]).toHaveBeenCalledOnce();
    expect(f.controller.pendingRecovery.value).toBe(false);
    const fresh = f.controller.startRecovery(); await settle(); expect(document.querySelectorAll('.harness-modal')).toHaveLength(1);
    f.close(); await fresh; expect(f.sinks.size).toBe(0); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RECOVERY-FAILURE] a contained real modal-sink failure leaves owned failure feedback and exact independent diagnostics', async () => {
  const f = await fixture();
  try {
    vi.spyOn(f.modalSink, 'open').mockImplementationOnce(() => { throw new Error('Controlled modal adapter failure'); });
    await f.controller.startRecovery(); await settle();
    expect(f.controller.pendingRecovery.value).toBe(false);
    expect(f.services.notices.current).toMatchObject([{ operation: 'result', kind: 'error', key: 'error.unexpected' }]);
    expect(f.observe.mock.calls.map(([entry]) => ({ code: entry.code, operation: entry.operation }))).toEqual([{ code: 'modal.open', operation: 'modal.open' }]);
    expect(f.save).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it.each(['cleanup', 'modal', 'registration', 'notice', 'progress'] as const)('[RECOVERY-REENTRY] closing during real %s acquisition leaves no successor capability', async boundary => {
  const f = await fixture(); const registerOriginal = f.services.notices.registerActions.bind(f.services.notices);
  const register = vi.spyOn(f.services.notices, 'registerActions');
  try {
    if (boundary === 'cleanup') {
      const original = f.services.notices.dismissOwner.bind(f.services.notices);
      vi.spyOn(f.services.notices, 'dismissOwner').mockImplementationOnce(owner => { original(owner); f.close(); });
    } else if (boundary === 'modal') {
      const original = f.services.modals.confirm.bind(f.services.modals);
      vi.spyOn(f.services.modals, 'confirm').mockImplementationOnce(request => { const result = original(request); f.close(); return result; });
    } else if (boundary === 'registration') {
      register.mockImplementationOnce((owner, actions) => { const stop = registerOriginal(owner, actions); f.close(); return stop; });
    } else {
      const method = boundary === 'notice' ? 'info' : 'progress'; const original = f.services.notices[method].bind(f.services.notices);
      vi.spyOn(f.services.notices, method).mockImplementationOnce(request => { const result = original(request); f.close(); return result; });
    }
    await f.controller.startRecovery(); await settle();
    const count = f.callbacks.length; const frozen = f.controller.pendingRecovery.value;
    await f.controller.startRecovery(); for (const callback of f.callbacks) callback(); await settle();
    expect(f.callbacks).toHaveLength(count); expect(f.controller.pendingRecovery.value).toBe(frozen);
    expect(f.sinks.size).toBe(0); expect(f.services.notices.current).toEqual([]); expect(document.querySelectorAll('.harness-modal')).toHaveLength(0);
    const previousOwner = register.mock.calls[0]?.[0];
    if (previousOwner) registerOriginal(previousOwner, {})();
    expect(f.observe).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled(); expect(f.write).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RECOVERY-REENTRY-RUN] owner closure while releasing recovery prevents a new success notice', async () => {
  const f = await fixture(); let closeOnRelease = false;
  const original = f.services.notices.registerActions.bind(f.services.notices);
  vi.spyOn(f.services.notices, 'registerActions').mockImplementationOnce((owner, actions) => {
    const stop = original(owner, actions);
    return () => { stop(); if (closeOnRelease) { closeOnRelease = false; f.close(); } };
  });
  const success = vi.spyOn(f.services.notices, 'success');
  try {
    const pending = f.controller.startRecovery(); await settle(); confirm(); await pending; await settle();
    const action = f.actions[0]; if (!action) throw new Error('MISSING_ACTUAL_RECOVERY');
    closeOnRelease = true; action.invoke(); await settle();
    expect(success).not.toHaveBeenCalled(); expect(f.sinks.size).toBe(0); expect(f.services.notices.current).toEqual([]); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('[RECOVERY-REENTRY-FAILED] failed-modal cleanup cannot publish feedback after its owner closes', async () => {
  const f = await fixture(); let closeOnRelease = true;
  const original = f.services.notices.registerActions.bind(f.services.notices);
  vi.spyOn(f.services.notices, 'registerActions').mockImplementationOnce((owner, actions) => {
    const stop = original(owner, actions);
    return () => { stop(); if (closeOnRelease) { closeOnRelease = false; f.close(); } };
  });
  vi.spyOn(f.modalSink, 'open').mockImplementationOnce(() => { throw new Error('Controlled modal failure'); });
  const error = vi.spyOn(f.services.notices, 'error');
  try {
    await f.controller.startRecovery(); await settle();
    expect(error).not.toHaveBeenCalled(); expect(f.sinks.size).toBe(0); expect(f.services.notices.current).toEqual([]);
    expect(f.observe.mock.calls.map(([entry]) => ({ code: entry.code, operation: entry.operation }))).toEqual([{ code: 'modal.open', operation: 'modal.open' }]);
  } finally { f.dispose(); }
});

it('[RECOVERY-REENTRY-START] single-flight starts before old cleanup and preserves the one accepted new example', async () => {
  const f = await fixture(); let reenter = false; let nested: Promise<void> | undefined;
  const original = f.services.notices.registerActions.bind(f.services.notices);
  vi.spyOn(f.services.notices, 'registerActions').mockImplementationOnce((owner, actions) => {
    const stop = original(owner, actions);
    return () => { stop(); if (reenter) { reenter = false; nested = f.controller.startRecovery(); } };
  });
  const modals = vi.spyOn(f.services.modals, 'confirm');
  try {
    const first = f.controller.startRecovery(); await settle(); confirm(); await first; await settle();
    reenter = true; const second = f.controller.startRecovery(); await nested; await settle();
    expect(modals).toHaveBeenCalledTimes(2); expect(document.querySelectorAll('.harness-modal')).toHaveLength(1);
    expect(f.services.notices.current.map(entry => entry.operation).sort()).toEqual(['progress', 'review']);
    expect(f.callbacks).toHaveLength(2); expect(f.cancels[0]).toHaveBeenCalledOnce(); expect(f.cancels[1]).not.toHaveBeenCalled();
    f.close(); await second; expect(f.services.notices.current).toEqual([]); expect(f.observe).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
