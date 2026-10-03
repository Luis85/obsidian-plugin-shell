/** Defensive copy of canonical note values before any queued or awaited write. */
const unsafe = ['constructor', 'prototype', '__proto__'];
function problem(code: string): never { throw new Error('RELATIONSHIP_' + code); }
function own(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !('value' in descriptor)) problem('ACCESSOR');
  return descriptor?.value;
}
/** Snapshot scalar note fields without executing accessors or retaining mutable caller arrays. */
export function snapshotNoteValues<T extends object>(value: T): T {
  if (!value || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) problem('VALUES');
  const entries = Reflect.ownKeys(value);
  if (entries.length > 100) problem('VALUES_LIMIT');
  return Object.freeze(Object.fromEntries(entries.map(key => {
    if (typeof key !== 'string' || unsafe.includes(key)) problem('PROPERTY');
    const item = own(value, key);
    if (Array.isArray(item)) {
      if (item.length > 1000 || Reflect.ownKeys(item).length !== item.length + 1) problem('VALUES_LIMIT');
      const copy = Array.from({length:item.length}, (_, i) => own(item, String(i)));
      if (copy.some(v => typeof v !== 'string' || v.length > 100000)) problem('VALUES');
      return [key, Object.freeze(copy)];
    }
    if (item !== undefined && typeof item !== 'boolean' && !(typeof item === 'number' && Number.isFinite(item)) && !(typeof item === 'string' && item.length <= 100000)) problem('VALUES');
    return [key, item];
  }))) as T;
}
