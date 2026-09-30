/** Canonical machine-readable CLI result envelope shared by framework and maker surfaces. */
export type ResultStatus = 'ok' | 'planned' | 'applied' | 'unchanged' | 'blocked' | 'cancelled' | 'failed';

export interface Diagnostic {
  code: string;
  message: string;
  next?: string;
  severity?: 'error' | 'warning' | 'info';
  phase?: string;
  help?: string;
  retryable?: boolean;
  source?: unknown;
  related?: unknown[];
}

export interface Result<Data = unknown> {
  protocolVersion: 1;
  command: string;
  status: ResultStatus;
  data: Data;
  diagnostics: Diagnostic[];
}

export function result<Data>(command: string, data: Data, status: ResultStatus = 'ok'): Result<Data> {
  return { protocolVersion: 1, command, status, data, diagnostics: [] };
}
