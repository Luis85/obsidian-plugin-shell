/** One owner for partial startup, cancellation and idempotent teardown of a real
 * Obsidian session. Steps are injected so the ordering is testable without a host. */
export class SessionLifecycle {
  #steps; #client; #starting; #closing; #releasing; #stopped = false;
  constructor(steps) {
    for (const name of ['prepare', 'connect', 'initialize', 'disconnect', 'cleanup']) {
      if (typeof steps?.[name] !== 'function') throw new Error(`SESSION_STEP_MISSING: ${name}`);
    }
    this.#steps = steps;
  }
  get closed() { return this.#stopped; }
  start() {
    if (this.#stopped) return Promise.reject(new Error('OBSIDIAN_SESSION_CLOSED'));
    this.#starting ??= this.#acquire();
    return this.#starting;
  }
  close() {
    this.#stopped = true;
    this.#closing ??= (async () => {
      // A late connection still belongs to this owner and is released when it arrives.
      await this.#starting?.catch(() => undefined);
      await this.#release();
    })();
    return this.#closing;
  }
  #assertActive() { if (this.#stopped) throw new Error('OBSIDIAN_SESSION_CANCELLED'); }
  async #acquire() {
    try {
      await this.#steps.prepare();
      this.#assertActive();
      this.#client = await this.#steps.connect();
      this.#assertActive();
      await this.#steps.initialize(this.#client);
      this.#assertActive();
      return this.#client;
    } catch (error) {
      this.#stopped = true;
      try { await this.#release(); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'OBSIDIAN_STARTUP_AND_CLEANUP_FAILED'); }
      throw error;
    }
  }
  #release() {
    this.#releasing ??= (async () => {
      const failures = [];
      if (this.#client !== undefined) {
        try { await this.#steps.disconnect(this.#client); }
        catch (error) { failures.push(error); }
        this.#client = undefined;
      }
      // Directory and process cleanup must run even when disconnecting fails.
      try { await this.#steps.cleanup(); }
      catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'OBSIDIAN_TEARDOWN_FAILED');
    })();
    return this.#releasing;
  }
}

/** Preserve a test/setup failure even when teardown independently fails. */
export async function withSession(session, use) {
  let result;
  try { result = { ok: true, value: await use(await session.start()) }; }
  catch (error) { result = { ok: false, error }; }
  try { await session.close(); }
  catch (error) {
    if (!result.ok) throw new AggregateError([result.error, error], 'OBSIDIAN_OPERATION_AND_TEARDOWN_FAILED');
    throw error;
  }
  if (!result.ok) throw result.error;
  return result.value;
}

/** Close the session when a runner aborts; the returned disposer awaits that close. */
export function closeOnAbort(session, signal) {
  if (!signal) return { settled: () => Promise.resolve(), dispose: () => undefined };
  let closing;
  const cancel = () => {
    closing = session.close();
    // Observe immediately; settled() still awaits and propagates the outcome.
    void closing.catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  return { settled: () => closing ?? Promise.resolve(), dispose: () => signal.removeEventListener('abort', cancel) };
}
