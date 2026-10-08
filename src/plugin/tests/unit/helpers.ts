import { vi } from 'vitest';
import { success, type Result } from '../../domain/outcome';
import { TypedEventBus } from '../../infrastructure/events/typed-event-bus';
import { DocumentCreationService } from '../../application/document-service';
import { taskDefinition, type EntityInputs } from '../../features/tasks/form';
import { renderMarkdown } from '../../infrastructure/markdown';
import type { ShellEvents } from '../../application/events';
import type { HostActions } from '../../application/ports';
export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}
export function fixture() {
  const errors = { report: vi.fn() };
  const bus = new TypedEventBus<ShellEvents>(errors);
  const writer = { create: vi.fn(async (_path: string, _text: string): Promise<Result<void>> => success(undefined)) };
  let sequence = 0;
  const documents = new DocumentCreationService<EntityInputs>({ task: taskDefinition }, writer, bus, renderMarkdown, () => `id-${++sequence}`, () => '2026-09-22T12:00:00.000Z');
  return { errors, bus, writer, documents };
}
export const input = { title: 'Release checklist', due: '2026-09-30', tags: 'work,release,work' };
export function host(): HostActions { return { kind: 'browser', openDocument: vi.fn(async () => success(undefined)), showModal: vi.fn(), notice: vi.fn(() => vi.fn()) }; }
