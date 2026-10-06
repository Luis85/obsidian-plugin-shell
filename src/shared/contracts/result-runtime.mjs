/** Bootstrap-safe canonical machine-readable CLI envelope. Keep this file plain ESM. */
export function resultEnvelope(command, data, status = 'ok', diagnostics = []) {
  return { protocolVersion: 1, command, status, data, diagnostics };
}
