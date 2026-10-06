import { failure, success, type Failure, type Result } from '../domain/outcome';
import { plainRecord } from '../domain/entity';
import { commandCatalog, type CommandDefinition, type CommandGroup } from './command-definitions';
import type { ErrorReporter } from './ports';

interface ExecutionEvent { readonly id: string; readonly phase: 'started' | 'completed' | 'failed'; readonly effect?: Failure['effect'] }
interface CommandOptions {
  readonly validKey: (key: string) => boolean;
  readonly observe?: (event: ExecutionEvent) => void | Promise<void>;
  readonly onFailure?: (error: Failure, commandId: string) => void | Promise<void>;
}
/** Snapshot data descriptors without executing accessors or retaining arbitrary result payloads. */
function dataDescriptors(value: unknown): PropertyDescriptorMap | undefined {
  if (!plainRecord(value)) return undefined;
  const result = Object.getOwnPropertyDescriptors(value);
  if (Object.values(result).some(property => !Object.hasOwn(property, 'value'))) return undefined;
  return result;
}
function resultSnapshot(value: unknown): unknown {
  const result = dataDescriptors(value);
  if (!result) return undefined;
  if (result.ok?.value === true) return Object.freeze({ ok: true, value: undefined });
  if (result.ok?.value !== false) return undefined;
  return failureSnapshot(result.error?.value);
}
function failureSnapshot(value: unknown): unknown {
  const error = dataDescriptors(value);
  if (!error) return undefined;
  return Object.freeze({ ok: false, error: Object.freeze({ code: error.code?.value, key: error.key?.value, effect: error.effect?.value, field: error.field?.value }) });
}
function returnedResult(value: unknown): value is Result<unknown> {
  if (!plainRecord(value)) return false;
  if (value.ok === true) return true;
  if (value.ok !== false || !plainRecord(value.error)) return false;
  return returnedFailure(value.error);
}
function returnedFailure(error: Record<string, unknown>): boolean {
  return typeof error.code === 'string' && ['validation', 'conflict', 'storage', 'uncertain', 'stale', 'disposed', 'unexpected'].includes(error.code)
    && typeof error.key === 'string' && typeof error.effect === 'string' && ['none', 'committed', 'uncertain'].includes(error.effect)
    && (error.field === undefined || typeof error.field === 'string');
}
function thenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value && typeof value.then === 'function';
}

/** Runtime-scoped dispatch. Completion describes the handler, not an inferred business success. */
export class CommandService {
  readonly catalog: ReturnType<typeof commandCatalog>;
  private readonly commands: Map<string, CommandDefinition>;
  private readonly running = new Map<string, Promise<Result<void>>>();
  private disposed = false;
  constructor(groups: readonly CommandGroup[], private readonly errors: ErrorReporter, private readonly options: CommandOptions) {
    this.catalog = commandCatalog(groups, options.validKey);
    this.commands = new Map(this.catalog.commands.map(command => [command.id, command]));
  }
  available(id: string): boolean {
    if (this.disposed || this.running.has(id)) return false;
    const command = this.commands.get(id);
    if (!command) return false;
    const enabled = this.check(command);
    return !this.disposed && enabled;
  }
  private check(command: CommandDefinition): boolean {
    try {
      if (!command.available) return true;
      const value: unknown = command.available();
      if (thenable(value)) { void Promise.resolve(value).catch(() => undefined); this.errors.report('command.availability', 'command.check'); return false; }
      if (typeof value !== 'boolean') { this.errors.report('command.availability', 'command.check'); return false; }
      return value;
    } catch { this.errors.report('command.availability', 'command.check'); return false; }
  }
  execute(id: string): Promise<Result<void>> {
    if (this.disposed) return Promise.resolve(failure('disposed', 'error.disposed'));
    const pending = this.running.get(id);
    if (pending) return pending;
    const command = this.commands.get(id);
    if (!command || !this.available(id)) return Promise.resolve(failure('validation', 'error.commandUnavailable'));
    // Publish the in-flight promise before invoking author code, including reentrant callbacks.
    const work = Promise.resolve().then(() => this.disposed ? failure('disposed', 'error.disposed') : this.perform(command));
    this.running.set(id, work);
    void work.then(() => { this.running.delete(id); }, () => { this.running.delete(id); });
    return work;
  }
  private async perform(command: CommandDefinition): Promise<Result<void>> {
    if (!this.check(command)) return failure('validation', 'error.commandUnavailable');
    if (this.disposed) return failure('disposed', 'error.disposed');
    this.observe({ id: command.id, phase: 'started' });
    if (this.disposed) return failure('disposed', 'error.disposed');
    let result: Result<void>;
    try {
      const raw: unknown = await command.execute();
      result = this.interpret(raw);
    } catch {
      this.errors.report('command.execute', 'command.execute');
      result = { ok: false, error: { code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' } };
    }
    return this.complete(command.id, result);
  }
  private interpret(raw: unknown): Result<void> {
    const returned = resultSnapshot(raw);
    if (raw === undefined) return success(undefined);
    if (returnedResult(returned)) return returned.ok ? success(undefined) : { ok: false, error: this.failureValue(returned.error) };
    this.errors.report('command.result', 'command.execute');
    return { ok: false, error: { code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' } };
  }
  private async complete(id: string, result: Result<void>): Promise<Result<void>> {
    if (!this.disposed) {
      this.observe({ id, phase: result.ok ? 'completed' : 'failed', ...(!result.ok ? { effect: result.error.effect } : {}) });
      if (!result.ok && !this.disposed) {
        try { await this.options.onFailure?.(result.error, id); }
        catch { this.errors.report('command.feedback', 'command.feedback'); }
      }
    }
    return result;
  }
  private observe(event: ExecutionEvent): void {
    try {
      const work = this.options.observe?.(event);
      if (thenable(work)) void Promise.resolve(work).catch(() => this.errors.report('command.observer', 'command.observe'));
    }
    catch { this.errors.report('command.observer', 'command.observe'); }
  }
  private failureValue(error: Failure): Failure {
    let valid = false;
    try { valid = /^[a-z][a-zA-Z0-9_.-]{0,99}$/.test(error.key) && this.options.validKey(error.key); }
    catch { /* Invalid localization metadata does not change the reported persistence effect. */ }
    if (!valid) this.errors.report('command.result', 'command.execute');
    return Object.freeze({ code: error.code, key: valid ? error.key : 'error.unexpected', effect: error.effect,
      ...(error.field && /^[a-z][a-zA-Z0-9_.-]{0,79}$/.test(error.field) ? { field: error.field } : {}) });
  }
  dispose(): void { this.disposed = true; }
}
