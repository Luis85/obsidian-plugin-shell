/** Lifecycle of one dev:obsidian run: the resources it created, why it stops and its exit code.
 * Resources (Xvfb, the scratch profile, Obsidian, the debugger connection, watchers) are tracked as
 * soon as they exist and released exactly once in reverse order, whatever stops the run: success,
 * failure, Ctrl-C/SIGTERM at any point (including startup) or an Obsidian exit. The exit code only
 * ever gets worse; an error caused by stopping never overrides the reason the run stopped. */
export function createDevSession({ once = false, say = () => undefined, report = message => console.error(message) } = {}) {
  const resources = [];
  let code = 0; let failure = null; let interrupted = null; let reason = null; let closing = false; let settled = false;
  let releasing = Promise.resolve();
  let resolveStop; const stopRequested = new Promise(resolve => { resolveStop = resolve; });
  let rejectStop; const stopped = new Promise((_, reject) => { rejectStop = reject; });
  stopped.catch(() => undefined);
  const worsen = value => { code = Math.max(code, value); };
  const stop = error => { reason ??= error; rejectStop(reason); resolveStop(reason); };
  const run = async item => {
    try { await item.release(); } catch (error) { report(`[dev:obsidian] Cleanup of ${item.name} failed: ${error.message}`); }
  };
  return {
    get code() { return code; },
    get failure() { return failure; },
    get interrupted() { return interrupted; },
    /** Resolves when the run should stop (interrupt, Obsidian closed or exited, or a failure). */
    stopRequested,
    /** A step that is abandoned as soon as the run is told to stop. */
    guard(promise) { return Promise.race([promise, stopped]); },
    /** Track a created resource; one created after release began is released immediately. */
    track(name, release, kill) {
      const item = { name, release, kill };
      if (closing) void run(item); else resources.push(item);
      return item;
    },
    /** The outcome is decided (the JSON summary exists); a later Obsidian exit is only logged. */
    settle() { settled = true; },
    /** Record a step failure. Errors caused by stopping are reported but keep the stop's exit code. */
    fail(error) {
      if (error === reason) return;
      if (interrupted || closing || reason) { report(`[dev:obsidian] (while stopping: ${interrupted ?? reason?.message ?? 'cleanup'}) ${error.message}`); return; }
      report(`[dev:obsidian] ${error.message}`);
      worsen(1); failure ??= error; stop(error);
    },
    /** Ctrl-C/SIGTERM. Returns false for a repeated signal so the caller can force an exit. */
    interrupt(signal) {
      if (interrupted) return false;
      interrupted = signal; say(`Stopping (${signal}).`);
      if (once && !settled) worsen(130);
      stop(new Error(`INTERRUPTED (${signal})`));
      return true;
    },
    /** Obsidian exited. In --json/once mode, before the summary exists, that is always a failure.
     * In watch mode a window the developer closed (exit 0) ends the session normally. */
    hostExited(exitCode, signal) {
      if (closing) return;
      const detail = `exit code ${exitCode ?? 'none'}${signal ? `, signal ${signal}` : ''}`;
      if (settled) { say(`Obsidian exited (${detail}).`); return; }
      if (!once && exitCode === 0 && !signal) { say(`Obsidian was closed (${detail}); stopping the watcher.`); stop(new Error(`OBSIDIAN_CLOSED (${detail})`)); return; }
      const error = new Error(`OBSIDIAN_EXITED_UNEXPECTEDLY (${detail})`);
      report(`[dev:obsidian] ✗ Obsidian exited unexpectedly (${detail}).`);
      worsen(1); failure ??= error; stop(error);
    },
    /** A failed outcome that was already reported (for example a failed JSON summary). */
    failed(exitCode = 1) { worsen(exitCode); },
    /** Release everything tracked so far, newest first; concurrent calls share one pass. */
    release() {
      closing = true;
      releasing = releasing.then(async () => { while (resources.length) await run(resources.pop()); });
      return releasing;
    },
    /** Synchronous last resort for a repeated interrupt: kill tracked processes without waiting. */
    killNow() {
      for (const item of [...resources].reverse()) { try { item.kill?.(); } catch { /* already gone */ } }
    },
  };
}
/** Register SIGINT/SIGTERM for the whole run; a second signal kills tracked processes and exits. */
export function listenForInterrupts(session, target = process, exit = code => process.exit(code)) {
  const handlers = ['SIGINT', 'SIGTERM'].map(signal => {
    const handler = () => { if (!session.interrupt(signal)) { session.killNow(); exit(130); } };
    target.on(signal, handler);
    return [signal, handler];
  });
  return () => { for (const [signal, handler] of handlers) target.off(signal, handler); };
}
