import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { setupMcpFiles } from '../agent/mcp-config.mjs';
import { createFilePlan } from '../shared/file-plan.mjs';

function previousHashes(previous) {
  const values = Array.isArray(previous?.files) ? previous.files : [];
  return new Map(values.filter(item => item && typeof item.path === 'string' && typeof item.afterHash === 'string')
    .map(item => [item.path, item.afterHash]));
}
export async function planLocalMcp(root, enabled, previous = null) {
  const plan = await createFilePlan(root, enabled ? setupMcpFiles() : []);
  if (!enabled) return { version: 1, enabled: false, server: 'workbench', transport: 'stdio', clients: [], plan, files: [] };
  await access(join(root, 'bin/app'));
  const owned = previousHashes(previous);
  for (const change of plan.changes) {
    if (change.status === 'update' && owned.get(change.path) !== change.beforeHash) {
      throw new Error(`MCP_CONFIG_CONFLICT: ${change.path} has user or external changes; preserve/reconcile it before setup manages this file.`);
    }
  }
  return {
    version: 1, enabled: true, server: 'workbench', transport: 'stdio', clients: ['claude-code', 'codex'], plan,
    files: plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash })),
  };
}
