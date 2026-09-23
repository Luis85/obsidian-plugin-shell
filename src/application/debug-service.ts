import { StructuredLogger } from './logging';
import type { Diagnostic } from './ports';
interface DebugIdentity { readonly id: string; readonly version: string; readonly host: 'browser' | 'obsidian' }
function captureIdentity(input: DebugIdentity | undefined): DebugIdentity | undefined {
  if (input === undefined) return undefined;
  try {
    if (input === null || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).length !== 3 || Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !['id', 'version', 'host'].includes(key))) throw new Error();
    for (const field of ['id', 'version', 'host']) if (!descriptors[field] || !Object.hasOwn(descriptors[field], 'value')) throw new Error();
    const id: unknown = descriptors.id?.value; const version: unknown = descriptors.version?.value; const host: unknown = descriptors.host?.value;
    if (typeof id !== 'string' || id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)
      || typeof version !== 'string' || version.length > 40 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
      || (host !== 'browser' && host !== 'obsidian')) throw new Error();
    return Object.freeze({ id, version, host });
  } catch { throw new Error('INVALID_DEBUG_IDENTITY'); }
}
/** Export only explicit log records and aggregate diagnostic counts, never raw causes. */
export class DebugService {
  private readonly identity?: DebugIdentity;
  constructor(private readonly logger: StructuredLogger, private readonly diagnostics: () => readonly Diagnostic[], identity?: DebugIdentity) { this.identity = captureIdentity(identity); }
  get enabled(): boolean { return this.logger.level === 'debug'; }
  setEnabled(enabled: boolean): void {
    this.logger.setLevel(enabled ? 'debug' : 'info');
    this.logger.info('debug.changed', 'debug.inspect', { count: enabled ? 1 : 0 });
  }
  snapshot(maxRecords = this.logger.capacity) {
    if (!Number.isSafeInteger(maxRecords) || maxRecords < 0 || maxRecords > 1000) throw new Error('INVALID_DEBUG_EXPORT_LIMIT');
    const diagnostics = this.diagnostics();
    const all = this.logger.current; const logs = maxRecords === 0 ? [] : all.slice(-maxRecords);
    return Object.freeze({ schemaVersion: 1, scope: 'runtime-debugging', debugEnabled: this.enabled, level: this.logger.level,
      ...(this.identity ? { identity: this.identity } : {}),
      logs: Object.freeze(logs), statistics: this.logger.statistics,
      recordScope: Object.freeze({ retained: all.length, exported: logs.length, omitted: all.length - logs.length }),
      diagnostics: Object.freeze({ retained: diagnostics.length, observed: diagnostics.at(-1)?.sequence ?? 0 }),
      exclusions: Object.freeze(['note-content', 'titles', 'paths', 'raw-causes', 'stacks', 'credentials', 'host-objects']) });
  }
  exportJSON(options: { maxRecords?: number } = {}): string { return JSON.stringify(this.snapshot(options.maxRecords), null, 2); }
}
