export interface Diagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  path?: string
  operation?: 'load' | 'save' | 'import' | 'command'
}
export type Failure = { ok: false; diagnostics: Diagnostic[] }
export type Result<T> = { ok: true; value: T; diagnostics: Diagnostic[] } | Failure
export const success = <T>(value: T, diagnostics: Diagnostic[] = []): Result<T> => ({ ok: true, value, diagnostics })
export const failure = (code: string, message: string, path?: string, operation?: Diagnostic['operation']): Failure => ({
  ok: false, diagnostics: [{ code, severity: 'error', message, path, operation }]
})
export const failureWith = (diagnostics: Diagnostic[]): Failure => ({ ok: false, diagnostics })
