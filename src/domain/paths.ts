import { failure, success, type Result } from './outcome';
// Intentional security boundary: reject ASCII control characters in path segments.
// oxlint-disable-next-line no-control-regex
const forbidden = /[<>:"|?*\\\u0000-\u001f\u007f]/;
const device = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
/** Vault-relative paths only. Never address hidden/configuration folders. */
export function validateFolder(input: unknown): Result<string> {
  if (typeof input !== 'string' || input.length > 160 || input !== input.trim()) return failure('validation', 'error.folder', 'folder');
  const folder = input.trim();
  const segments = folder.split('/');
  if (!folder || segments.some(p => !p || p.startsWith('.') || /[ .]$/.test(p) || forbidden.test(p) || device.test(p))) {
    return failure('validation', 'error.folder', 'folder');
  }
  return success(folder);
}
/** Validate a portable note basename without altering its spelling or Unicode. */
export function validateDocumentTitle(input: unknown): Result<string> {
  const invalid = () => failure('validation', 'error.filename', 'title');
  if (typeof input !== 'string' || !input.trim() || input.length > 252 || input.startsWith('.') || /[ .]$/.test(input)
    || input.includes('/') || forbidden.test(input) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?: *\.| *$)/i.test(input)) return invalid();
  return fitsFilenameBytes(input) ? success(input) : invalid();
}
function fitsFilenameBytes(input: string): boolean {
  // .md adds three bytes to the common 255-byte filesystem component limit.
  // URI encoding counts UTF-8 bytes and rejects unpaired surrogate code units.
  try { return encodeURIComponent(input).replace(/%[\dA-F]{2}/g, 'x').length <= 252; }
  catch { return false; }
}
