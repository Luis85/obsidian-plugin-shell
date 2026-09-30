import { CompilerError, CompilationFailure } from '../compiler/domain/diagnostics.ts';
import { result, type Result } from '../contracts/result.ts';
export { result } from '../contracts/result.ts';
export type { Diagnostic, Result } from '../contracts/result.ts';
/** Public host-independent operation contract. Requests never grant execution authority. */
export type Values = Record<string, string | boolean>;
export interface Request { command: string; args: string[]; options: Values }
export interface Context {
  root: string;
  frameworkRoot: string;
  signal?: AbortSignal;
  inputText?: string;
  progress?: (message: string) => void;
}
export class OperationError extends Error {
  readonly code: string;
  readonly next?: string;
  details?: unknown;
  constructor(code: string, message: string, next?: string) {
    super(message); this.name = 'OperationError'; this.code = code; this.next = next;
  }
}
export function requireThat(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new OperationError(code, message);
}
export function failure(command: string, error: unknown): Result {
  if (error instanceof CompilerError) return { ...result(command, null, error.diagnostic.code === 'COMPILER_CANCELLED' ? 'cancelled' : 'failed'),
    diagnostics: error instanceof CompilationFailure ? error.diagnostics : [error.diagnostic] };
  const code = error instanceof OperationError ? error.code : error instanceof Error ? /^([A-Z][A-Z_0-9]+)(?::|$)/.exec(error.message)?.[1] ?? 'OPERATION_FAILED' : 'OPERATION_FAILED';
  const message = error instanceof Error ? error.message : 'Operation failed.';
  return { ...result(command, recoveryDetails(error), code === 'CANCELLED' ? 'cancelled' : 'failed'),
    diagnostics: [{ code, message, ...(error instanceof OperationError && error.next ? { next: error.next } : {}) }] };
}
/** Preserve bounded recovery outcomes without exposing arbitrary Error fields or causes. */
function recoveryDetails(error: unknown): unknown {
  if (error instanceof OperationError && error.details !== undefined) return error.details;
  if (!(error instanceof Error)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'report');
  if (!descriptor || !('value' in descriptor) || !descriptor.value || typeof descriptor.value !== 'object') return null;
  const report: Record<string, unknown> = {};
  for (const key of ['status', 'written', 'unchanged', 'rolledBack', 'preserved', 'remaining', 'recoveryPath']) {
    const field = Object.getOwnPropertyDescriptor(descriptor.value, key);
    if (!field || !('value' in field)) continue;
    if (typeof field.value === 'string') report[key] = field.value.slice(0, 4096);
    else if (Array.isArray(field.value)) report[key] = field.value.filter((item: unknown) => typeof item === 'string').slice(0, 5000);
  }
  return { recovery: report, automaticRetry: false };
}
export function stringOption(options: Values, name: string): string | undefined {
  const value = options[name];
  if (value === undefined) return undefined;
  requireThat(typeof value === 'string', 'INVALID_OPTION', `${name} requires a value.`);
  return value;
}
