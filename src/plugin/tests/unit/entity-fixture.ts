import { vi } from 'vitest';
import { TypedEventBus } from '../../infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../application/events';
import type { Result } from '../../domain/outcome';
import { memoryStorage } from './memory-storage';

/** Generic entity test ports; deliberately independent of the removable examples. */
export function entityFixture() {
  const storage = memoryStorage();
  const errors = { report: vi.fn() };
  const events = new TypedEventBus<ShellEvents>(errors);
  return { ...storage, errors, events };
}
export function unwrapEntity<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Unexpected entity result: ${result.error.code}`);
  return result.value;
}
