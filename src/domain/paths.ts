import { failure, success, type Result } from './outcome';
// Intentional security boundary: reject ASCII control characters in path segments.
// oxlint-disable-next-line no-control-regex
const forbidden = /[<>:"|?*\\\u0000-\u001f]/;
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
export function documentStem(title: string): string {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55).replace(/-$/, '') || 'document';
}
