/** Effect is independent of severity: a follow-up error never undoes a write. */
export type FailureCode = 'validation' | 'conflict' | 'storage' | 'uncertain' | 'stale' | 'disposed' | 'unexpected';
export interface Failure {
  readonly code: FailureCode;
  readonly key: string;
  readonly effect: 'none' | 'committed' | 'uncertain';
  readonly field?: string;
}
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Failure };
export const success = <T>(value: T): Result<T> => ({ ok: true, value });
export const failure = (code: FailureCode, key: string, field?: string): Result<never> => ({
  ok: false, error: { code, key, effect: code === 'uncertain' ? 'uncertain' : 'none', ...(field ? { field } : {}) },
});
