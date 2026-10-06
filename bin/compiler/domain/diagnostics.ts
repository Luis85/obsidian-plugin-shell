import type { CompilerDiagnostic, Phase, SourceLocation } from './contracts.ts';

/** Codes are public API. Catalog changes require documentation and protocol tests. */
export const diagnosticCatalog = Object.freeze({
  COMPILER_JSON_INVALID: 'Supply a complete UTF-8 project JSON document; check its syntax.',
  COMPILER_INPUT_LIMIT: 'Reduce the input to the supported 4 MB project limit.',
  COMPILER_SCHEMA_INVALID: 'Correct the named contract violation and run compiler check again.',
  COMPILER_REFERENCE_MISSING: 'Choose an existing target or explicitly remove the reference.',
  COMPILER_DUPLICATE_ID: 'Assign a unique identity; update references deliberately.',
  COMPILER_PATH_COLLISION: 'Give artifacts distinct portable paths or declare an intentional replacement.',
  COMPILER_TEMPLATE_INVALID: 'Restore the trusted framework template; do not modify the project to conceal a template defect.',
  COMPILER_DEPENDENCY_RESOLUTION_REQUIRED: 'Review the declared packages, run npm install explicitly, then verify the lockfile before npm ci.',
  COMPILER_ADAPTER_REQUIRED: 'Implement the external adapter; its placeholder is not a completed interaction.',
  COMPILER_CANCELLED: 'The operation was cancelled. Re-run only after reviewing the current workspace.',
  COMPILER_DIAGNOSTICS_TRUNCATED: 'Repair the reported errors and rerun to inspect remaining diagnostics.',
  COMPILER_REPORT_FAILED: 'Choose a new contained reports/compiler destination; do not retry file writes blindly.',
  COMPILER_INTERNAL: 'Retain the debug report and report a compiler defect; do not edit the project spec blindly.',
});
export type DiagnosticCode = keyof typeof diagnosticCatalog;
export function diagnostic(code: DiagnosticCode, phase: Phase, message: string, source?: SourceLocation): CompilerDiagnostic {
  return { code, phase, severity: code === 'COMPILER_DEPENDENCY_RESOLUTION_REQUIRED' || code === 'COMPILER_ADAPTER_REQUIRED' ? 'warning' : 'error',
    message, help: diagnosticCatalog[code], retryable: false, ...(source ? { source } : {}) };
}
export class CompilerError extends Error {
  readonly diagnostic: CompilerDiagnostic;
  constructor(value: CompilerDiagnostic, options?: ErrorOptions) {
    super(value.message, options);
    this.name = 'CompilerError';
    this.diagnostic = value;
  }
}
export function orderedDiagnostics(values: readonly CompilerDiagnostic[], limit = 100): CompilerDiagnostic[] {
  const key = (d: CompilerDiagnostic) => [d.source?.file ?? '', d.source?.jsonPointer ?? '', d.code, d.message].join('\0');
  const sorted = [...values].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit - 1), diagnostic('COMPILER_DIAGNOSTICS_TRUNCATED', 'validate', `${values.length - limit + 1} additional diagnostics omitted.`)];
}

/** Aggregate failures retain all independently actionable diagnostics at adapter boundaries. */
export class CompilationFailure extends CompilerError {
  readonly diagnostics: CompilerDiagnostic[];
  constructor(values: CompilerDiagnostic[]) {
    super(values.find(value=>value.severity==='error') ?? diagnostic('COMPILER_INTERNAL','emit','Compilation failed.'));
    this.diagnostics=values;
  }
}
