import { assertJsonData } from '#shared/contracts/json-data.ts';
import { capabilityCatalog, catalogDigest, type CapabilityCatalog } from './catalog.ts';

const errors = Object.freeze({
  INVALID_REQUEST: 'Invalid discovery request. No operation was executed.',
  UNKNOWN_VERSION: 'Unsupported protocol version. Version 1 is required.',
  UNKNOWN_OPERATION: 'Unknown operation. Read the capability catalog.',
  CAPABILITY_PLANNED: 'This capability is planned, not executable.',
  CLI_HANDOFF_REQUIRED: 'Use the separately trusted existing CLI. Protocol execution is not implemented.',
  INTERNAL_ERROR: 'Discovery could not be completed. No operation was executed.',
});
type ErrorCode = keyof typeof errors;
type Data = Record<string, unknown>;
export const protocolHandlers: Readonly<Record<string, (catalog: CapabilityCatalog) => unknown>> = Object.freeze({
  'capabilities.read': (catalog: CapabilityCatalog) => catalog,
  'makers.list': (catalog: CapabilityCatalog) => catalog.makers,
});
interface Receipt { requestId: string; operation: string; catalogDigest: string; authorization: 'none'; sideEffects: never[]; outcome: 'succeeded' | 'rejected' }
interface Envelope { protocolVersion: 1; type: 'result' | 'error'; requestId: string; operation: string; receipt: Receipt }
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value);
function requireThat(condition: unknown): asserts condition { if (!condition) throw new Error('PROTOCOL_INVALID'); }
const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
function keys(value: unknown, expected: readonly string[]): asserts value is Data {
  requireThat(isData(value));
  requireThat(Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)));
}
const handled = (operation: unknown): operation is string => typeof operation === 'string' && Object.hasOwn(protocolHandlers, operation);
function receipt(value: unknown, message: Data): void {
  keys(value, ['requestId', 'operation', 'catalogDigest', 'authorization', 'sideEffects', 'outcome']);
  requireThat(value.requestId === message.requestId && value.operation === message.operation);
  requireThat(typeof value.catalogDigest === 'string' && /^[a-f0-9]{64}$/.test(value.catalogDigest));
  requireThat(value.authorization === 'none' && Array.isArray(value.sideEffects) && value.sideEffects.length === 0);
  requireThat(value.outcome === (message.type === 'result' ? 'succeeded' : 'rejected'));
}
function progress(message: Data): void {
  keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'sequence', 'phase', 'completed', 'total']);
  requireThat(handled(message.operation) && message.phase === 'discovery');
  for (const key of ['sequence', 'completed', 'total']) requireThat(Number.isSafeInteger(message[key]) && Number(message[key]) >= 0);
  requireThat(Number(message.completed) <= Number(message.total));
}
function result(message: Data): void {
  keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'output', 'receipt']);
  const { operation } = message;
  requireThat(handled(operation)); receipt(message.receipt, message);
  const catalog = capabilityCatalog();
  requireThat(isData(message.receipt) && message.receipt.catalogDigest === catalogDigest(catalog));
  const handler = protocolHandlers[operation]; requireThat(handler);
  requireThat(JSON.stringify(message.output) === JSON.stringify(handler(catalog)));
}
function failure(message: Data): void {
  keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'error', 'receipt']);
  receipt(message.receipt, message); keys(message.error, ['code', 'message']);
  const { code } = message.error;
  requireThat(typeof code === 'string' && Object.hasOwn(errors, code) && errors[code as ErrorCode] === message.error.message);
}
const validators: Readonly<Record<string, (message: Data) => void>> = {
  request: message => { keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'input']); keys(message.input, []); },
  progress, result, error: failure,
};
export function validateMessage(message: unknown): true {
  try { assertJsonData(message); } catch { throw new Error('PROTOCOL_JSON'); }
  requireThat(isData(message));
  requireThat(message.protocolVersion === 1 && validId(message.requestId) && validId(message.operation));
  const validate = typeof message.type === 'string' && Object.hasOwn(validators, message.type) ? validators[message.type] : undefined;
  requireThat(validate); validate(message);
  return true;
}
function envelope(type: Envelope['type'], requestId: string, operation: string, digest: string): Envelope {
  return { protocolVersion: 1, type, requestId, operation,
    receipt: { requestId, operation, catalogDigest: digest, authorization: 'none', sideEffects: [], outcome: type === 'result' ? 'succeeded' : 'rejected' } };
}
interface Attempt { requestId: string; operation: string; code: ErrorCode; digest: string }
/** Records the best-known request identity before validation so a rejection still echoes it. */
function identify(attempt: Attempt, catalog: CapabilityCatalog, input: unknown): void {
  // Arrays are objects here too: an unversioned array is reported as an unknown version, not a generic refusal.
  if (typeof input !== 'object' || input === null) return;
  const requestId: unknown = Reflect.get(input, 'requestId'), operation: unknown = Reflect.get(input, 'operation');
  if (validId(requestId)) attempt.requestId = requestId;
  const known = catalog.operations.find(item => item.id === operation);
  if (known) attempt.operation = known.id;
  if (Reflect.get(input, 'protocolVersion') !== 1) attempt.code = 'UNKNOWN_VERSION';
}
function refusal(catalog: CapabilityCatalog, operation: unknown): ErrorCode | null {
  const descriptor = catalog.operations.find(item => item.id === operation);
  if (!descriptor) return 'UNKNOWN_OPERATION';
  if (descriptor.status === 'planned') return 'CAPABILITY_PLANNED';
  return descriptor.transports.includes('protocol') ? null : 'CLI_HANDOFF_REQUIRED';
}
function answer(attempt: Attempt, input: unknown): (Envelope & { output: unknown }) | null {
  const catalog = capabilityCatalog(); attempt.digest = catalogDigest(catalog);
  attempt.code = 'INVALID_REQUEST';
  assertJsonData(input);
  identify(attempt, catalog, input);
  validateMessage(input);
  requireThat(isData(input) && input.type === 'request');
  const code = refusal(catalog, input.operation);
  if (code) { attempt.code = code; return null; }
  const handler = protocolHandlers[attempt.operation]; requireThat(handler);
  const response = { ...envelope('result', attempt.requestId, attempt.operation, attempt.digest), output: handler(catalog) };
  validateMessage(response);
  return response;
}
export function handleRequest(input: unknown) {
  const attempt: Attempt = { requestId: 'invalid-request', operation: 'unresolved', code: 'INTERNAL_ERROR', digest: '0'.repeat(64) };
  try {
    const response = answer(attempt, input);
    if (response) return response;
  } catch { /* Fixed messages deliberately omit paths, supplied data and exception stacks. */ }
  return { ...envelope('error', attempt.requestId, attempt.operation, attempt.digest), error: { code: attempt.code, message: errors[attempt.code] } };
}
