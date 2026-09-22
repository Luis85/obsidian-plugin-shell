import type { Diagnostic, ErrorReporter, Unsubscribe } from '../application/ports';
/** Allowlisted metadata only. No raw exception text, paths, titles, stack or payload. */
export class Diagnostics implements ErrorReporter {
  private sequence = 0;
  private disposed = false;
  private entries: Diagnostic[] = [];
  private readonly listeners = new Set<() => void | Promise<void>>();
  constructor(private readonly observer?: (entry: Diagnostic) => void) {}
  get current(): readonly Diagnostic[] { return this.entries.slice(); }
  private append(code: string, operation: string): void {
    if (this.disposed) return;
    const safe = (v: string) => /^[a-z.]+$/.test(v) ? v.slice(0, 80) : 'redacted';
    const entry = Object.freeze({ sequence: ++this.sequence, code: safe(code), operation: safe(operation) });
    this.entries = [...this.entries.slice(-199), entry];
    try { this.observer?.(entry); } catch { /* Independent observer failure cannot recurse. */ }
  }
  report(code: string, operation: string): void {
    if (this.disposed) return;
    this.append(code, operation);
    // Capture subscriber failures independently without recursively notifying that subscriber.
    for (const listener of Array.from(this.listeners)) {
      if (!this.listeners.has(listener)) continue;
      try {
        const result = listener();
        if (result) Promise.resolve(result).catch(() => this.append('diagnostic.listener', 'diagnostic.notify'));
      } catch { this.append('diagnostic.listener', 'diagnostic.notify'); }
    }
  }
  subscribe(listener: () => void | Promise<void>): Unsubscribe {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  dispose(): void { this.disposed = true; this.listeners.clear(); this.entries = []; }
}
