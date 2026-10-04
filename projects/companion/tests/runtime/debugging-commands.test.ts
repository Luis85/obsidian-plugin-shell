import { expect, it, vi } from 'vitest';
import { createDebugCommands } from '../../src/features/debugging/commands';
import { StructuredLogger } from '../../src/application/logging';
import { defineLogCatalog } from '../../src/features/api';
import { DebugService } from '../../src/application/debug-service';
import { failure } from '../../src/domain/outcome';
it('[DEBUG-03-01] explicit commands toggle runtime debug and inspect a bounded sanitized report through the modal contract', async () => {
  const logger = new StructuredLogger({ report() {} }, () => '2026-09-23T00:00:00.000Z');
  const debugging = new DebugService(logger, () => []);
  const info = vi.fn(async (_request: { owner: string; titleKey: string; message: string }): Promise<{ status: 'confirmed' | 'cancelled' }> => ({ status: 'confirmed' }));
  const notice = vi.fn(); const group = createDebugCommands({ debugging, modals: { info }, notices: { info: notice } });
  expect(group.commands.map(command => command.id)).toEqual(['debug-toggle', 'debug-report']);
  await group.commands[0]?.execute(); expect(debugging.enabled).toBe(true);
  expect(info).not.toHaveBeenCalled(); expect(notice).toHaveBeenCalledWith({ owner: 'runtime:debug', operation: 'debug-toggle', key: 'debug.enabled' });
  const catalog = logger.registerCatalog(defineLogCatalog('s'.repeat(64), { codes: ['c'.repeat(64)], operations: ['o'.repeat(64)] }));
  for (let i = 0; i < 100; i++) catalog.debug('c'.repeat(64), 'o'.repeat(64), { count: 1_000_000, attempt: 1_000_000, durationMs: 86_400_000, correlation: logger.correlation(), effect: 'uncertain' });
  await group.commands[1]?.execute(); const message = info.mock.calls[0]?.[0].message ?? '';
  expect(message.length).toBeLessThan(64_000); expect(JSON.parse(message).recordScope).toEqual({ retained: 101, exported: 50, omitted: 51 });
  await group.commands[0]?.execute(); expect(debugging.enabled).toBe(false); expect(notice).toHaveBeenLastCalledWith({ owner: 'runtime:debug', operation: 'debug-toggle', key: 'debug.disabled' }); logger.dispose();
});
it('[DEBUG-03-02] failed inspection remains a typed command failure, never a successful export claim', async () => {
  const logger = new StructuredLogger({ report() {} }, () => '2026-09-23T00:00:00.000Z');
  const debugging = new DebugService(logger, () => []); const rejected = failure('storage', 'error.unexpected');
  if (rejected.ok) throw new Error('fixture');
  const group = createDebugCommands({ debugging, modals: { info: async () => ({ status: 'failed', error: rejected.error }) }, notices: { info() {} } });
  expect(await group.commands[1]?.execute()).toEqual(rejected); logger.dispose();
});
it('[DEBUG-03-03] the real report command treats fifty records as an upper bound for smaller logger capacities', async () => {
  const logger = new StructuredLogger({ report() {} }, () => '2026-09-23T00:00:00.000Z', { capacity: 2 });
  const debugging = new DebugService(logger, () => []); const messages: string[] = [];
  const group = createDebugCommands({ debugging, notices: { info() {} }, modals: { async info(request) { messages.push(request.message); return { status: 'confirmed' }; } } });
  for (let i = 0; i < 4; i++) logger.info('operation.completed', 'command.execute');
  expect(await group.commands[1]?.execute()).toBeUndefined();
  expect(JSON.parse(messages[0] ?? '{}').recordScope).toEqual({ retained: 2, exported: 2, omitted: 0 });
  for (const maxRecords of [NaN, Infinity, -1, 1001]) expect(() => debugging.exportJSON({ maxRecords })).toThrow('INVALID_DEBUG_EXPORT_LIMIT');
  logger.dispose();
});
