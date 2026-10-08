import type { ErrorReporter, Unsubscribe } from './ports';
import type { Failure } from '../domain/outcome';
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';
const levels = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
const correlationBrand: unique symbol = Symbol('logging-correlation');
interface Correlation { readonly [correlationBrand]: true }
export interface LogMetadata {
  readonly count?: number; readonly attempt?: number; readonly durationMs?: number;
  readonly effect?: Failure['effect']; readonly correlation?: Correlation;
}
interface SafeMetadata { readonly count?: number; readonly attempt?: number; readonly durationMs?: number; readonly effect?: Failure['effect']; readonly correlation?: number }
export interface LogRecord {
  readonly sequence: number; readonly timestamp: string | null; readonly level: Exclude<LogLevel, 'off'>;
  readonly code: string; readonly operation: string; readonly metadata: SafeMetadata;
}
interface LogCatalog<C extends string, O extends string> { readonly scope: string; readonly codes: readonly C[]; readonly operations: readonly O[] }
const identifier = (value: unknown, maximum = 100): value is string => typeof value === 'string' && value.length <= maximum && /^[a-z][a-z0-9.-]*$/.test(value);
function identifiers(values: readonly string[]): boolean {
  return Array.isArray(values) && values.length > 0 && values.length <= 100
    && values.every(value => identifier(value)) && new Set(values).size === values.length;
}
function metadataDescriptors(input: object): PropertyDescriptorMap | undefined {
  if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  return Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !['count', 'attempt', 'durationMs', 'effect', 'correlation'].includes(key)) ? undefined : descriptors;
}
/** Catalogs are authored static declarations, never generated from user content. */
export function defineLogCatalog<const C extends readonly string[], const O extends readonly string[]>(scope: string, definition: { readonly codes: C; readonly operations: O }): LogCatalog<C[number], O[number]> {
  if (!identifier(scope, 64) || !identifiers(definition.codes) || !identifiers(definition.operations)) throw new Error('INVALID_LOG_CATALOG');
  return Object.freeze({ scope, codes: Object.freeze([...definition.codes]), operations: Object.freeze([...definition.operations]) });
}
const coreCatalog = defineLogCatalog('core', {
  codes: ['runtime.started', 'operation.started', 'operation.completed', 'operation.failed', 'debug.changed'],
  operations: ['runtime.initialize', 'command.execute', 'modal.open', 'document.create', 'debug.inspect'],
});
type CoreCode = typeof coreCatalog.codes[number];
type CoreOperation = typeof coreCatalog.operations[number];
/** Bounded opt-in detail logging. Diagnostic failure evidence is owned independently. */
export class StructuredLogger {
  private records: LogRecord[] = [];
  private readonly listeners = new Set<() => void | Promise<void>>();
  private readonly catalogs = new Set<string>();
  private readonly correlations = new WeakMap<object, number>();
  private correlationSequence = 0; private sequence = 0; private disposed = false;
  private dropped = 0; private rejected = 0; private cleared = 0;
  private reentrant = 0; private deliverySkipped = 0; private reporting = false; private writing = false; private notifying = false;
  private readonly pendingDeliveries = new WeakSet<object>();
  private selected: LogLevel = 'info';
  readonly capacity: number;
  private readonly observer?: (record: LogRecord) => void | Promise<void>;
  private readonly core;
  constructor(private readonly errors: ErrorReporter, private readonly now: () => string,
    options: { capacity?: number; observe?: (record: LogRecord) => void | Promise<void> } = {}) {
    this.capacity = options.capacity ?? 200;
    if (!Number.isSafeInteger(this.capacity) || this.capacity < 1 || this.capacity > 1000) throw new Error('INVALID_LOG_CAPACITY');
    this.observer = options.observe;
    this.core = this.registerCatalog(coreCatalog);
  }
  get level(): LogLevel { return this.selected; }
  get current(): readonly LogRecord[] { return Object.freeze([...this.records]); }
  get statistics() { return Object.freeze({ capacity: this.capacity, retained: this.records.length, dropped: this.dropped, rejected: this.rejected, cleared: this.cleared, reentrant: this.reentrant, deliverySkipped: this.deliverySkipped }); }
  setLevel(level: LogLevel): void {
    if (this.disposed) return;
    if (this.writing || this.notifying || this.reporting) { this.reentrant++; return; }
    if (typeof level !== 'string' || !Object.hasOwn(levels, level)) { this.reject(); return; }
    this.selected = level; this.changed();
  }
  correlation(): Correlation {
    if (this.disposed) throw new Error('LOGGER_DISPOSED');
    const value = Object.freeze({ [correlationBrand]: true as const }); this.correlations.set(value, ++this.correlationSequence); return value;
  }
  registerCatalog<C extends string, O extends string>(input: LogCatalog<C, O>) {
    if (this.disposed || this.catalogs.has(input.scope) || this.catalogs.size >= 100) throw new Error('LOG_CATALOG_CONFLICT');
    const catalog = defineLogCatalog(input.scope, input); this.catalogs.add(catalog.scope);
    const write = (level: Exclude<LogLevel, 'off'>, code: C, operation: O, metadata?: LogMetadata) => {
      if (this.disposed) return false;
      if (!catalog.codes.includes(code) || !catalog.operations.includes(operation)) { this.reject(); return false; }
      return this.record(level, `${catalog.scope}.${code}`, `${catalog.scope}.${operation}`, metadata);
    };
    return Object.freeze({
      debug: (code: C, operation: O, metadata?: LogMetadata) => write('debug', code, operation, metadata),
      info: (code: C, operation: O, metadata?: LogMetadata) => write('info', code, operation, metadata),
      warn: (code: C, operation: O, metadata?: LogMetadata) => write('warn', code, operation, metadata),
      error: (code: C, operation: O, metadata?: LogMetadata) => write('error', code, operation, metadata),
    });
  }
  debug(code: CoreCode, operation: CoreOperation, metadata?: LogMetadata): boolean { return this.core.debug(code, operation, metadata); }
  info(code: CoreCode, operation: CoreOperation, metadata?: LogMetadata): boolean { return this.core.info(code, operation, metadata); }
  warn(code: CoreCode, operation: CoreOperation, metadata?: LogMetadata): boolean { return this.core.warn(code, operation, metadata); }
  error(code: CoreCode, operation: CoreOperation, metadata?: LogMetadata): boolean { return this.core.error(code, operation, metadata); }
  private reject(): void { this.rejected++; this.report('logging.input', 'logging.record'); }
  private report(code: string, operation: string): void {
    if (this.reporting) { this.reentrant++; return; }
    this.reporting = true;
    try { this.errors.report(code, operation); } catch { /* Never recurse through a failed reporter. */ }
    finally { this.reporting = false; }
  }
  private metadata(input: unknown): SafeMetadata | undefined {
    if (input === undefined) return Object.freeze({});
    try {
      if (input === null || typeof input !== 'object') return undefined;
      const descriptors = metadataDescriptors(input);
      if (!descriptors) return undefined;
      const output: { count?: number; attempt?: number; durationMs?: number; effect?: Failure['effect']; correlation?: number } = {};
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!Object.hasOwn(descriptor, 'value')) return undefined;
        const value: unknown = descriptor.value;
        if (value === undefined) continue;
        if (!this.metadataField(output, key, value)) return undefined;
      }
      return Object.freeze(output);
    } catch { return undefined; }
  }
  private metadataField(output: { count?: number; attempt?: number; durationMs?: number; effect?: Failure['effect']; correlation?: number }, key: string, value: unknown): boolean {
    if (key === 'correlation') {
      if (value === null || typeof value !== 'object') return false;
      const registered = this.correlations.get(value);
      if (registered === undefined) return false;
      output.correlation = registered; return true;
    }
    if (key === 'effect') {
      if (value !== 'none' && value !== 'committed' && value !== 'uncertain') return false;
      output.effect = value; return true;
    }
    return this.numericMetadata(output, key, value);
  }
  private numericMetadata(output: { count?: number; attempt?: number; durationMs?: number }, key: string, value: unknown): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
    if (key === 'durationMs') { if (value > 86_400_000) return false; output.durationMs = value; return true; }
    if (value > 1_000_000 || !Number.isInteger(value)) return false;
    if (key === 'count') output.count = value; else output.attempt = value;
    return true;
  }
  private timestamp(): string | null {
    try {
      const value = this.now();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && new Date(value).toISOString() === value) return value;
    } catch { /* Invalid clock output is observed below. */ }
    this.report('logging.clock', 'logging.record'); return null;
  }
  private record(level: Exclude<LogLevel, 'off'>, code: string, operation: string, input: unknown): boolean {
    if (this.writing || this.notifying || this.reporting) { this.reentrant++; return false; }
    this.writing = true;
    try {
    const metadata = this.metadata(input); if (!metadata) { this.reject(); return false; }
    if (levels[level] > levels[this.selected]) return false;
    const timestamp = this.timestamp();
    if (this.disposed) return false;
    const entry = Object.freeze({ sequence: ++this.sequence, timestamp, level, code, operation, metadata });
    if (this.records.length === this.capacity) { this.records.shift(); this.dropped++; }
    this.records.push(entry);
    if (this.observer) this.deliver(() => this.observer?.(entry), 'logging.observer', 'logging.observe', this.observer);
    this.changed(); return true;
    } finally { this.writing = false; }
  }
  private deliver(callback: () => void | Promise<void>, code: string, operation: string, key: object = callback): void {
    if (this.pendingDeliveries.has(key)) { this.deliverySkipped++; return; }
    try {
      const result = callback();
      if (result) {
        this.pendingDeliveries.add(key);
        void Promise.resolve(result).then(() => { this.pendingDeliveries.delete(key); }, () => { this.pendingDeliveries.delete(key); this.report(code, operation); });
      }
    } catch { this.report(code, operation); }
  }
  private changed(): void {
    if (this.notifying) { this.reentrant++; return; }
    this.notifying = true;
    try {
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      if (!this.listeners.has(listener)) continue;
      this.deliver(listener, 'logging.listener', 'logging.notify');
    }
    } finally { this.notifying = false; }
  }
  subscribe(listener: () => void | Promise<void>): Unsubscribe { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  clear(): void { if (this.disposed) return; if (this.writing || this.notifying || this.reporting) { this.reentrant++; return; } this.records = []; this.cleared++; this.changed(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.selected = 'off'; this.listeners.clear(); this.records = []; }
}
