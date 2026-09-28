/** Stable failures shared by authoring, persistence and terminal adapters. */
export class SketchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message); this.name = 'SketchError'; this.code = code;
  }
}
export function requireSketch(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new SketchError(code, message);
}
export function title(value: string, limit = 120): string {
  const text = value.trim();
  requireSketch(text.length > 0 && text.length <= limit && !/[\u0000-\u001f\u007f-\u009f]/u.test(text),
    'SKETCH_TITLE', `Enter a single-line title between 1 and ${limit} characters.`);
  return text;
}
/** Titles remain Unicode; identifiers are portable, deterministic and independent of later renames. */
export function slug(value: string, prefix: string, used: readonly string[] = []): string {
  const cleaned = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/g, '');
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|constructor|prototype)$/i;
  const base = !cleaned || !/^[a-z]/.test(cleaned) || reserved.test(cleaned) ? `${prefix}-${cleaned || 'draft'}` : cleaned;
  const existing = new Set(used.map(item => item.toLowerCase()));
  let result = base, serial = 2;
  while (existing.has(result.toLowerCase())) result = `${base}-${serial++}`;
  return result;
}
