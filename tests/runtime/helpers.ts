import { vi } from 'vitest';
import { success, type Result } from '../../src/domain/outcome';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import { DocumentCreationService } from '../../src/application/document-service';
import { taskDefinition, type EntityInputs } from '../../src/application/task-document';
import { renderMarkdown } from '../../src/infrastructure/markdown';
import type { ShellEvents } from '../../src/application/events';
import type { HostActions } from '../../src/application/ports';
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
