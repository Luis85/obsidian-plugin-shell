import { plainRecord } from '../../domain/entity';
export function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    plainRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
export const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const path = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export const kind = (value: unknown): value is 'file' | 'folder' => value === 'file' || value === 'folder';
