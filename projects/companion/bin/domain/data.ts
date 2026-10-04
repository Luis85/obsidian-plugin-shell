import { requireSketch, hasControls } from './errors.ts';
export function object(value: unknown): Record<string, unknown> {
  requireSketch(value !== null && typeof value === 'object' && !Array.isArray(value), 'MAKER_INPUT', 'Expected a JSON object.');
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  requireSketch(!unexpected.length, 'MAKER_UNKNOWN_FIELD', `Unknown fields: ${unexpected.join(', ')}.`);
}
export function text(value: unknown, name: string, max = 120): string {
  requireSketch(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    'MAKER_FIELD', `${name} needs text (1–${max} characters).`);
  requireSketch(!hasControls(value, true), 'MAKER_CONTROL', `${name} contains control characters.`);
  return value.trim();
}
export function list(value: unknown, name: string, limit = 60): unknown[] {
  requireSketch(Array.isArray(value) && value.length <= limit, 'MAKER_LIST', `${name} needs an array with at most ${limit} items.`);
  return value;
}
