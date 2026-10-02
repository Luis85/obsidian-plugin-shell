import { assertJsonData } from '../contracts/json-data.mjs';
import { capabilityCatalog, catalogDigest } from './catalog.mjs';

const errors = Object.freeze({
  INVALID_REQUEST: 'Invalid discovery request. No operation was executed.',
  UNKNOWN_VERSION: 'Unsupported protocol version. Version 1 is required.',
  UNKNOWN_OPERATION: 'Unknown operation. Read the capability catalog.',
  CAPABILITY_PLANNED: 'This capability is planned, not executable.',
  CLI_HANDOFF_REQUIRED: 'Use the separately trusted existing CLI. Protocol execution is not implemented.',
  INTERNAL_ERROR: 'Discovery could not be completed. No operation was executed.',
});
export const protocolHandlers = Object.freeze({
  'capabilities.read': catalog => catalog,
  'makers.list': catalog => catalog.makers,
});
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value);
function requireThat(condition) { if (!condition) throw new Error('PROTOCOL_INVALID'); }
function keys(value, expected) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  requireThat(Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)));
}
function header(message) {
  requireThat(message.protocolVersion === 1 && validId(message.requestId) && validId(message.operation));
}
function receipt(value, message) {
  keys(value, ['requestId', 'operation', 'catalogDigest', 'authorization', 'sideEffects', 'outcome']);
  requireThat(value.requestId === message.requestId && value.operation === message.operation);
  requireThat(typeof value.catalogDigest === 'string' && /^[a-f0-9]{64}$/.test(value.catalogDigest));
  requireThat(value.authorization === 'none' && Array.isArray(value.sideEffects) && value.sideEffects.length === 0);
  requireThat(value.outcome === (message.type === 'result' ? 'succeeded' : 'rejected'));
}
function progress(message) {
  keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'sequence', 'phase', 'completed', 'total']);
  requireThat(Object.hasOwn(protocolHandlers, message.operation) && message.phase === 'discovery');
  for (const key of ['sequence', 'completed', 'total']) requireThat(Number.isSafeInteger(message[key]) && message[key] >= 0);
  requireThat(message.completed <= message.total);
}
export function validateMessage(message) {
  try { assertJsonData(message); } catch { throw new Error('PROTOCOL_JSON'); }
  requireThat(message && typeof message === 'object'); header(message);
  if (message.type === 'request') {
    keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'input']);
    keys(message.input, []);
  } else if (message.type === 'progress') progress(message);
  else if (message.type === 'result') {
    keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'output', 'receipt']);
    requireThat(Object.hasOwn(protocolHandlers, message.operation)); receipt(message.receipt, message);
    const catalog = capabilityCatalog();
    requireThat(message.receipt.catalogDigest === catalogDigest(catalog));
    requireThat(JSON.stringify(message.output) === JSON.stringify(protocolHandlers[message.operation](catalog)));
  } else if (message.type === 'error') {
    keys(message, ['protocolVersion', 'type', 'requestId', 'operation', 'error', 'receipt']);
    receipt(message.receipt, message); keys(message.error, ['code', 'message']);
    requireThat(Object.hasOwn(errors, message.error.code) && errors[message.error.code] === message.error.message);
  } else requireThat(false);
  return true;
}
function envelope(type, requestId, operation, digest) {
  return { protocolVersion: 1, type, requestId, operation,
    receipt: { requestId, operation, catalogDigest: digest, authorization: 'none', sideEffects: [], outcome: type === 'result' ? 'succeeded' : 'rejected' } };
}
export function handleRequest(input) {
  let requestId = 'invalid-request'; let operation = 'unresolved'; let code = 'INTERNAL_ERROR';
  let digest = '0'.repeat(64);
  try {
    const catalog = capabilityCatalog(); digest = catalogDigest(catalog);
    code = 'INVALID_REQUEST';
    assertJsonData(input);
    if (input && typeof input === 'object') {
      if (validId(input.requestId)) requestId = input.requestId;
      if (catalog.operations.some(item => item.id === input.operation)) operation = input.operation;
      if (input.protocolVersion !== 1) code = 'UNKNOWN_VERSION';
    }
    validateMessage(input);
    requireThat(input.type === 'request');
    const descriptor = catalog.operations.find(item => item.id === input.operation);
    if (!descriptor) code = 'UNKNOWN_OPERATION';
    else if (descriptor.status === 'planned') code = 'CAPABILITY_PLANNED';
    else if (!descriptor.transports.includes('protocol')) code = 'CLI_HANDOFF_REQUIRED';
    else {
      const result = envelope('result', requestId, operation, digest);
      result.output = protocolHandlers[operation](catalog);
      validateMessage(result);
      return result;
    }
  } catch { /* Fixed messages deliberately omit paths, supplied data and exception stacks. */ }
  return { ...envelope('error', requestId, operation, digest), error: { code, message: errors[code] } };
}
