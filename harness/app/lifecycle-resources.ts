import type { ModalSink } from '../../src/application/modal-port';
import type { NoticeAction, NoticeHandle, TimerScheduler } from '../../src/application/ports';
import { createTimerScheduler } from '../../src/infrastructure/timers';
import { browserModalSink } from './modal-sink';

/** Observes actual owned adapter handles; these are synthetic browser resources. */
export function lifecycleResources() {
  const timers = new Set<() => void>();
  const dialogs = new Set<() => void>();
  const notices = new Map<NoticeHandle, readonly NoticeAction[]>();
  const clock = createTimerScheduler(); const sink = browserModalSink();
  const scheduler: TimerScheduler = { after(milliseconds, callback) {
    const cancel = clock.after(milliseconds, () => { timers.delete(stop); callback(); });
    const stop = () => { timers.delete(stop); cancel(); };
    timers.add(stop); return stop;
  } };
  const modals: ModalSink = { open(presentation, callbacks) {
    const handle = sink.open(presentation, callbacks);
    const close = () => { try { handle.close(); } finally { dialogs.delete(close); } };
    dialogs.add(close); return { update: state => handle.update(state), close };
  } };
  function notification(create: (text: string, actions: readonly NoticeAction[]) => NoticeHandle, text: string, actions: readonly NoticeAction[]): NoticeHandle {
    const handle = create(text, actions); notices.set(handle, actions);
    return {
      update(message, choices) { handle.update(message, choices); if (notices.has(handle)) notices.set(handle, choices); },
      dismiss() { try { handle.dismiss(); } finally { notices.delete(handle); } },
    };
  }
  return { scheduler, modals, notification,
    snapshot: () => ({ timers: timers.size, dialogs: dialogs.size, notices: notices.size,
      actions: [...notices.values()].reduce((count, actions) => count + actions.length, 0) }),
  };
}
