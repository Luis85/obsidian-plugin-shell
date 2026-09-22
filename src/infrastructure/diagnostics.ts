import type { Diagnostic, ErrorReporter, Unsubscribe } from '../application/ports';
/** Allowlisted metadata only. No raw exception text, paths, titles, stack or payload. */
export class Diagnostics implements ErrorReporter {
  private sequence = 0;
  private entries: Diagnostic[] = [];
  private readonly listeners = new Set<() => void>();
  constructor(private readonly observer?: (entry: Diagnostic) => void) {}
  get current(): readonly Diagnostic[] { return this.entries.slice(); }
  report(code: string, operation: string): void {
    const safe = (v: string) => /^[a-z.]+$/.test(v) ? v.slice(0, 80) : 'redacted';
    const entry = Object.freeze({ sequence: ++this.sequence, code: safe(code), operation: safe(operation) });
    this.entries = [...this.entries.slice(-199), entry];
    try { this.observer?.(entry); } catch { /* Observer failure cannot recurse into reporting. */ }
    for (const listener of this.listeners) { try { listener(); } catch { /* Bounded containment. */ } }
  }
  subscribe(listener: () => void): Unsubscribe { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  dispose(): void { this.listeners.clear(); this.entries = []; }
}
