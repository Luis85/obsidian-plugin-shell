/** Host-independent operation error primitives shared by CLI adapters and core utilities. */
export class OperationError extends Error {
  readonly code: string;
  readonly next?: string;
  details?: unknown;

  constructor(code: string, message: string, next?: string) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    this.next = next;
  }
}

export function requireThat(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new OperationError(code, message);
}
