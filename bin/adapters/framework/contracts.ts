import { CompilerError, CompilationFailure } from '../../compiler/domain/diagnostics.ts';
import { result, type Result } from '../../../scripts/contracts/result.ts';
import { OperationError, requireThat } from '../../../scripts/contracts/errors.ts';
export { result } from '../../../scripts/contracts/result.ts';
export type { Diagnostic, Result, ResultStatus } from '../../../scripts/contracts/result.ts';
export { OperationError, requireThat } from '../../../scripts/contracts/errors.ts';
import type { IncrementServices } from '../increments/repository.ts';
/** Public host-independent operation contract. Requests never grant execution authority. */
export type Values = Record<string, string | boolean>;
export interface Request { command: string; args: string[]; options: Values }
export interface Context {
  root: string;
  frameworkRoot: string;
  signal?: AbortSignal;
  inputText?: string;
  progress?: (message: string) => void;
  /** Test seams of the increment and pull-request commands (version control runner, hosting remote, clock). */
  increments?: IncrementServices;
}
/** An OperationError keeps its code; another Error may lead with an `UPPER_CASE:` code. */
function failureCode(error: unknown): string {
  if (error instanceof OperationError) return error.code;
  if (!(error instanceof Error)) return 'OPERATION_FAILED';
  return /^([A-Z][A-Z_0-9]+)(?::|$)/.exec(error.message)?.[1] ?? 'OPERATION_FAILED';
}
export function failure(command: string, error: unknown): Result {
  if (error instanceof CompilerError) return { ...result(command, null, error.diagnostic.code === 'COMPILER_CANCELLED' ? 'cancelled' : 'failed'),
    diagnostics: error instanceof CompilationFailure ? error.diagnostics : [error.diagnostic] };
  const code = failureCode(error);
  // A plain Error that leads with its code reports it once: the diagnostic already carries the code.
  const message = error instanceof Error ? (error instanceof OperationError ? error.message : error.message.replace(new RegExp(`^${code}:\\s*`), '') || error.message) : 'Operation failed.';
  return { ...result(command, recoveryDetails(error), code === 'CANCELLED' ? 'cancelled' : 'failed'),
    diagnostics: [{ code, message, ...(error instanceof OperationError && error.next ? { next: error.next } : {}) }] };
}
/** Preserve bounded recovery outcomes without exposing arbitrary Error fields or causes. */
function recoveryDetails(error: unknown): unknown {
  if (error instanceof OperationError && error.details !== undefined) return error.details;
  if (!(error instanceof Error)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(error, 'report');
  if (!descriptor || !('value' in descriptor) || !descriptor.value || typeof descriptor.value !== 'object') return null;
  return { recovery: boundedReport(descriptor.value as object), automaticRetry: false };
}
/** Copies only own data fields holding strings or string lists, each bounded. */
function boundedReport(source: object): Record<string, unknown> {
  const report: Record<string, unknown> = {};
  for (const key of ['status', 'written', 'unchanged', 'rolledBack', 'preserved', 'remaining', 'recoveryPath']) {
    const field = Object.getOwnPropertyDescriptor(source, key);
    if (!field || !('value' in field)) continue;
    if (typeof field.value === 'string') report[key] = field.value.slice(0, 4096);
    else if (Array.isArray(field.value)) report[key] = field.value.filter((item: unknown) => typeof item === 'string').slice(0, 5000);
  }
  return report;
}
export function stringOption(options: Values, name: string): string | undefined {
  const value = options[name];
  if (value === undefined) return undefined;
  requireThat(typeof value === 'string', 'INVALID_OPTION', `${name} requires a value.`);
  return value;
}
