import { defineCommand } from '../api';
import type { DebugService } from '../../application/debug-service';
import type { Failure } from '../../domain/outcome';
interface DebugActions {
  readonly debugging: Pick<DebugService, 'enabled' | 'setEnabled' | 'exportJSON'>;
  readonly modals: { info(request: { owner: string; titleKey: string; message: string }): Promise<{ status: 'failed'; error: Failure } | { status: 'confirmed' | 'cancelled' }> };
  readonly notices: { info(request: { owner: string; operation: string; key: string }): unknown };
}
/** Explicit runtime controls; inspection displays bounded, redacted plain JSON. */
export function createDebugCommands({ debugging, modals, notices }: DebugActions) {
  const toggle = defineCommand({ id: 'debug-toggle', titleKey: 'debug.toggle', execute: () => {
    debugging.setEnabled(!debugging.enabled);
    notices.info({ owner: 'runtime:debug', operation: 'debug-toggle', key: debugging.enabled ? 'debug.enabled' : 'debug.disabled' });
  } });
  const inspect = defineCommand({ id: 'debug-report', titleKey: 'debug.report', execute: async () => {
    const result = await modals.info({ owner: 'runtime:debug-report', titleKey: 'debug.title', message: debugging.exportJSON({ maxRecords: 50 }) });
    if (result.status === 'failed') return { ok: false as const, error: result.error };
  } });
  return { commands: [toggle, inspect], ribbons: [] };
}
