/** Bootstrap-only dependency injection; no production/simulated mixed-source fallback. */
const plain = (value: unknown): value is object => Boolean(value) && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function overridePort(value: object, name: string): object {
  const descriptor = Object.getOwnPropertyDescriptor(value, name)!;
  if (!('value' in descriptor)) throw new Error('SOURCE_OVERRIDE_ACCESSOR');
  const port: unknown = descriptor.value;
  if (!plain(port)) throw new Error('SOURCE_OVERRIDE_INVALID');
  return port;
}
/** Exactly the declared operations, each a data-property function. */
function assertOperations(port: object, expected: readonly string[]): void {
  const keys = Reflect.ownKeys(port);
  if (keys.length !== expected.length || !keys.every(key => typeof key === 'string' && expected.includes(key))) throw new Error('SOURCE_OVERRIDE_INCOMPLETE');
  for (const operation of expected) {
    const member = Object.getOwnPropertyDescriptor(port, operation);
    if (!member || !('value' in member) || typeof member.value !== 'function') throw new Error('SOURCE_OVERRIDE_OPERATION');
  }
}
export function validateSourceOverrides(value: unknown, contracts: Readonly<Record<string, readonly string[]>>): void {
  if (!plain(value)) throw new Error('SOURCE_OVERRIDES_INVALID');
  for (const name of Reflect.ownKeys(value)) {
    if (typeof name !== 'string' || !Object.hasOwn(contracts, name)) throw new Error('SOURCE_OVERRIDE_UNKNOWN');
    assertOperations(overridePort(value, name), contracts[name]!);
  }
}
