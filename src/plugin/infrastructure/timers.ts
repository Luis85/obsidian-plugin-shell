import type { TimerScheduler } from '../application/ports';
/** Each returned cancellation belongs to its caller; no shared timer registry. */
export function createTimerScheduler(): TimerScheduler {
  const owner = window;
  return { after(milliseconds, callback) { const timer = owner.setTimeout(callback, milliseconds); return () => owner.clearTimeout(timer); } };
}
